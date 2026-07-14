import { NextResponse } from 'next/server';
import { logError, logAudit } from '@/lib/log';
import { invalidateSheets } from '@/lib/sheetCache';
import { sheetsWriteClient } from '@/lib/sheets';
import { todayKST } from '@/lib/date';
import { colLetter } from '@/lib/sheetUtil';

export const dynamic = 'force-dynamic';

// 과업 완료(P5) — id 행을 아카이브 탭에 append한 뒤, 과업 탭에서 그 한 행만 삭제(SA Sheets API).
// ⚠️ 구버전(전체 읽기→탭 비우고 되쓰기)은 완수 두 번이 겹치면 지운 행이 부활하고 아카이브가 중복되며,
//    되쓰는 몇 초 사이에 추가된 행이 증발했음(2026-07-06 확인: 아카이브 중복 4쌍이 물증). 단일행 삭제로 교체.
const SHEET_ID = process.env.SHEET_ID;
const SA_JSON = process.env.GOOGLE_SA_JSON;
const WRITE_URL = process.env.SHEET_WRITE_URL
  || 'https://script.google.com/macros/s/AKfycbxPt24eFUbUP1cPwsv5Gspc3pak_hvqIdGf7T4cbvqJSxKkKimCdEhxdSll0yMPJ5dPAw/exec';
const KEY = process.env.SHEET_KEY || 'qnbang2026';
const HEADER = ['id', '프로젝트', '과업명', '담당자', '공위치', '현재상태', '다음할일',
  '기한', '고객', '돈종류', '할일', '판정근거', '갱신일', '출처', '계약여부'];

const saApi = sheetsWriteClient;

// ISO 날짜 셀(2026-07-03T15:00:00.000Z)을 KST YYYY-MM-DD로. 그 외 문자열은 그대로.
function normCell(v: unknown): string {
  const s = String(v ?? '');
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  }
  return s;
}

export async function POST(req: Request) {
  try {
    const { id, 사유 } = await req.json().catch(() => ({})); // 사유='폐기' 등 — 있으면 아카이브 행 현재상태에 표시(완수와 구분)
    if (!id) return NextResponse.json({ ok: false, error: 'id 필요' }, { status: 400 });
    if (!SHEET_ID || !SA_JSON) return NextResponse.json({ ok: false, error: 'SA 설정 누락' }, { status: 500 });
    const sheets = saApi();

    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: '과업' });
    const rows = res.data.values || [];
    if (rows.length < 2) return NextResponse.json({ ok: false, error: '과업 탭 못읽음' }, { status: 502 });
    const head = rows[0].map((h) => String(h));
    const idIdx = head.indexOf('id');
    if (idIdx < 0) return NextResponse.json({ ok: false, error: '과업 시트에 id 컬럼 없음' }, { status: 502 });
    const rowIdx = rows.findIndex((r, i) => i > 0 && String(r[idIdx] ?? '') === String(id));
    if (rowIdx < 0) { // 더블클릭 등으로 이미 처리된 뒤 → 멱등 성공(구버전은 여기서 아카이브 중복을 만들었음)
      invalidateSheets();
      return NextResponse.json({ ok: true, already: true });
    }
    const target = rows[rowIdx];

    // 완수 행(객체) — 실제 헤더 기준, 공위치=완수, 갱신일=오늘
    const done: Record<string, string> = {};
    head.forEach((h, i) => { done[h] = normCell(target[i]); });
    done['공위치'] = '완수';
    if (사유) done['현재상태'] = String(사유);
    done['갱신일'] = todayKST();

    // 순서 중요: 아카이브에 먼저 넣고(실패하면 원본 그대로 남음) → 성공 후에 원본 한 행 삭제
    const wres = await fetch(WRITE_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: KEY, 종류: '아카이브', 헤더: HEADER, 행: done }),
    });
    const wj = await wres.json().catch(() => ({} as { ok?: boolean; error?: string }));
    if (!wj.ok) return NextResponse.json({ ok: false, error: wj.error || '아카이브 기록 실패(과업은 그대로 있음)' }, { status: 502 });

    // 삭제 직전 id열만 재조회해 행을 다시 특정 — 아카이브 쓰는 몇 초 사이 다른 삭제로 행번호가 밀렸을 수 있음
    const idCol = colLetter(idIdx);
    const re = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `과업!${idCol}:${idCol}` });
    const ids = re.data.values || [];
    let gridIdx = -1;
    for (let i = 1; i < ids.length; i++) if (String(ids[i]?.[0] ?? '') === String(id)) { gridIdx = i; break; }
    if (gridIdx >= 0) {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: 'sheets.properties' });
      const sid = meta.data.sheets?.find((s) => s.properties?.title === '과업')?.properties?.sheetId;
      if (sid == null) return NextResponse.json({ ok: false, error: '과업 탭 sheetId 못찾음' }, { status: 502 });
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: { requests: [{ deleteDimension: { range: { sheetId: sid, dimension: 'ROWS', startIndex: gridIdx, endIndex: gridIdx + 1 } } }] },
      });
    }
    invalidateSheets(); // 이동 즉시 반영
    logAudit('/api/office/complete', 사유 ? `과업 ${사유}` : '과업 완수', { id, 과업명: done['과업명'] || done['프로젝트'], 돈종류: done['돈종류'] });
    return NextResponse.json({ ok: true, archived: done['과업명'] || done['프로젝트'] });
  } catch (e) {
    logError('/api/office/complete', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
