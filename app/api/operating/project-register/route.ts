import { Readable } from 'node:stream';
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

const 통합인덱스ID = '1RnmSplWT2-Aqk-flDInpWMljKwBbUes1q6pab9j3dfo';
const 사용자메일 = 'chairlie92.biz@gmail.com';
const 탭 = [
  ['개요', ['항목', '내용']],
  ['진행', ['진행ID', '진행 묶음명', '만들 결과', '상태', '담당', '다음 행동', '마감 또는 확인 시점', '문서·자료 링크']],
  ['할일', ['할일ID', '할 일', '상태', '담당', '연결 진행', '마감', '출처', '생성시각']],
  ['결정', ['결정ID', '결정', '이유', '결정자', '시각']],
  ['일정', ['일정ID', '일정명', '시작', '종료', '담당', '메모']],
  ['이력', ['시각', '내용', '기록자']],
  ['링크', ['링크ID', '이름', '용도', 'URL', '연결 진행']],
] as const;

function 안전한이름(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
}

function 행값(header: unknown[], values: Record<string, string>) {
  return header.map((key) => values[String(key)] || '');
}

function 사용자구글인증() {
  const root = process.env.GOOGLE_USER_OAUTH_DIR || join(homedir(), 'Documents', 'QNB_work', '.tools', 'google-oauth');
  const clientJson = JSON.parse(readFileSync(`${root}/client_secret.json`, 'utf8'));
  const token = JSON.parse(readFileSync(`${root}/token.json`, 'utf8'));
  const client = clientJson.installed || clientJson.web;
  const auth = new google.auth.OAuth2(client.client_id, client.client_secret, client.redirect_uris?.[0]);
  auth.setCredentials(token);
  auth.on('tokens', (next) => {
    if (!next.refresh_token) return;
    const { access_token: _access, id_token: _id, ...safe } = { ...token, ...next };
    void _access; void _id;
    // ponytail: 갱신 토큰이 바뀔 때만 기존 로컬 파일에 덮어쓴다. Drive·Git에는 쓰지 않는다.
    writeFileSync(`${root}/token.json`, JSON.stringify(safe, null, 2), { mode: 0o600 });
  });
  return auth;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = 안전한이름(String(body.name || ''));
    const client = 안전한이름(String(body.client || ''));
    const owner = 안전한이름(String(body.owner || '신종호')) || '신종호';
    const goal = String(body.goal || '').trim();
    const evidenceType = String(body.evidenceType || '').trim();
    const evidenceUrl = String(body.evidenceUrl || '').trim();
    if (!name || !client) return NextResponse.json({ ok: false, error: '프로젝트명과 거래상대가 필요합니다.' }, { status: 400 });
    if (!['서명 계약서', '발주서', '착수금 입금', '명시적 착수 승인'].includes(evidenceType) || !/^https?:\/\//.test(evidenceUrl)) return NextResponse.json({ ok: false, error: '계약·발주·착수금·명시적 착수 승인 중 하나와 확인 가능한 링크가 있어야 프로젝트를 만들 수 있습니다.' }, { status: 400 });
    const auth = 사용자구글인증();
    const drive = google.drive({ version: 'v3', auth });
    const sheets = google.sheets({ version: 'v4', auth });
    const index = await sheets.spreadsheets.values.get({ spreadsheetId: 통합인덱스ID, range: "'프로젝트'!A:Z" });
    const [header = [], ...rows] = index.data.values || [];
    const column = Object.fromEntries(header.map((item, position) => [String(item), position]));
    if (rows.some((row) => String(row[column['프로젝트명']] || '').replace(/^\d{3}_/, '').trim() === name)) return NextResponse.json({ ok: false, error: '같은 이름의 프로젝트가 이미 중앙 원장에 있습니다.' }, { status: 409 });
    const nextNumber = Math.max(0, ...rows.map((row) => Number(String(row[column['프로젝트ID']] || '').match(/^P-(\d+)$/)?.[1] || 0))) + 1;
    const number = String(nextNumber).padStart(3, '0');
    const projectId = `P-${number}`;
    const folderName = `${number}_${name}`;

    const roots = await drive.files.list({ q: "name='큐앤뱅 뉴 대시보드' and mimeType='application/vnd.google-apps.folder' and trashed=false", fields: 'files(id)' });
    const rootId = roots.data.files?.[0]?.id;
    if (!rootId) throw new Error('큐앤뱅 뉴 대시보드 폴더를 찾지 못했습니다.');
    const projectRoots = await drive.files.list({ q: `'${rootId}' in parents and name='01_프로젝트' and mimeType='application/vnd.google-apps.folder' and trashed=false`, fields: 'files(id)' });
    const projectRootId = projectRoots.data.files?.[0]?.id;
    if (!projectRootId) throw new Error('01_프로젝트 폴더를 찾지 못했습니다.');
    const existingFolder = await drive.files.list({ q: `'${projectRootId}' in parents and name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`, fields: 'files(id)' });
    const projectFolderId = existingFolder.data.files?.[0]?.id || (await drive.files.create({ requestBody: { name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [projectRootId] }, fields: 'id' })).data.id;
    if (!projectFolderId) throw new Error('프로젝트 폴더를 만들지 못했습니다.');
    for (const child of ['01_자료', '02_제작', '03_결과물']) {
      const found = await drive.files.list({ q: `'${projectFolderId}' in parents and name='${child}' and mimeType='application/vnd.google-apps.folder' and trashed=false`, fields: 'files(id)' });
      if (!found.data.files?.length) await drive.files.create({ requestBody: { name: child, mimeType: 'application/vnd.google-apps.folder', parents: [projectFolderId] }, fields: 'id' });
    }

    const created = await sheets.spreadsheets.create({ requestBody: { properties: { title: `${folderName} 프로젝트 운영원장` }, sheets: 탭.map(([title]) => ({ properties: { title } })) }, fields: 'spreadsheetId,spreadsheetUrl,sheets.properties' });
    const spreadsheetId = created.data.spreadsheetId;
    const spreadsheetUrl = created.data.spreadsheetUrl;
    if (!spreadsheetId || !spreadsheetUrl) throw new Error('프로젝트 운영원장을 만들지 못했습니다.');
    await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: 'USER_ENTERED', data: [
      ...탭.map(([title, headers]) => ({ range: `'${title}'!A1`, values: [[...headers]] })),
      { range: "'개요'!A2", values: [['프로젝트ID', projectId], ['프로젝트명', folderName], ['거래상대', client], ['상태', '진행 중'], ['담당', owner], ['목표', goal], ['착수 근거', evidenceType], ['착수 근거 링크', evidenceUrl], ['다음 행동', '첫 진행 묶음과 할 일을 등록'], ['막힘', '']] },
      { range: "'이력'!A2", values: [[new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }), '대시보드에서 새 프로젝트 등록', owner]] },
      { range: "'링크'!A2", values: [[`${projectId}-L-001`, '파일 원본 보관소', '파일 원본 보관소', `https://drive.google.com/drive/folders/${projectFolderId}`, ''], [`${projectId}-L-002`, evidenceType, '프로젝트 착수 근거', evidenceUrl, '프로젝트 공통']] },
    ] } });
    const parents = await drive.files.get({ fileId: spreadsheetId, fields: 'parents' });
    await drive.files.update({ fileId: spreadsheetId, addParents: projectFolderId, removeParents: (parents.data.parents || []).join(','), fields: 'id' });
    await drive.permissions.create({ fileId: spreadsheetId, requestBody: { type: 'user', role: 'writer', emailAddress: 사용자메일 }, sendNotificationEmail: false });

    const json = JSON.stringify({ 이름: name, 분류: '대행', 고객사: client, 담당자: owner, 착수일: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }), 착수근거: evidenceType, 착수근거링크: evidenceUrl, 진행상태: '진행 중', driveFolderId: projectFolderId }, null, 2);
    const files = [
      ['프로젝트.json', json, 'application/json'],
      ['0_작업로그.md', `# ${name} 작업로그\n\n${new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })} · 대시보드에서 프로젝트 생성 · 첫 진행 묶음과 할 일 등록 필요 · Codex\n`, 'text/markdown'],
      ['현황판.md', `# ${name}\n\n- 상태: 진행 중\n- 거래상대: ${client}\n- 담당: ${owner}\n- 목표: ${goal || '등록 필요'}\n- 다음 행동: 첫 진행 묶음과 할 일 등록\n`, 'text/markdown'],
    ] as const;
    for (const [fileName, content, mimeType] of files) await drive.files.create({ requestBody: { name: fileName, parents: [projectFolderId] }, media: { mimeType, body: Readable.from(content) }, fields: 'id' });

    const values = { 프로젝트ID: projectId, 프로젝트명: folderName, 고객사: client, 구분: '대행', 상태: '진행 중', 담당: owner, 보관상태: '활성', '드라이브 폴더': `https://drive.google.com/drive/folders/${projectFolderId}`, '프로젝트 운영원장': spreadsheetUrl, 원장링크: spreadsheetUrl, 원장시트ID: spreadsheetId };
    await sheets.spreadsheets.values.append({ spreadsheetId: 통합인덱스ID, range: "'프로젝트'!A:Z", valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: [행값(header, values)] } });
    return NextResponse.json({ ok: true, project: { id: projectId, name: folderName, client, owner, status: '진행 중', lifecycle: '현재 진행', driveUrl: values['드라이브 폴더'], spreadsheetId, next: '첫 진행 묶음과 할 일을 등록', progress: 0 } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : '새 프로젝트를 만들지 못했습니다.' }, { status: 500 });
  }
}
