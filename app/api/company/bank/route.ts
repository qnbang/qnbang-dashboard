import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decrypt } from 'officecrypto-tool';
import * as XLSX from 'xlsx';
import { logError } from '@/lib/log';
import { invalidateSheets } from '@/lib/sheetCache';
import { sheetsWriteClient } from '@/lib/sheets';
import { createHash } from 'crypto';

// 회장 금고 — 통장 파일(카카오뱅크 거래내역 .xlsx) 업로드 → 잔고 탭 자동 갱신.
// POST: 파일 → 암호 해제(고정 비번) → 마지막 거래의 '거래 후 잔액'+거래일을 잔고 탭 통장잔고 행에 기록.
//       파일은 저장하지 않음(파싱 후 버림) — 원본은 맥 큐앤뱅-재무 폴더가 보관처(통장단일원장 유지).
// PATCH: {항목: 세이프박스|비상금, 금액} → 잔고 탭 해당 행 수정(비상금 행 없으면 추가).
// 보호: 미들웨어(qnbang_auth) + /company 2차 게이트(qnbang_company) 둘 다 통과해야 함.
export const dynamic = 'force-dynamic';

const SHEET_ID = process.env.SHEET_ID;
const SA_JSON = process.env.GOOGLE_SA_JSON;
const OPERATING_SHEET_ID = '1RnmSplWT2-Aqk-flDInpWMljKwBbUes1q6pab9j3dfo';
const XLSX_PW = process.env.BANK_XLSX_PW || '920623'; // 카카오뱅크 내보내기 고정 암호(생년월일)

const api = sheetsWriteClient;

async function guard(): Promise<string | null> {
  const jar = await cookies();
  const companyToken = jar.get('qnbang_company')?.value;
  const dashboardToken = jar.get('qnbang_auth')?.value;
  const companyAllowed = Boolean(companyToken && process.env.COMPANY_TOKEN && companyToken === process.env.COMPANY_TOKEN);
  const dashboardAllowed = Boolean(dashboardToken && process.env.AUTH_TOKEN && dashboardToken === process.env.AUTH_TOKEN);
  if (!companyAllowed && !dashboardAllowed) return '운영 대시보드 로그인이 필요합니다';
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

function 자동분류(상대: string, 거래구분: string, 금액: number) {
  const text = `${상대} ${거래구분}`.toLowerCase();
  const rules = [
    { words: ['급여', '인건비'], category: '인건비', confidence: 0.94 },
    { words: ['세무', '세금', '국세', '지방세'], category: '세금·세무', confidence: 0.93 },
    { words: ['어도비', 'adobe', '구글', 'google', 'openai', 'anthropic', 'claude'], category: '소프트웨어', confidence: 0.9 },
    { words: ['통신', 'kt', 'skt', 'lg유플러스'], category: '통신비', confidence: 0.9 },
    { words: ['카카오페이', '네이버페이', '배달', '식당', '카페'], category: '업무경비', confidence: 0.72 },
  ];
  if (금액 > 0) return { category: '매출·입금', confidence: 상대 ? 0.72 : 0.45 };
  const matched = rules.find((rule) => rule.words.some((word) => text.includes(word)));
  return matched ? { category: matched.category, confidence: matched.confidence } : { category: '미분류', confidence: 0.35 };
}

async function 정산확인대기추가(items: { id: string; date: string; counterparty: string; income: number; expense: number; category: string; confidence: number }[]) {
  if (!items.length) return 0;
  const sheets = api();
  const current = await sheets.spreadsheets.values.get({ spreadsheetId: OPERATING_SHEET_ID, range: "'정산확인대기'!A:M" });
  const currentRows = current.data.values || [];
  const existing = new Set(currentRows.map((row) => String(row[0] || '')));
  const 시간키 = (value: unknown) => String(value || '').replace(/[^0-9]/g, '').slice(0, 12);
  const 새거래: typeof items = [];
  for (const item of items) {
    if (existing.has(item.id)) continue;
    const matches = currentRows.map((row, index) => ({ row, index })).filter(({ row }) =>
      String(row[0] || '').startsWith('sms-') && 시간키(row[1]) === 시간키(item.date)
      && Number(row[3] || 0) === item.income && Number(row[4] || 0) === item.expense,
    );
    if (matches.length === 1) {
      const match = matches[0];
      await sheets.spreadsheets.values.update({
        spreadsheetId: OPERATING_SHEET_ID,
        range: `'정산확인대기'!A${match.index + 1}:M${match.index + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[item.id, item.date, item.counterparty, item.income || '', item.expense || '', item.category, `${Math.round(item.confidence * 100)}%`, '', '', '확인 필요', '', '', '통장 파일 + 문자 대조']] },
      });
      existing.add(item.id);
    } else {
      새거래.push(item);
    }
  }
  const rows = 새거래.map((item) => [
    item.id, item.date, item.counterparty, item.income || '', item.expense || '', item.category,
    `${Math.round(item.confidence * 100)}%`, '', '', '확인 필요', '', '', '카카오뱅크 거래내역 업로드',
  ]);
  if (!rows.length) return 0;
  await sheets.spreadsheets.values.append({
    spreadsheetId: OPERATING_SHEET_ID,
    range: "'정산확인대기'!A:M",
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });
  return rows.length;
}

export async function POST(req: Request) {
  const err = await guard();
  if (err) return NextResponse.json({ ok: false, error: err }, { status: 401 });
  try {
    const fd = await req.formData();
    const f = fd.get('file');
    if (!(f instanceof File)) return NextResponse.json({ ok: false, error: '파일이 없습니다' }, { status: 400 });
    const buf = Buffer.from(await f.arrayBuffer());

    let dec: Buffer;
    try {
      dec = await decrypt(buf, { password: XLSX_PW });
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
    const cDirection = col('구분'), cKind = col('거래구분'), cContent = col('내용'), cMemo = col('메모');
    const num = (v: unknown) => Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;

    const tx = rows.slice(hi + 1)
      .filter((r) => r && String(r[cDate] ?? '').match(/^\d{4}\./))
      .map((r) => {
        const 방향 = cDirection >= 0 ? String(r[cDirection] ?? '') : '';
        const 원금액 = num(r[cAmt]);
        const 금액 = 방향.includes('출금') ? -Math.abs(원금액) : 방향.includes('입금') ? Math.abs(원금액) : 원금액;
        const 거래구분 = cKind >= 0 ? String(r[cKind] ?? '') : '';
        const 상대 = [cContent >= 0 ? r[cContent] : '', cMemo >= 0 ? r[cMemo] : ''].map((value) => String(value ?? '').trim()).filter(Boolean).join(' · ');
        const id = createHash('sha256').update([r[cDate], 금액, r[cBal], 거래구분, 상대].join('|')).digest('hex').slice(0, 20);
        return { 일시: String(r[cDate]), 금액, 잔액: num(r[cBal]), 거래구분, 상대, id };
      });
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

    const 확인대기건수 = await 정산확인대기추가(tx.map((item) => {
      const 분류 = 자동분류(item.상대, item.거래구분, item.금액);
      return { id: item.id, date: item.일시, counterparty: item.상대, income: item.금액 > 0 ? item.금액 : 0, expense: item.금액 < 0 ? -item.금액 : 0, category: 분류.category, confidence: 분류.confidence };
    }));
    await setBalance('통장잔고', last.잔액, 기준일);
    return NextResponse.json({ ok: true, 잔액: last.잔액, 기준일, 건수: tx.length, 이번달입금, 이번달출금, 확인대기건수 });
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
