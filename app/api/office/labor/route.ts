import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { invalidateSheets } from '@/lib/sheetCache';

// 인건비 원장 API — '인건비' 탭(월,구분,이름,세전,공제,실지급,지급상태,지급일,비고)의 추가·수정·삭제와
// 지급확인(실제 이체 후 버튼 → 그때만 지출 탭에 기록: 통장단일원장 원칙), 지난달 명단 복사.
// 읽기는 /api/office → lib/money.ts 인건비목록으로 (여기엔 GET 없음).
export const dynamic = 'force-dynamic';

const SHEET_ID = process.env.SHEET_ID;
const SA_JSON = process.env.GOOGLE_SA_JSON;
const TAB = '인건비';
// ponytail: 기타 항목 지급확인용 선택지 — 시트 실사용 분류 기준(고정 8종 + 외주·기타)
const 카테고리들 = ['실비', '업무비', '식비', '프로그램 사용료', '월세&공과금', '재료비', '세금', '급여', '외주', '기타'];

function api() {
  const sa = JSON.parse(SA_JSON!);
  const auth = new google.auth.JWT({ email: sa.client_email, key: sa.private_key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}

const num = (v: unknown) => Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;
const isYM = (s: unknown) => /^\d{4}-\d{2}$/.test(String(s ?? ''));

// 인건비 탭 전체 읽기 (라이브 — 쓰기 직전엔 캐시 말고 실시트 기준)
async function readTab() {
  const res = await api().spreadsheets.values.get({ spreadsheetId: SHEET_ID!, range: TAB, valueRenderOption: 'FORMATTED_VALUE' });
  const rows = (res.data.values || []).slice(1).map((r, i) => ({
    _row: i + 2,
    월: String(r[0] ?? '').trim(), 구분: String(r[1] ?? '').trim(), 이름: String(r[2] ?? '').trim(),
    세전: num(r[3]), 공제: num(r[4]), 실지급: num(r[5]),
    지급상태: String(r[6] ?? '').trim(), 지급일: String(r[7] ?? '').trim(), 비고: String(r[8] ?? '').trim(),
  })).filter((r) => r.이름);
  return rows;
}

// POST { 월, 구분, 이름, 세전, 공제, 실지급, 비고 } → 행 추가 (지급상태=대기)
// POST { action:'copy', to:'2026-07' } → 직전 귀속월 명단을 to월로 복사
export async function POST(req: Request) {
  try {
    if (!SHEET_ID || !SA_JSON) return NextResponse.json({ ok: false, error: '설정 누락' }, { status: 500 });
    const body = await req.json().catch(() => ({}));

    if (body.action === 'copy') {
      const to = String(body.to || '');
      if (!isYM(to)) return NextResponse.json({ ok: false, error: 'to(YYYY-MM) 필요' }, { status: 400 });
      const all = await readTab();
      // ponytail: 멱등 = 대상월에 행이 하나라도 있으면 복사 거부(같은 사람 여러 행 케이스가 있어 이름 단위 병합은 안 함)
      if (all.some((r) => r.월 === to)) return NextResponse.json({ ok: false, error: `${to}에 이미 명단이 있습니다 — 개별 추가로 넣어주세요` }, { status: 409 });
      const prevMonths = Array.from(new Set(all.map((r) => r.월))).filter((m) => m < to).sort();
      const from = prevMonths[prevMonths.length - 1];
      if (!from) return NextResponse.json({ ok: false, error: '복사할 이전 달 명단이 없습니다' }, { status: 404 });
      const values = all.filter((r) => r.월 === from)
        .map((r) => [to, r.구분, r.이름, String(r.세전), String(r.공제), String(r.실지급), '대기', '', r.비고.replace(/ · 엑셀 이관|엑셀 이관/g, '').trim()]);
      await api().spreadsheets.values.append({
        spreadsheetId: SHEET_ID!, range: `${TAB}!A1`,
        valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
        requestBody: { values },
      });
      invalidateSheets();
      return NextResponse.json({ ok: true, from, to, 건수: values.length });
    }

    const { 월, 구분, 이름, 세전, 공제, 실지급, 비고 } = body;
    if (!isYM(월) || !구분 || !이름) return NextResponse.json({ ok: false, error: '월(YYYY-MM)·구분·이름 필요' }, { status: 400 });
    if (num(세전) - num(공제) !== num(실지급)) return NextResponse.json({ ok: false, error: '세전−공제≠실지급 — 검산 불일치' }, { status: 400 });
    await api().spreadsheets.values.append({
      spreadsheetId: SHEET_ID!, range: `${TAB}!A1`,
      valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [[월, 구분, 이름, String(num(세전)), String(num(공제)), String(num(실지급)), '대기', '', 비고 || '']] },
    });
    invalidateSheets();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// PATCH { rowNum, 월, 구분, 이름, 세전, 공제, 실지급, 비고 } → 행 수정 (지급상태·지급일은 보존)
// PATCH { action:'pay', rowNum, 지급일, 카테고리? } → 지급확인 (지출 기록 + 상태 갱신, 멱등)
export async function PATCH(req: Request) {
  try {
    if (!SHEET_ID || !SA_JSON) return NextResponse.json({ ok: false, error: '설정 누락' }, { status: 500 });
    const body = await req.json().catch(() => ({}));
    const rowNum = Number(body.rowNum);
    if (!rowNum || rowNum < 2) return NextResponse.json({ ok: false, error: 'rowNum 필요' }, { status: 400 });

    if (body.action === 'pay') {
      const 지급일 = String(body.지급일 || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(지급일)) return NextResponse.json({ ok: false, error: '지급일(YYYY-MM-DD) 필요' }, { status: 400 });
      const all = await readTab();
      const row = all.find((r) => r._row === rowNum);
      if (!row) return NextResponse.json({ ok: false, error: '해당 행 없음' }, { status: 404 });
      if (row.지급상태 === '지급완료') return NextResponse.json({ ok: true, already: true });

      // 카테고리: 직원=급여, 프리랜서=외주(기존 지출 기록 관례), 기타=클라이언트가 선택(추측분류 금지 — 기본값 없음)
      let 카테고리 = row.구분 === '프리랜서' ? '외주' : '급여';
      if (row.구분 === '기타') {
        카테고리 = String(body.카테고리 || '');
        if (!카테고리들.includes(카테고리)) return NextResponse.json({ ok: false, error: '기타 항목은 카테고리 선택 필요' }, { status: 400 });
      }

      const monthTab = `${Number(지급일.slice(5, 7))}월`;
      const 멱등키 = `자동(인건비 ${row.월} ${row.이름} #${rowNum})`;
      const cur = await api().spreadsheets.values.get({ spreadsheetId: SHEET_ID!, range: monthTab, valueRenderOption: 'FORMATTED_VALUE' });
      const 이미있음 = (cur.data.values || []).some((r) => String(r[4] ?? '').includes(멱등키));
      if (!이미있음) {
        // 지출 헤더: 날짜, 카테고리, 지출 내용, 비용, 비고, 과업 관리
        await api().spreadsheets.values.append({
          spreadsheetId: SHEET_ID!, range: `${monthTab}!A1`,
          valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS',
          requestBody: { values: [[지급일, 카테고리, row.구분 === '기타' ? row.이름 : `인건비 ${row.이름} (${row.월}분)`, String(row.실지급), 멱등키, '']] },
        });
      }
      await api().spreadsheets.values.update({
        spreadsheetId: SHEET_ID!, range: `${TAB}!G${rowNum}:H${rowNum}`,
        valueInputOption: 'RAW',
        requestBody: { values: [['지급완료', 지급일]] },
      });
      invalidateSheets();
      return NextResponse.json({ ok: true, 지출기록: !이미있음 });
    }

    const { 월, 구분, 이름, 세전, 공제, 실지급, 비고 } = body;
    if (!isYM(월) || !구분 || !이름) return NextResponse.json({ ok: false, error: '월(YYYY-MM)·구분·이름 필요' }, { status: 400 });
    if (num(세전) - num(공제) !== num(실지급)) return NextResponse.json({ ok: false, error: '세전−공제≠실지급 — 검산 불일치' }, { status: 400 });
    await api().spreadsheets.values.update({
      spreadsheetId: SHEET_ID!, range: `${TAB}!A${rowNum}:F${rowNum}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[월, 구분, 이름, String(num(세전)), String(num(공제)), String(num(실지급))]] },
    });
    // 비고는 I열 (G:H 지급상태·지급일은 건드리지 않음)
    await api().spreadsheets.values.update({
      spreadsheetId: SHEET_ID!, range: `${TAB}!I${rowNum}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[비고 || '']] },
    });
    invalidateSheets();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// DELETE { rowNum } → 행 삭제
export async function DELETE(req: Request) {
  try {
    if (!SHEET_ID || !SA_JSON) return NextResponse.json({ ok: false, error: '설정 누락' }, { status: 500 });
    const { rowNum } = await req.json().catch(() => ({}));
    if (!rowNum || rowNum < 2) return NextResponse.json({ ok: false, error: 'rowNum 필요' }, { status: 400 });

    const sheets = api();
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID!, fields: 'sheets.properties' });
    const sheetObj = (meta.data.sheets || []).find((s) => s.properties?.title === TAB);
    if (!sheetObj) return NextResponse.json({ ok: false, error: `${TAB} 탭 없음` }, { status: 404 });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID!,
      requestBody: { requests: [{ deleteDimension: { range: {
        sheetId: sheetObj.properties!.sheetId!,
        dimension: 'ROWS', startIndex: rowNum - 1, endIndex: rowNum,
      }}}]},
    });
    invalidateSheets();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
