import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const indexSpreadsheetId = '1f0wLIWvGomhLpn9Atkulln6Oew2TUvrEOjRQC5p9fDI';
const projectId = 'good-movement-running';

function toRows(rows: unknown[][]) {
  const [header = [], ...body] = rows;
  return body.map((row) => Object.fromEntries(header.map((key, index) => [String(key), String(row[index] ?? '')])));
}

export async function GET() {
  try {
    const sa = JSON.parse(process.env.GOOGLE_SA_JSON || '');
    const auth = new google.auth.JWT({ email: sa.client_email, key: sa.private_key, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
    const sheets = google.sheets({ version: 'v4', auth });
    const index = await sheets.spreadsheets.values.get({ spreadsheetId: indexSpreadsheetId, range: '프로젝트인덱스!A:G' });
    const projectRow = (index.data.values || []).slice(1).find((row) => row[0] === projectId);
    const spreadsheetId = projectRow?.[5];
    if (!spreadsheetId) return NextResponse.json({ error: '운영OS 프로젝트 원장을 찾지 못했습니다.' }, { status: 404 });
    const response = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges: ['개요!A:B', '문서세트!A:E', '할일!A:F'] });
    const values = response.data.valueRanges?.map((range) => (range.values as unknown[][]) || []) || [];
    const overview = Object.fromEntries((values[0] || []).slice(1).map((row) => [String(row[0] ?? ''), String(row[1] ?? '')]));
    const documents = toRows(values[1] || []).map((row) => ({ name: row['문서명'], status: row['상태'], review: row['검토 포인트'] }));
    const tasks = toRows(values[2] || []).map((row) => ({ title: row['제목'], status: row['상태'], owner: row['담당'] }));
    return NextResponse.json({ overview, documents, tasks, spreadsheetId });
  } catch {
    return NextResponse.json({ error: '운영OS 원장을 읽지 못했습니다.' }, { status: 503 });
  }
}
