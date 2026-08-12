import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

const 통합인덱스ID = '1RnmSplWT2-Aqk-flDInpWMljKwBbUes1q6pab9j3dfo';

function 시트ID(주소: string) {
  return 주소.match(/\/d\/([\w-]+)/)?.[1] || '';
}

function 열문자(번호: number) {
  let 결과 = '';
  for (let 값 = 번호 + 1; 값 > 0; 값 = Math.floor((값 - 1) / 26)) 결과 = String.fromCharCode(((값 - 1) % 26) + 65) + 결과;
  return 결과;
}

async function 프로젝트원장(projectId: string) {
  const 서비스계정 = JSON.parse(process.env.GOOGLE_SA_JSON || '');
  const auth = new google.auth.JWT({
    email: 서비스계정.client_email,
    key: 서비스계정.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const 인덱스 = await sheets.spreadsheets.values.get({ spreadsheetId: 통합인덱스ID, range: '프로젝트!A:Z' });
  const [헤더 = [], ...행] = 인덱스.data.values || [];
  const 번호 = Object.fromEntries(헤더.map((항목, index) => [String(항목), index]));
  const 대상 = 행.find((row) => String(row[번호['프로젝트ID']] || '') === projectId);
  const 원장주소 = 대상 ? String(대상[번호['프로젝트 운영원장']] || 대상[번호['원장링크']] || '') : '';
  const 원장ID = 시트ID(원장주소) || (대상 ? String(대상[번호['원장시트ID']] || '') : '');
  if (!원장ID) throw new Error('이 프로젝트의 운영원장이 연결되지 않았습니다.');
  return { sheets, 원장ID };
}

function 헤더번호(헤더: string[], 후보: string[]) {
  return 후보.map((이름) => 헤더.indexOf(이름)).find((index) => index >= 0) ?? -1;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const projectId = String(body.projectId || '').trim();
    const title = String(body.title || '').trim();
    const owner = String(body.owner || '담당 확인 필요').trim();
    const source = String(body.source || '운영OS 대시보드').trim();
    if (!projectId || !title) return NextResponse.json({ ok: false, error: '프로젝트와 할 일 제목이 필요합니다.' }, { status: 400 });

    const { sheets, 원장ID } = await 프로젝트원장(projectId);
    const 원장 = await sheets.spreadsheets.values.get({ spreadsheetId: 원장ID, range: '할일!A:Z' });
    const [헤더행 = [], ...기존행] = 원장.data.values || [];
    const 헤더 = 헤더행.map(String);
    const id열 = 헤더번호(헤더, ['할일ID', 'ID']);
    const 제목열 = 헤더번호(헤더, ['할 일', '제목']);
    const 상태열 = 헤더번호(헤더, ['상태']);
    if (id열 < 0 || 제목열 < 0 || 상태열 < 0) throw new Error('운영원장의 할 일 표 형식을 확인하지 못했습니다.');
    const 값 = Array(헤더.length).fill('');
    const taskId = `${projectId}-T-${randomUUID().slice(0, 8)}`;
    값[id열] = taskId;
    값[제목열] = title;
    값[상태열] = '진행 중';
    const 담당열 = 헤더번호(헤더, ['담당']);
    const 프로젝트열 = 헤더번호(헤더, ['프로젝트ID']);
    const 출처열 = 헤더번호(헤더, ['출처']);
    const 생성열 = 헤더번호(헤더, ['생성시각']);
    const 기존 = 출처열 >= 0 ? 기존행.find((row) => String(row[출처열] || '') === source) : undefined;
    if (기존) return NextResponse.json({ ok: true, task: { id: String(기존[id열] || ''), title: String(기존[제목열] || title), owner: 담당열 >= 0 ? String(기존[담당열] || owner) : owner, state: String(기존[상태열] || '진행 중') }, reused: true });
    if (담당열 >= 0) 값[담당열] = owner;
    if (프로젝트열 >= 0) 값[프로젝트열] = projectId;
    if (출처열 >= 0) 값[출처열] = source;
    if (생성열 >= 0) 값[생성열] = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    await sheets.spreadsheets.values.append({ spreadsheetId: 원장ID, range: '할일!A:Z', valueInputOption: 'USER_ENTERED', requestBody: { values: [값] } });
    return NextResponse.json({ ok: true, task: { id: taskId, title, owner, state: '진행 중', ledgerProjectId: projectId } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : '할 일을 기록하지 못했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const projectId = String(body.projectId || '').trim();
    const taskId = String(body.taskId || '').trim();
    if (!projectId || !taskId) return NextResponse.json({ ok: false, error: '프로젝트와 할 일 ID가 필요합니다.' }, { status: 400 });
    const { sheets, 원장ID } = await 프로젝트원장(projectId);
    const 원장 = await sheets.spreadsheets.values.get({ spreadsheetId: 원장ID, range: '할일!A:Z' });
    const [헤더행 = [], ...행] = 원장.data.values || [];
    const 헤더 = 헤더행.map(String);
    const id열 = 헤더번호(헤더, ['할일ID', 'ID']);
    const 상태열 = 헤더번호(헤더, ['상태']);
    const 행번호 = 행.findIndex((row) => String(row[id열] || '') === taskId);
    if (id열 < 0 || 상태열 < 0 || 행번호 < 0) throw new Error('완료 처리할 할 일을 운영원장에서 찾지 못했습니다.');
    await sheets.spreadsheets.values.update({ spreadsheetId: 원장ID, range: `할일!${열문자(상태열)}${행번호 + 2}`, valueInputOption: 'USER_ENTERED', requestBody: { values: [['완료']] } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : '완료 처리하지 못했습니다.' }, { status: 500 });
  }
}
