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

function 열문자(번호: number) {
  let 결과 = '';
  for (let 값 = 번호 + 1; 값 > 0; 값 = Math.floor((값 - 1) / 26)) 결과 = String.fromCharCode(((값 - 1) % 26) + 65) + 결과;
  return 결과;
}

export async function GET() {
  const spreadsheetId = process.env.OPERATING_INBOX_SHEET_ID || '1RnmSplWT2-Aqk-flDInpWMljKwBbUes1q6pab9j3dfo';

  try {
    const serviceAccount = JSON.parse(process.env.GOOGLE_SA_JSON || '');
    const auth = new google.auth.JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
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

export async function PATCH(request: Request) {
  const spreadsheetId = process.env.OPERATING_INBOX_SHEET_ID || '1RnmSplWT2-Aqk-flDInpWMljKwBbUes1q6pab9j3dfo';
  try {
    const body = await request.json();
    const inboxId = String(body.inboxId || '').trim();
    const taskId = String(body.taskId || '').trim();
    if (!inboxId || !taskId) return NextResponse.json({ ok: false, error: '수신 기록과 할 일 ID가 필요합니다.' }, { status: 400 });
    const serviceAccount = JSON.parse(process.env.GOOGLE_SA_JSON || '');
    const auth = new google.auth.JWT({ email: serviceAccount.client_email, key: serviceAccount.private_key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: '수신연결!A:Z' });
    const [header = [], ...rows] = (response.data.values as unknown[][]) || [];
    const idColumn = header.findIndex((value) => ['수신ID', '메시지ID'].includes(String(value)));
    const taskColumn = header.findIndex((value) => String(value) === '할일ID');
    const statusColumn = header.findIndex((value) => String(value) === '처리상태');
    const rowIndex = rows.findIndex((row) => String(row[idColumn] || '') === inboxId);
    if (idColumn < 0 || taskColumn < 0 || statusColumn < 0 || rowIndex < 0) throw new Error('수신 원장에서 연결할 기록을 찾지 못했습니다.');
    await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: 'RAW', data: [
      { range: `수신연결!${열문자(taskColumn)}${rowIndex + 2}`, values: [[taskId]] },
      { range: `수신연결!${열문자(statusColumn)}${rowIndex + 2}`, values: [['할 일 등록됨']] },
    ] } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : '수신 기록을 할 일과 연결하지 못했습니다.' }, { status: 500 });
  }
}
