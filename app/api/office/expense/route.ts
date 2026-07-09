import { NextResponse } from 'next/server';
import { logError, logAudit } from '@/lib/log';
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

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
const HEAD = ['날짜', '카테고리', '지출 내용', '비용', '비고', '과업 관리'];

// GET ?month=4월  → 해당 월 지출 목록
export async function GET(req: Request) {
  try {
    if (!SHEET_ID || !SA_JSON) return NextResponse.json({ ok: false, error: '설정 누락' }, { status: 500 });
    const month = new URL(req.url).searchParams.get('month') || '';
    if (!MONTHS.includes(month)) return NextResponse.json({ ok: false, error: '월 파라미터 필요 (예: 4월)' }, { status: 400 });

    const sheets = api();
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID!, range: month, valueRenderOption: 'FORMATTED_VALUE' });
    const rows = (res.data.values || []).slice(1); // 헤더 제외
    const items = rows.map((r, i) => ({
      _row: i + 2, // 시트 행 번호 (헤더=1, 데이터 시작=2)
      날짜: String(r[0] ?? ''),
      카테고리: String(r[1] ?? ''),
      지출내용: String(r[2] ?? ''),
      비용: Number(String(r[3] ?? '').replace(/[^0-9]/g, '')) || 0,
      비고: String(r[4] ?? ''),
    })).filter((it) => it.날짜 || it.지출내용);
    return NextResponse.json({ ok: true, month, items });
  } catch (e) {
    logError('/api/office/expense', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// POST { month, 날짜, 카테고리, 지출내용, 비용, 비고 }  → 행 추가
export async function POST(req: Request) {
  try {
    if (!SHEET_ID || !SA_JSON) return NextResponse.json({ ok: false, error: '설정 누락' }, { status: 500 });
    const { month, 날짜, 카테고리, 지출내용, 비용, 비고 } = await req.json().catch(() => ({}));
    if (!MONTHS.includes(month)) return NextResponse.json({ ok: false, error: '월 필요' }, { status: 400 });
    if (!지출내용 || !비용) return NextResponse.json({ ok: false, error: '내용·비용 필요' }, { status: 400 });

    const sheets = api();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID!, range: `${month}!A1`,
      valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [[날짜 || '', 카테고리 || '', 지출내용, String(비용), 비고 || '', '']] },
    });
    invalidateSheets();
    logAudit('/api/office/expense', '지출 추가', { month, 카테고리, 지출내용, 비용 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    logError('/api/office/expense', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// PATCH { month, rowNum, 날짜, 카테고리, 지출내용, 비용, 비고 } → 행 업데이트
export async function PATCH(req: Request) {
  try {
    if (!SHEET_ID || !SA_JSON) return NextResponse.json({ ok: false, error: '설정 누락' }, { status: 500 });
    const { month, rowNum, 날짜, 카테고리, 지출내용, 비용, 비고 } = await req.json().catch(() => ({}));
    if (!MONTHS.includes(month) || !rowNum) return NextResponse.json({ ok: false, error: 'month·rowNum 필요' }, { status: 400 });
    const sheets = api();
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID!, range: `${month}!A${rowNum}:F${rowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[날짜 || '', 카테고리 || '', 지출내용 || '', String(비용 || 0), 비고 || '', '']] },
    });
    invalidateSheets();
    logAudit('/api/office/expense', '지출 수정', { month, rowNum, 카테고리, 지출내용, 비용 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    logError('/api/office/expense', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// DELETE { month, rowNum }  → 행 삭제
export async function DELETE(req: Request) {
  try {
    if (!SHEET_ID || !SA_JSON) return NextResponse.json({ ok: false, error: '설정 누락' }, { status: 500 });
    const { month, rowNum } = await req.json().catch(() => ({}));
    if (!MONTHS.includes(month) || !rowNum) return NextResponse.json({ ok: false, error: 'month·rowNum 필요' }, { status: 400 });

    const sheets = api();
    // 시트 ID 찾기
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID!, fields: 'sheets.properties' });
    const sheetObj = (meta.data.sheets || []).find((s) => s.properties?.title === month);
    if (!sheetObj) return NextResponse.json({ ok: false, error: `${month} 탭 없음` }, { status: 404 });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID!,
      requestBody: { requests: [{ deleteDimension: { range: {
        sheetId: sheetObj.properties!.sheetId!,
        dimension: 'ROWS', startIndex: rowNum - 1, endIndex: rowNum,
      }}}]},
    });
    invalidateSheets();
    logAudit('/api/office/expense', '지출 삭제', { month, rowNum });
    return NextResponse.json({ ok: true });
  } catch (e) {
    logError('/api/office/expense', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
