import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { google } from 'googleapis';
import { logError } from '@/lib/log';
import { invalidateSheets } from '@/lib/sheetCache';

// 회장 금고 — 통장 파일(카카오뱅크 거래내역 .xlsx) 업로드 → 잔고 탭 자동 갱신.
// POST: 파일 → 암호 해제(고정 비번) → 마지막 거래의 '거래 후 잔액'+거래일을 잔고 탭 통장잔고 행에 기록.
//       파일은 저장하지 않음(파싱 후 버림) — 원본은 맥 큐앤뱅-재무 폴더가 보관처(통장단일원장 유지).
// PATCH: {항목: 세이프박스|비상금, 금액} → 잔고 탭 해당 행 수정(비상금 행 없으면 추가).
// 보호: 미들웨어(qnbang_auth) + /company 2차 게이트(qnbang_company) 둘 다 통과해야 함.
export const dynamic = 'force-dynamic';

const SHEET_ID = process.env.SHEET_ID;
const SA_JSON = process.env.GOOGLE_SA_JSON;
const XLSX_PW = process.env.BANK_XLSX_PW || '920623'; // 카카오뱅크 내보내기 고정 암호(생년월일)

function api() {
  const sa = JSON.parse(SA_JSON!);
  const auth = new google.auth.JWT({ email: sa.client_email, key: sa.private_key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}

async function guard(): Promise<string | null> {
  const jar = await cookies();
  const t = jar.get('qnbang_company')?.value;
  if (!t || !process.env.COMPANY_TOKEN || t !== process.env.COMPANY_TOKEN) return '회장 전용 — /company 로그인이 필요합니다';
  if (!SHEET_ID || !SA_JSON) return '설정 누락';
  return null;
}

// 잔고 탭에서 항목 행 찾아 [금액, 날짜] 갱신 (없으면 append)
async function setBalance(항목: string, 금액: number, 날짜: string) {
  const sheets = api();
  const cur = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID!, range: '잔고!A1:C20' });
  const rows = cur.data.values || [];
  const idx = rows.findIndex((r) => String(r[0] ?? '').trim() === 항목);
  if (idx >= 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID!, range: `잔고!B${idx + 1}:C${idx + 1}`,
      valueInputOption: 'RAW', requestBody: { values: [[금액, 날짜]] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID!, range: '잔고!A1',
      valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: [[항목, 금액, 날짜]] },
    });
  }
  invalidateSheets();
}

export async function POST(req: Request) {
  const err = await guard();
  if (err) return NextResponse.json({ ok: false, error: err }, { status: 401 });
  try {
    const fd = await req.formData();
    const f = fd.get('file');
    if (!(f instanceof File)) return NextResponse.json({ ok: false, error: '파일이 없습니다' }, { status: 400 });
    const buf = Buffer.from(await f.arrayBuffer());

    // 웹팩 CJS 인터롭 방어 — named export가 비면 default에서 꺼냄
    const oc = await import('officecrypto-tool');
    const decrypt = oc.decrypt ?? (oc as { default?: { decrypt: typeof oc.decrypt } }).default?.decrypt;
    const xm = await import('xlsx');
    const XLSX = (xm.read ? xm : (xm as { default?: typeof xm }).default)!;
    let dec: Buffer;
    try {
      dec = await decrypt!(buf, { password: XLSX_PW });
    } catch {
      dec = buf; // 암호 없는 파일도 허용
    }
    const wb = XLSX.read(dec, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false });

    // 헤더 행(거래일시 …) 찾기 — 카카오뱅크 양식: [_, 거래일시, 구분, 거래금액, 거래 후 잔액, 거래구분, 내용, 메모]
    // Array.from으로 희소배열(빈 셀=구멍)을 메꿔야 findIndex가 undefined를 안 만남
    const hi = rows.findIndex((r) => Array.from(r || []).some((c) => String(c ?? '').includes('거래일시')));
    if (hi < 0) return NextResponse.json({ ok: false, error: '카카오뱅크 거래내역 양식이 아닙니다 (거래일시 헤더 없음)' }, { status: 400 });
    const head = Array.from(rows[hi]).map((c) => String(c ?? ''));
    const col = (name: string) => head.findIndex((h) => h.includes(name));
    const cDate = col('거래일시'), cAmt = col('거래금액'), cBal = col('거래 후 잔액');
    const num = (v: unknown) => Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;

    const tx = rows.slice(hi + 1)
      .filter((r) => r && String(r[cDate] ?? '').match(/^\d{4}\./))
      .map((r) => ({ 일시: String(r[cDate]), 금액: num(r[cAmt]), 잔액: num(r[cBal]) }));
    if (!tx.length) return NextResponse.json({ ok: false, error: '거래 행이 없습니다' }, { status: 400 });

    const last = tx[tx.length - 1]; // 카카오뱅크는 오래된 순 → 마지막 = 최신
    // 기준일 = 파일 머리의 '요청일시'(조회 시점) — 그 시점까지 잔액이 확인된 것. 없으면 마지막 거래일.
    let 기준일 = last.일시.slice(0, 10).replace(/\./g, '-');
    for (const r of rows.slice(0, hi)) {
      const cells = Array.from(r || []).map((c) => String(c ?? ''));
      const qi = cells.findIndex((c) => c.includes('요청일시'));
      if (qi >= 0 && cells[qi + 1]?.match(/^\d{4}\./)) { 기준일 = cells[qi + 1].slice(0, 10).replace(/\./g, '-'); break; }
    }
    const nowKST = new Date(Date.now() + 9 * 3600 * 1000);
    const curYM = `${nowKST.getUTCFullYear()}.${String(nowKST.getUTCMonth() + 1).padStart(2, '0')}`;
    const 이번달 = tx.filter((t) => t.일시.startsWith(curYM));
    const 이번달입금 = 이번달.filter((t) => t.금액 > 0).reduce((s, t) => s + t.금액, 0);
    const 이번달출금 = 이번달.filter((t) => t.금액 < 0).reduce((s, t) => s - t.금액, 0);

    await setBalance('통장잔고', last.잔액, 기준일);
    return NextResponse.json({ ok: true, 잔액: last.잔액, 기준일, 건수: tx.length, 이번달입금, 이번달출금 });
  } catch (e) {
    logError('/api/company/bank POST', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const err = await guard();
  if (err) return NextResponse.json({ ok: false, error: err }, { status: 401 });
  try {
    const { 항목, 금액 } = await req.json().catch(() => ({}));
    if (!['세이프박스', '비상금'].includes(항목) || typeof 금액 !== 'number' || 금액 < 0) {
      return NextResponse.json({ ok: false, error: '항목(세이프박스|비상금)과 금액이 필요합니다' }, { status: 400 });
    }
    const nowKST = new Date(Date.now() + 9 * 3600 * 1000);
    const today = `${nowKST.getUTCFullYear()}-${String(nowKST.getUTCMonth() + 1).padStart(2, '0')}-${String(nowKST.getUTCDate()).padStart(2, '0')}`;
    await setBalance(항목, 금액, today);
    return NextResponse.json({ ok: true });
  } catch (e) {
    logError('/api/company/bank PATCH', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
