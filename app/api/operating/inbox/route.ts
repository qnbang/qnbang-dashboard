import { NextResponse } from 'next/server';
import { google } from 'googleapis';

type 수신행 = Record<string, string>;

function 행으로바꾸기(rows: unknown[][]): 수신행[] {
  const [header = [], ...body] = rows;
  return body.map((row) => Object.fromEntries(header.map((key, index) => [String(key), String(row[index] ?? '')])));
}

function 수신시각값(value: string) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export async function GET() {
  const spreadsheetId = process.env.OPERATING_INBOX_SHEET_ID;
  if (!spreadsheetId) {
    return NextResponse.json({
      items: [],
      status: '연결 대기',
      message: '통합 수신 원장 주소가 아직 연결되지 않았습니다.',
    });
  }

  try {
    const serviceAccount = JSON.parse(process.env.GOOGLE_SA_JSON || '');
    const auth = new google.auth.JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: '수신연결!A:Z' });
    const items = 행으로바꾸기((response.data.values as unknown[][]) || [])
      .map((row) => ({
        id: row['수신ID'] || row['메시지ID'],
        channel: row['채널'] || '기타',
        messageId: row['메시지ID'],
        sender: row['보낸이'] || '보낸이 미상',
        body: row['본문'],
        receivedAt: row['수신시각'],
        customer: row['고객명'] || row['고객ID'] || '연결 전',
        project: row['프로젝트명'] || row['프로젝트ID'] || '연결 전',
        taskId: row['할일ID'],
        status: row['처리상태'] || '확인 전',
        originalLink: row['원문링크'],
        time: row['수신시각'],
        action: row['추천 다음 행동'] || '원문을 확인한 뒤 기존 OS의 할 일로 등록',
      }))
      .filter((item) => item.id && item.body)
      .sort((a, b) => 수신시각값(b.receivedAt) - 수신시각값(a.receivedAt));

    return NextResponse.json({ items, status: '연결됨' });
  } catch {
    return NextResponse.json({ items: [], status: '오류', message: '통합 수신 원장을 읽지 못했습니다.' }, { status: 503 });
  }
}
