import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { invalidateSheets } from '@/lib/sheetCache';

export const dynamic = 'force-dynamic';

const SHEET_ID = process.env.SHEET_ID;
const SA_JSON = process.env.GOOGLE_SA_JSON;

function api() {
  const sa = JSON.parse(SA_JSON!);
  const auth = new google.auth.JWT({ email: sa.client_email, key: sa.private_key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}

// 헤더: 계약일, 계약명, 클라이언트, 계약금액, 부가세, 입금상태, 입금일, 입금예정일, 입금액, 순매출, 비고
function toRow(d: Record<string, string | number>) {
  const amt = Number(d['입금액']) || 0;
  return [
    d['계약일'] || '',
    d['계약명'] || '',
    d['클라이언트'] || '',
    d['계약금액'] !== undefined ? String(d['계약금액']) : String(amt),
    '', // 부가세
    d['입금상태'] || '입금완료',
    d['입금일'] || '',
    '', // 입금예정일
    String(amt),
    d['순매출'] !== undefined ? String(d['순매출']) : String(amt),
    d['비고'] || '',
  ];
}

// POST: 새 매출 행 추가
export async function POST(req: Request) {
  try {
    if (!SHEET_ID || !SA_JSON) return NextResponse.json({ ok: false, error: '설정 누락' }, { status: 500 });
    const body = await req.json().catch(() => ({}));
    const sheets = api();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID!, range: '매출!A1',
      valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [toRow(body)] },
    });
    invalidateSheets();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// PATCH: 기존 행 업데이트 { rowNum, ...fields }
export async function PATCH(req: Request) {
  try {
    if (!SHEET_ID || !SA_JSON) return NextResponse.json({ ok: false, error: '설정 누락' }, { status: 500 });
    const body = await req.json().catch(() => ({}));
    const { rowNum } = body;
    if (!rowNum) return NextResponse.json({ ok: false, error: 'rowNum 필요' }, { status: 400 });
    const sheets = api();
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID!, range: `매출!A${rowNum}:K${rowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [toRow(body)] },
    });
    invalidateSheets();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// DELETE: 행 삭제 { rowNum }
export async function DELETE(req: Request) {
  try {
    if (!SHEET_ID || !SA_JSON) return NextResponse.json({ ok: false, error: '설정 누락' }, { status: 500 });
    const { rowNum } = await req.json().catch(() => ({}));
    if (!rowNum) return NextResponse.json({ ok: false, error: 'rowNum 필요' }, { status: 400 });
    const sheets = api();
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID!, fields: 'sheets.properties' });
    const sh = (meta.data.sheets || []).find((s) => s.properties?.title === '매출');
    if (!sh) return NextResponse.json({ ok: false, error: '매출 탭 없음' }, { status: 404 });
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID!,
      requestBody: { requests: [{ deleteDimension: { range: {
        sheetId: sh.properties!.sheetId!,
        dimension: 'ROWS', startIndex: rowNum - 1, endIndex: rowNum,
      }}}]},
    });
    invalidateSheets();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
