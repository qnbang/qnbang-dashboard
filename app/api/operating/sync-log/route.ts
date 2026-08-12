import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

const 통합인덱스ID = '1RnmSplWT2-Aqk-flDInpWMljKwBbUes1q6pab9j3dfo';

export async function GET() {
  try {
    const 서비스계정 = JSON.parse(process.env.GOOGLE_SA_JSON || '');
    const auth = new google.auth.JWT({
      email: 서비스계정.client_email,
      key: 서비스계정.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: 통합인덱스ID, range: '동기화기록!A:Z' });
    const [header = [], ...rows] = response.data.values || [];
    const column = Object.fromEntries(header.map((item, index) => [String(item), index]));
    const items = rows.map((row) => ({
      id: String(row[column['기록ID']] || ''),
      date: String(row[column['시각']] || ''),
      area: String(row[column['대상']] || ''),
      direction: String(row[column['방향']] || ''),
      status: String(row[column['상태']] || ''),
      count: String(row[column['처리건수']] || ''),
      error: String(row[column['오류']] || ''),
      actor: String(row[column['실행자']] || ''),
    })).filter((item) => item.id || item.date || item.area).reverse();
    return NextResponse.json({ ok: true, items });
  } catch {
    return NextResponse.json({ ok: false, message: '통합 운영 로그를 읽지 못했습니다.' }, { status: 503 });
  }
}
