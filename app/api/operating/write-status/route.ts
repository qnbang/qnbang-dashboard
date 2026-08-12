import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const dynamic = 'force-dynamic';

const 통합인덱스ID = '1RnmSplWT2-Aqk-flDInpWMljKwBbUes1q6pab9j3dfo';
const 캐시시간 = 300_000;
type 권한응답 = { ok: true; writable: boolean; canCreateProject: boolean; editableProjectIds: string[]; message: string; creationMessage: string };
let 권한캐시: { at: number; data: 권한응답 } | null = null;
let 진행중권한조회: Promise<권한응답> | null = null;

function 시트ID(주소: string) {
  return 주소.match(/\/d\/([\w-]+)/)?.[1] || '';
}

async function 실제권한조회(): Promise<권한응답> {
    const 서비스계정 = JSON.parse(process.env.GOOGLE_SA_JSON || '');
    const auth = new google.auth.JWT({
      email: 서비스계정.client_email,
      key: 서비스계정.private_key,
      scopes: ['https://www.googleapis.com/auth/drive.metadata.readonly', 'https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const drive = google.drive({ version: 'v3', auth });
    const sheets = google.sheets({ version: 'v4', auth });
    const index = await sheets.spreadsheets.values.get({ spreadsheetId: 통합인덱스ID, range: '프로젝트!A:Z' });
    const [header = [], ...rows] = index.data.values || [];
    const column = Object.fromEntries(header.map((item, position) => [String(item), position]));
    const ledgers = rows.map((row) => ({
      projectId: String(row[column['프로젝트ID']] || ''),
      status: String(row[column['상태']] || ''),
      ledgerId: 시트ID(String(row[column['프로젝트 운영원장']] || row[column['원장링크']] || '')) || String(row[column['원장시트ID']] || ''),
    })).filter((item) => item.projectId && item.ledgerId && !['보관', '폐기 기록'].includes(item.status));
    const permissions = await Promise.all(ledgers.map(async (item) => {
      const file = await drive.files.get({ fileId: item.ledgerId, fields: 'capabilities(canEdit)' }).catch(() => null);
      return { projectId: item.projectId, editable: Boolean(file?.data.capabilities?.canEdit) };
    }));
    const editableProjectIds = permissions.filter((item) => item.editable).map((item) => item.projectId);
    const oauthRoot = process.env.GOOGLE_USER_OAUTH_DIR || join(homedir(), 'Documents', 'QNB_work', '.tools', 'google-oauth');
    const canCreateProject = Boolean(oauthRoot && existsSync(`${oauthRoot}/client_secret.json`) && existsSync(`${oauthRoot}/token.json`));
    return { ok: true, writable: editableProjectIds.length > 0, canCreateProject, editableProjectIds, message: editableProjectIds.length ? '편집 권한이 연결된 프로젝트 원장에 기록할 수 있습니다.' : '새 드라이브 서비스 계정에 각 프로젝트 운영원장 편집 권한이 연결되면 기록할 수 있습니다.', creationMessage: canCreateProject ? '계약·착수 근거가 확인되면 새 프로젝트를 만들 수 있습니다.' : '대표님 Google 사용자 OAuth로 새 원장을 만들도록 연결한 뒤 프로젝트 생성을 다시 엽니다.' };
}

export async function GET() {
  if (권한캐시 && Date.now() - 권한캐시.at < 캐시시간) return NextResponse.json(권한캐시.data);
  try {
    진행중권한조회 ||= 실제권한조회();
    const data = await 진행중권한조회;
    권한캐시 = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch {
    if (권한캐시) return NextResponse.json({ ...권한캐시.data, cached: true });
    return NextResponse.json({ ok: false, writable: false, canCreateProject: false, message: '새 드라이브 쓰기 권한을 확인하지 못했습니다.', creationMessage: '새 프로젝트 생성 연결을 확인하지 못했습니다.' }, { status: 503 });
  } finally {
    진행중권한조회 = null;
  }
}
