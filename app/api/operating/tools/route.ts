import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

const folders = [
  { id: '1tIoXIO2-d1OAw3gsWtSuuztA8EPMmj8T', platform: '공용' },
  { id: '1vO0j7Tr2ujP5szrzfQzcatn8j1O6ciFL', platform: 'macOS 전용' },
  { id: '1cSFUqVph1YwDz57ChX86kFev_Met2_v4', platform: 'Windows 전용' },
];

export async function GET() {
  try {
    const serviceAccount = JSON.parse(process.env.GOOGLE_SA_JSON || '');
    const auth = new google.auth.JWT({ email: serviceAccount.client_email, key: serviceAccount.private_key, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
    const drive = google.drive({ version: 'v3', auth });
    const groups = await Promise.all(folders.map(async (folder) => {
      const result = await drive.files.list({ q: `'${folder.id}' in parents and trashed=false`, orderBy: 'name', fields: 'files(id,name,modifiedTime,mimeType)' });
      return (result.data.files || []).filter((file) => file.mimeType === 'application/vnd.google-apps.folder').map((file) => ({ id: file.id || '', name: file.name || '이름 없는 도구', platform: folder.platform, kind: '드라이브 도구', updatedAt: file.modifiedTime || '', url: `https://drive.google.com/drive/folders/${file.id}` }));
    }));
    return NextResponse.json({ ok: true, items: groups.flat() });
  } catch {
    return NextResponse.json({ ok: false, message: '공용 도구 폴더를 읽지 못했습니다.' }, { status: 503 });
  }
}
