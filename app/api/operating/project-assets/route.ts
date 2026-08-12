import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

const 통합인덱스ID = '1RnmSplWT2-Aqk-flDInpWMljKwBbUes1q6pab9j3dfo';
const 업로드한도 = 50 * 1024 * 1024;
const 허용폴더 = new Set(['01_자료', '02_제작', '03_결과물']);

function 시트ID(주소: string) { return 주소.match(/\/d\/([\w-]+)/)?.[1] || ''; }
function 폴더ID(주소: string) { return 주소.match(/\/folders\/([\w-]+)/)?.[1] || ''; }
function 안전한이름(이름: string) { return 이름.replace(/[\\/:*?"<>|]/g, '_').trim() || '파일'; }

async function 연결정보(projectId: string) {
  const 서비스계정 = JSON.parse(process.env.GOOGLE_SA_JSON || '');
  const auth = new google.auth.JWT({ email: 서비스계정.client_email, key: 서비스계정.private_key, scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });
  const result = await sheets.spreadsheets.values.get({ spreadsheetId: 통합인덱스ID, range: '프로젝트!A:Z' });
  const [header = [], ...rows] = result.data.values || [];
  const column = Object.fromEntries(header.map((item, index) => [String(item), index]));
  const row = rows.find((item) => String(item[column['프로젝트ID']] || '') === projectId);
  if (!row) throw new Error('중앙 원장에서 프로젝트를 찾지 못했습니다.');
  const ledgerId = 시트ID(String(row[column['프로젝트 운영원장']] || row[column['원장링크']] || '')) || String(row[column['원장시트ID']] || '');
  const driveFolderId = 폴더ID(String(row[column['드라이브 폴더']] || ''));
  if (!ledgerId) throw new Error('프로젝트 운영원장이 연결되지 않았습니다.');
  return { sheets, drive, ledgerId, driveFolderId };
}

async function 링크기록(sheets: ReturnType<typeof google.sheets>, ledgerId: string, projectId: string, name: string, purpose: string, url: string) {
  const result = await sheets.spreadsheets.values.get({ spreadsheetId: ledgerId, range: '링크!A:Z' });
  const [header = [], ...rows] = result.data.values || [];
  const index = Object.fromEntries(header.map((item, position) => [String(item), position]));
  if (index['URL'] === undefined || index['이름'] === undefined) throw new Error('운영원장의 링크 표 형식을 확인하지 못했습니다.');
  const current = rows.find((row) => String(row[index['URL']] || '') === url);
  if (current) return { id: String(current[index['링크ID']] || ''), name: String(current[index['이름']] || name), purpose: String(current[index['용도']] || purpose), url, reused: true };
  const values = Array(header.length).fill('');
  const id = `${projectId}-L-${randomUUID().slice(0, 8)}`;
  if (index['링크ID'] !== undefined) values[index['링크ID']] = id;
  values[index['이름']] = name;
  if (index['용도'] !== undefined) values[index['용도']] = purpose;
  values[index['URL']] = url;
  if (index['연결 진행'] !== undefined) values[index['연결 진행']] = '프로젝트 공통';
  await sheets.spreadsheets.values.append({ spreadsheetId: ledgerId, range: '링크!A:Z', valueInputOption: 'USER_ENTERED', requestBody: { values: [values] } });
  return { id, name, purpose, url, reused: false };
}

async function 하위폴더(drive: ReturnType<typeof google.drive>, parentId: string, name: string) {
  const found = await drive.files.list({ q: `'${parentId}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`, fields: 'files(id)', pageSize: 2 });
  if (found.data.files?.[0]?.id) return found.data.files[0].id;
  const created = await drive.files.create({ requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }, fields: 'id' });
  if (!created.data.id) throw new Error(`${name} 폴더를 만들지 못했습니다.`);
  return created.data.id;
}

function 드라이브주소(id: string, mimeType = '') {
  return mimeType === 'application/vnd.google-apps.folder'
    ? `https://drive.google.com/drive/folders/${id}`
    : `https://drive.google.com/open?id=${id}`;
}

export async function GET(request: Request) {
  try {
    const projectId = new URL(request.url).searchParams.get('projectId')?.trim() || '';
    if (!projectId) return NextResponse.json({ ok: false, error: '프로젝트가 필요합니다.' }, { status: 400 });
    const { drive, driveFolderId } = await 연결정보(projectId);
    if (!driveFolderId) return NextResponse.json({ ok: true, files: [], message: '프로젝트 Drive 폴더가 연결되지 않았습니다.' });

    const root = await drive.files.list({
      q: `'${driveFolderId}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,modifiedTime,webViewLink,size)',
      pageSize: 1000,
      orderBy: 'modifiedTime desc',
    });
    const rootFiles = root.data.files || [];
    const standardFolders = rootFiles.filter((file) => file.id && file.name && 허용폴더.has(file.name) && file.mimeType === 'application/vnd.google-apps.folder');
    const nested = await Promise.all(standardFolders.map(async (folder) => {
      const result = await drive.files.list({
        q: `'${folder.id}' in parents and trashed=false`,
        fields: 'files(id,name,mimeType,modifiedTime,webViewLink,size)',
        pageSize: 1000,
        orderBy: 'modifiedTime desc',
      });
      return (result.data.files || []).map((file) => ({ ...file, section: folder.name }));
    }));
    const files = [
      ...rootFiles.filter((file) => file.id && file.name && !허용폴더.has(file.name)).map((file) => ({ ...file, section: '프로젝트 공통' })),
      ...nested.flat(),
    ].filter((file) => file.id && file.name).map((file) => ({
      id: file.id as string,
      name: file.name as string,
      section: file.section,
      mimeType: file.mimeType || '',
      isFolder: file.mimeType === 'application/vnd.google-apps.folder',
      updatedAt: file.modifiedTime || '',
      size: file.size || '',
      url: file.webViewLink || 드라이브주소(file.id as string, file.mimeType || ''),
    }));
    return NextResponse.json({ ok: true, files });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : '프로젝트 파일을 읽지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const projectId = String(form.get('projectId') || '').trim();
      const target = String(form.get('target') || '01_자료').trim();
      const file = form.get('file');
      if (!projectId || !(file instanceof File)) return NextResponse.json({ ok: false, error: '프로젝트와 파일이 필요합니다.' }, { status: 400 });
      if (!허용폴더.has(target)) return NextResponse.json({ ok: false, error: '자료·제작·결과물 폴더 중 하나를 선택해 주세요.' }, { status: 400 });
      if (file.size > 업로드한도) return NextResponse.json({ ok: false, error: '50MB가 넘는 파일은 Drive 폴더에 직접 넣고 링크를 연결해 주세요.' }, { status: 413 });
      const { sheets, drive, ledgerId, driveFolderId } = await 연결정보(projectId);
      if (!driveFolderId) throw new Error('프로젝트 Drive 폴더가 연결되지 않았습니다.');
      const targetId = await 하위폴더(drive, driveFolderId, target);
      const uploaded = await drive.files.create({ requestBody: { name: 안전한이름(file.name), parents: [targetId] }, media: { mimeType: file.type || 'application/octet-stream', body: Readable.from(Buffer.from(await file.arrayBuffer())) }, fields: 'id,name,webViewLink' });
      if (!uploaded.data.id) throw new Error('Drive에 파일을 저장하지 못했습니다.');
      const url = uploaded.data.webViewLink || `https://drive.google.com/file/d/${uploaded.data.id}/view`;
      const link = await 링크기록(sheets, ledgerId, projectId, uploaded.data.name || file.name, `${target} 파일`, url);
      return NextResponse.json({ ok: true, link });
    }
    const body = await request.json();
    const projectId = String(body.projectId || '').trim();
    const name = String(body.name || '').trim();
    const purpose = String(body.purpose || '참고 링크').trim();
    const url = String(body.url || '').trim();
    if (!projectId || !name || !/^https?:\/\//i.test(url)) return NextResponse.json({ ok: false, error: '프로젝트·링크 이름·http 주소가 필요합니다.' }, { status: 400 });
    const { sheets, ledgerId } = await 연결정보(projectId);
    const link = await 링크기록(sheets, ledgerId, projectId, name, purpose, url);
    return NextResponse.json({ ok: true, link });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : '프로젝트 자료를 연결하지 못했습니다.' }, { status: 500 });
  }
}
