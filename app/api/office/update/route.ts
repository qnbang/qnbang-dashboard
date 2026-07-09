import { NextResponse } from 'next/server';
import { logError, logAudit } from '@/lib/log';
import { google } from 'googleapis';
import { invalidateSheets } from '@/lib/sheetCache';

export const dynamic = 'force-dynamic';

const SHEET_ID = process.env.SHEET_ID;
const SA_JSON = process.env.GOOGLE_SA_JSON;
const PATCHABLE = new Set(['프로젝트', '과업명', '담당자', '공위치', '현재상태', '다음할일', '기한', '고객', '돈종류', '할일', '메모', '갱신일', '분류', '저장소']);

function saApi() {
  const sa = JSON.parse(SA_JSON!);
  const auth = new google.auth.JWT({ email: sa.client_email, key: sa.private_key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}
function colLetter(n: number) {
  let s = '';
  for (let i = n; i >= 0; i = Math.floor(i / 26) - 1) s = String.fromCharCode(65 + (i % 26)) + s;
  return s;
}
function todayKST() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }); }

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id, patch, delete: del } = body;
    if (!id) return NextResponse.json({ ok: false, error: 'id 필요' }, { status: 400 });

    if (!SHEET_ID || !SA_JSON) return NextResponse.json({ ok: false, error: 'SA 설정 누락' }, { status: 500 });
    const sheets = saApi();

    // ── 과업 시트 헤더 + id 컬럼 읽기 (수정·삭제 공통) ──
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: '과업' });
    const rows = res.data.values || [];
    if (rows.length < 2) return NextResponse.json({ ok: false, error: '과업 탭 비어있음' }, { status: 502 });
    const head = rows[0].map((h) => String(h));
    const idIdx = head.indexOf('id');
    if (idIdx < 0) return NextResponse.json({ ok: false, error: '과업 시트에 id 컬럼 없음' }, { status: 502 });
    const rowIdx = rows.findIndex((r, i) => i > 0 && String(r[idIdx] ?? '') === String(id));
    if (rowIdx < 0) return NextResponse.json({ ok: false, error: '해당 과업 없음: ' + id }, { status: 404 });
    const sheetRow = rowIdx + 1; // 1-indexed

    // ── 수정: SA로 해당 셀들만 직접 업데이트 ──
    if (!del) {
      if (!patch || typeof patch !== 'object') return NextResponse.json({ ok: false, error: 'patch 필요' }, { status: 400 });
      const 값: Record<string, string> = {};
      for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
        if (PATCHABLE.has(k)) 값[k] = String(v ?? '');
      }
      값['갱신일'] = todayKST();
      const updates = Object.entries(값)
        .map(([k, v]) => { const ci = head.indexOf(k); return ci >= 0 ? { range: `과업!${colLetter(ci)}${sheetRow}`, values: [[v]] } : null; })
        .filter(Boolean) as { range: string; values: string[][] }[];
      if (updates.length === 0) return NextResponse.json({ ok: false, error: '업데이트 할 필드 없음' }, { status: 400 });
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: { valueInputOption: 'USER_ENTERED', data: updates },
      });
      invalidateSheets();
      logAudit('/api/office/update', '과업 수정', { id, 필드: Object.keys(값), cells: updates.length });
      return NextResponse.json({ ok: true, action: 'updated', cells: updates.length });
    }

    // ── 삭제: SA로 그 한 행만 삭제 ──
    // ⚠️ 구버전(탭 전체 덮어쓰기)은 되쓰는 몇 초 사이의 추가·완수와 겹치면 행 증발·부활을 일으켰음(2026-07-06 교체)
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: 'sheets.properties' });
    const sid = meta.data.sheets?.find((s) => s.properties?.title === '과업')?.properties?.sheetId;
    if (sid == null) return NextResponse.json({ ok: false, error: '과업 탭 sheetId 못찾음' }, { status: 502 });
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ deleteDimension: { range: { sheetId: sid, dimension: 'ROWS', startIndex: rowIdx, endIndex: rowIdx + 1 } } }] },
    });
    invalidateSheets();
    logAudit('/api/office/update', '과업 삭제', { id });
    return NextResponse.json({ ok: true, action: 'deleted' });
  } catch (e) {
    logError('/api/office/update', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
