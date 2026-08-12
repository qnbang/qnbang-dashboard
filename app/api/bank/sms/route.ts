import { NextResponse } from 'next/server';
import { invalidateSheets } from '@/lib/sheetCache';
import { sheetsWriteClient } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

const SHEET_ID = process.env.SHEET_ID;
const OPERATING_SHEET_ID = '1RnmSplWT2-Aqk-flDInpWMljKwBbUes1q6pab9j3dfo';
const SA_JSON = process.env.GOOGLE_SA_JSON;
const TOKEN = process.env.BANK_SMS_TOKEN;
const api = sheetsWriteClient;

type ContractRow = {
  row: number;
  name: string;
  client: string;
  total: number;
  paid: number;
  status: string;
  note: string;
};

const num = (v: unknown) => Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;
const clean = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');

function parse(text: string) {
  if (!text.includes('[카카오뱅크]')) return null;
  const lines = text.split(/\r?\n/).map((v) => v.trim()).filter(Boolean);
  const dateAt = lines.findIndex((v) => /^\d{2}\/\d{2}\s+\d{2}:\d{2}$/.test(v));
  if (dateAt < 0) return null;
  const transaction = lines[dateAt + 1]?.match(/^(입금|출금)\s*([\d,]+)원$/);
  if (!transaction) return null;
  const [month, day] = lines[dateAt].slice(0, 5).split('/').map(Number);
  const time = lines[dateAt].slice(6);
  return {
    date: `${new Date().getFullYear()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${time}`,
    kind: transaction[1],
    amount: Number(transaction[2].replace(/,/g, '')),
    sender: lines[dateAt + 2] || '',
  };
}

async function 문자거래기록(sheets: ReturnType<typeof api>, id: string, parsed: NonNullable<ReturnType<typeof parse>>) {
  const transactionId = `sms-${id}`;
  const current = await sheets.spreadsheets.values.get({ spreadsheetId: OPERATING_SHEET_ID, range: "'정산확인대기'!A:A" });
  if ((current.data.values || []).flat().some((value) => String(value) === transactionId)) return;
  await sheets.spreadsheets.values.append({
    spreadsheetId: OPERATING_SHEET_ID,
    range: "'정산확인대기'!A:M",
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[
      transactionId, parsed.date, parsed.sender, parsed.kind === '입금' ? parsed.amount : '', parsed.kind === '출금' ? parsed.amount : '',
      parsed.kind === '입금' ? '매출·입금' : '미분류', parsed.kind === '입금' ? '72%' : '35%', '', '', '확인 필요', '', '', '카카오뱅크 문자 알림',
    ]] },
  });
}

export async function POST(req: Request) {
  if (!TOKEN || req.headers.get('authorization') !== `Bearer ${TOKEN}`) {
    return NextResponse.json({ ok: false, error: '인증 실패' }, { status: 401 });
  }
  if (!SHEET_ID || !SA_JSON) return NextResponse.json({ ok: false, error: '시트 설정 누락' }, { status: 500 });

  try {
    const body = await req.json();
    const id = String(body.id || '').trim();
    const parsed = parse(String(body.text || ''));
    if (!id || !parsed) return NextResponse.json({ ok: false, error: '카카오뱅크 SMS 형식이 아닙니다' }, { status: 400 });
    const sheets = api();
    await 문자거래기록(sheets, id, parsed);
    if (parsed.kind !== '입금') return NextResponse.json({ ok: true, result: '출금 확인 대기 등록', transaction: parsed });

    const read = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: '매출!A1:K', valueRenderOption: 'FORMATTED_VALUE' });
    const values = read.data.values || [];
    const header = values[0] || [];
    const col = (name: string) => header.findIndex((v) => String(v).trim() === name);
    const cName = col('계약명'), cClient = col('클라이언트'), cTotal = col('계약금액');
    const cStatus = col('입금상태'), cPaid = col('입금액'), cDate = col('입금일'), cNote = col('비고');
    if ([cName, cTotal, cStatus, cPaid, cDate, cNote].some((v) => v < 0)) {
      return NextResponse.json({ ok: false, error: '매출 원장 열 구성이 맞지 않습니다' }, { status: 500 });
    }

    const marker = `자동(SMS:${id})`;
    const rows: ContractRow[] = values.slice(1).map((r, i) => ({
      row: i + 2, name: String(r[cName] || ''), client: cClient >= 0 ? String(r[cClient] || '') : '',
      total: num(r[cTotal]), paid: num(r[cPaid]), status: String(r[cStatus] || ''), note: String(r[cNote] || ''),
    }));
    if (rows.some((r) => r.note.includes(marker))) return NextResponse.json({ ok: true, result: '이미 반영됨' });

    const sender = clean(parsed.sender);
    const candidates = rows.filter((r) => {
      const remaining = r.total - r.paid;
      return remaining === parsed.amount && remaining > 0 && r.status !== '입금완료';
    });
    const named = sender ? candidates.filter((r) => {
      const name = clean(r.name), client = clean(r.client);
      return (name && (name.includes(sender) || sender.includes(name))) || (client && (client.includes(sender) || sender.includes(client)));
    }) : [];
    const matched = named.length === 1 ? named : (named.length === 0 && candidates.length === 1 ? candidates : []);

    if (matched.length !== 1) {
      return NextResponse.json({ ok: true, result: '확인 필요', reason: candidates.length ? '같은 금액의 미수 계약이 여러 건입니다' : '일치하는 미수 계약이 없습니다', transaction: parsed });
    }

    const target = matched[0];
    const nextNote = [target.note, marker, `입금자:${parsed.sender}`].filter(Boolean).join(' · ');
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { valueInputOption: 'USER_ENTERED', data: [
        { range: `매출!F${target.row}`, values: [['입금완료']] },
        { range: `매출!G${target.row}`, values: [[parsed.date]] },
        { range: `매출!I${target.row}`, values: [[String(parsed.amount)]] },
        { range: `매출!K${target.row}`, values: [[nextNote]] },
      ] },
    });
    invalidateSheets();
    return NextResponse.json({ ok: true, result: '자동 반영', contract: target.name, transaction: parsed });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
