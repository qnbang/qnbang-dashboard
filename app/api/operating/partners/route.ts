import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

const indexSpreadsheetId = '1RnmSplWT2-Aqk-flDInpWMljKwBbUes1q6pab9j3dfo';

type 행 = Record<string, string>;

function 표행(rows: unknown[][]): 행[] {
  const [header = [], ...body] = rows;
  return body.map((row) => Object.fromEntries(header.map((key, index) => [String(key), String(row[index] ?? '').trim()])));
}

function sheetsClient() {
  const serviceAccount = JSON.parse(process.env.GOOGLE_SA_JSON || '');
  const auth = new google.auth.JWT({ email: serviceAccount.client_email, key: serviceAccount.private_key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}

function driveClient() {
  const serviceAccount = JSON.parse(process.env.GOOGLE_SA_JSON || '');
  const auth = new google.auth.JWT({ email: serviceAccount.client_email, key: serviceAccount.private_key, scopes: ['https://www.googleapis.com/auth/drive'] });
  return google.drive({ version: 'v3', auth });
}

async function 명함원본저장(image: File, name: string) {
  const drive = driveClient();
  const ensureFolder = async (parent: string, folderName: string) => {
    const found = await drive.files.list({ q: `'${parent}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`, fields: 'files(id)' });
    if (found.data.files?.[0]?.id) return found.data.files[0].id;
    const created = await drive.files.create({ requestBody: { name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [parent] }, fields: 'id' });
    return created.data.id || '';
  };
  const customerFolder = await ensureFolder('1xb5vQXkIpkZo3fhdJ34vgbLV8t9zGMZn', '고객관리');
  const cardFolder = await ensureFolder(customerFolder, '명함원본');
  const extension = image.name.includes('.') ? image.name.slice(image.name.lastIndexOf('.')) : '.jpg';
  const file = await drive.files.create({ requestBody: { name: `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${name.replace(/[\\/:*?"<>|]/g, '_')}${extension}`, parents: [cardFolder] }, media: { mimeType: image.type || 'image/jpeg', body: Buffer.from(await image.arrayBuffer()) }, fields: 'id' });
  if (!file.data.id) throw new Error('명함 원본을 저장하지 못했습니다.');
  return `https://drive.google.com/file/d/${file.data.id}/view`;
}

async function 원장읽기() {
  const sheets = sheetsClient();
  const result = await sheets.spreadsheets.values.batchGet({ spreadsheetId: indexSpreadsheetId, ranges: ["'거래상대'!A:Z", "'담당자·명함'!A:Z", "'프로젝트'!A:Z"] });
  const [partnerValues = [], contactValues = [], projectValues = []] = result.data.valueRanges?.map((range) => (range.values as unknown[][]) || []) || [];
  return { sheets, partners: 표행(partnerValues), contacts: 표행(contactValues), projects: 표행(projectValues) };
}

function 응답형태(partners: 행[], contacts: 행[], projects: 행[]) {
  const projectNames = new Map(projects.map((project) => [project['프로젝트ID'], project['프로젝트명']]));
  return partners.map((partner) => ({
    id: partner['거래상대ID'], name: partner['이름'], kind: partner['구분'] === '회사' ? '회사' : '개인', status: partner['상태'] || '계약 전', projects: (partner['연결 프로젝트ID'] || partner['연결_프로젝트ID'] || '').split(',').map((value) => value.trim()).filter(Boolean).map((id) => projectNames.get(id) || id), last: partner['비고'] || '기록 없음', next: '다음 행동 등록 필요', note: partner['비고'] || '',
    contacts: contacts.filter((contact) => contact['소속 거래상대ID'] === partner['거래상대ID']).map((contact) => ({ name: contact['이름'], role: contact['직함'] || '담당자', phone: contact['연락처'] || undefined, email: contact['이메일'] || undefined, card: contact['명함 사진 링크'] || undefined })),
  })).filter((partner) => partner.id && partner.name);
}

export async function GET() {
  try {
    const { partners, contacts, projects } = await 원장읽기();
    return NextResponse.json({ ok: true, items: 응답형태(partners, contacts, projects) });
  } catch {
    return NextResponse.json({ ok: false, message: '거래상대 원장을 읽지 못했습니다.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let body: Record<string, string> = {};
    let image: File | undefined;
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      for (const [key, value] of form.entries()) {
        if (key === '이미지' && value instanceof File) image = value;
        else if (typeof value === 'string') body[key] = value;
      }
    } else body = await request.json();
    const name = String(body.이름 || '').trim();
    const company = String(body.회사명 || '').trim();
    const requestedKind = String(body.구분 || '담당자');
    if (!name && !company) return NextResponse.json({ ok: false, error: '이름 또는 회사명은 필요합니다.' }, { status: 400 });

    const { sheets, partners, contacts } = await 원장읽기();
    const partnerName = company || name;
    const kind = company || requestedKind === '회사' ? '회사' : '개인';
    let partner = partners.find((item) => item['이름'] === partnerName && item['구분'] === kind);
    const append: { range: string; values: string[][] }[] = [];
    if (!partner) {
      partner = { 거래상대ID: `P-${Date.now()}`, 구분: kind, 이름: partnerName, 상태: '계약 전', 담당자ID: '', 연락처: '', 연결_프로젝트ID: '', 비고: String(body.메모 || '').trim() || '명함 등록' };
      append.push({ range: "'거래상대'!A:H", values: [[partner['거래상대ID'], kind, partnerName, '계약 전', '', '', '', partner['비고']]] });
    }

    const duplicate = contacts.find((item) => item['소속 거래상대ID'] === partner!['거래상대ID'] && item['이름'] === (name || partnerName) && (item['이메일'] || item['연락처']) === (String(body.이메일 || '').trim() || String(body.연락처 || '').trim()));
    if (!duplicate) {
      const imageLink = image ? await 명함원본저장(image, name || partnerName) : '';
      append.push({ range: "'담당자·명함'!A:H", values: [[`C-${Date.now()}`, name || partnerName, partner['거래상대ID'], String(body.직함 || '').trim() || (kind === '개인' ? '개인' : '담당자'), String(body.연락처 || '').trim(), String(body.이메일 || '').trim(), imageLink, '사람 확인 등록']] });
    }
    if (append.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: indexSpreadsheetId, requestBody: { valueInputOption: 'RAW', data: append } });
    const refreshed = await 원장읽기();
    return NextResponse.json({ ok: true, items: 응답형태(refreshed.partners, refreshed.contacts, refreshed.projects), partnerId: partner['거래상대ID'] });
  } catch {
    return NextResponse.json({ ok: false, error: '거래상대 원장에 등록하지 못했습니다.' }, { status: 500 });
  }
}
