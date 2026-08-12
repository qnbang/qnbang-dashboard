import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

const experimentsFolderId = '1nv1NPhAakTfwg1rA2DIserZqjNlzoEL9';

export async function GET() {
  try {
    const serviceAccount = JSON.parse(process.env.GOOGLE_SA_JSON || '');
    const auth = new google.auth.JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
    });
    const drive = google.drive({ version: 'v3', auth });
    const response = await drive.files.list({
      q: `'${experimentsFolderId}' in parents and trashed = false`,
      fields: 'files(id,name,modifiedTime,mimeType)',
      orderBy: 'modifiedTime desc',
      pageSize: 100,
    });
    const items = (response.data.files || []).filter((item) => item.mimeType === 'application/vnd.google-apps.folder').map((item) => ({
      id: item.id,
      name: item.name,
      updatedAt: item.modifiedTime || '',
      driveUrl: `https://drive.google.com/drive/folders/${item.id}`,
    }));
    return NextResponse.json({ ok: true, items });
  } catch {
    return NextResponse.json({ ok: false, message: '실험 폴더를 읽지 못했습니다.' }, { status: 503 });
  }
}
