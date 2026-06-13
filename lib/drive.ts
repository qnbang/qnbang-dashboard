// 구글 드라이브 — Apps Script 웹앱을 통해 다룬다 (서버 전용).
// 서비스 계정은 저장공간이 없어 파일 업로드가 안 되므로, 사장님 계정 권한으로
// 실행되는 Apps Script(문서/드라이브-AppsScript.gs)를 출입문으로 쓴다.
// 폴더 생성·파일 업로드·목록 모두 이 한 곳을 거친다 → 파일은 회사 계정 소유.

const SCRIPT_URL = process.env.DRIVE_SCRIPT_URL!;
const SCRIPT_KEY = process.env.DRIVE_SCRIPT_KEY || 'qnbang2026drive';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  isFolder: boolean;
}

// Apps Script 웹앱 호출 공통 — POST {key, action, ...payload} → JSON
async function call(action: string, payload: Record<string, unknown>) {
  if (!SCRIPT_URL) throw new Error('DRIVE_SCRIPT_URL 환경변수가 없습니다 (Apps Script 배포 후 설정)');
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: SCRIPT_KEY, action, ...payload }),
    redirect: 'follow', // Apps Script 웹앱은 302로 리다이렉트됨
    cache: 'no-store',
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Apps Script 오류');
  return json;
}

// 폴더 내용 (하위폴더 + 파일, 썸네일 포함)
export async function listProjectFiles(folderId: string): Promise<DriveFile[]> {
  const r = await call('list', { folderId });
  return (r.files || []) as DriveFile[];
}

// 새 프로젝트 폴더 생성 (번호.이름 + 소재/결과물/공유본). 번호는 Apps Script가 채번.
export async function createProjectFolders(
  name: string,
  type: '대행' | '자체'
): Promise<{ id: string; name: string }> {
  const r = await call('createProject', { name, type });
  return { id: r.id, name: r.name };
}

// 파일 업로드 (base64). 자동 업로드·대시보드 업로드 공용.
export async function uploadFile(
  folderId: string,
  filename: string,
  mimeType: string,
  dataBase64: string
): Promise<{ id: string; name: string }> {
  const r = await call('upload', { folderId, filename, mimeType, dataBase64 });
  return { id: r.id, name: r.name };
}
