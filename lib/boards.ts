// 회의 게시판(회의록 목록)의 백엔드 — 코드 repo 가 아니라 상태 전용 repo(qnbang-dashboard-data)의
// boards/<key>.json 에 저장한다. review.ts·share.ts 와 같은 구조(GitHub Contents API + sha).
// 목록이 코드 밖에 있어 "새 회의 추가"가 코드 배포 없이 이 JSON 만 바꿔 반영된다.

const TOKEN = process.env.GITHUB_TOKEN!;
const DEFAULT_OWNER = process.env.GITHUB_OWNER || 'qnbang';
const REGISTRY_REPO = process.env.DASHBOARD_DATA_REPO || 'qnbang-dashboard-data';

// GitHub Contents API 공용 인증 헤더 — share.ts·review.ts·github.ts 가 모두 이 한 곳을 쓴다.
export const ghHeaders = () => ({
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});
const headers = ghHeaders;

// 게시판 한 줄(회의 하나). date = 'YYYY-MM-DD'(표시할 때 'YYYY. MM. DD'로). href = 회의 본문 링크(없어도 됨).
// body = 본문(전체 게시판 글에서 사용 — 허브 회의 게시판은 desc만 씀).
export interface BoardEntry {
  title: string;
  desc: string;
  date: string;
  href?: string;
  tag?: string;
  body?: string;
  id?: string;   // 안정 식별자 — 공유 좌표(@post/<id>)로 쓴다. 배열 인덱스는 삭제 시 밀리므로 id로 고정.
  // 회의록·문서 글의 원본 = 프로젝트 저장소 파일. 이 둘이 있으면 그 파일을 공유한다(기존 공유 시스템 재사용).
  // 없는 글(직접 쓴 아이디어·실험실 등)은 공유 시 가상 좌표 @post/<id>로 공유돼 본문(body)이 그대로 공개된다.
  repo?: string;
  path?: string;
}

// key = 게시판 식별자(허브 키, 예 'm650'). 영숫자·하이픈만(경로 안전).
function safeKey(key: string): string {
  return key.replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'board';
}

// ── 제네릭 JSON 파일 (GitHub Contents API) — owner·repo 생략 시 기본 데이터 repo(qnbang-dashboard-data).
// share.ts·review.ts·github.ts(프로젝트.json)가 모두 이 두 함수로 읽기·쓰기를 통일한다.
const contentsUrl = (path: string, owner: string = DEFAULT_OWNER, repo: string = REGISTRY_REPO) =>
  `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

export async function getJsonFile<T>(
  path: string,
  opts?: { owner?: string; repo?: string }
): Promise<{ data: T | null; sha?: string }> {
  const res = await fetch(contentsUrl(path, opts?.owner, opts?.repo), { headers: headers(), cache: 'no-store' });
  if (res.status === 404) return { data: null };
  if (!res.ok) throw new Error(`읽기 실패(${path}): ${res.status} ${await res.text()}`);
  const json = await res.json();
  try {
    return { data: JSON.parse(Buffer.from(json.content, 'base64').toString('utf8')) as T, sha: json.sha };
  } catch {
    return { data: null, sha: json.sha };
  }
}

export async function saveJsonFile(
  path: string,
  data: unknown,
  opts?: { owner?: string; repo?: string; message?: string; sha?: string }
): Promise<void> {
  const sha = opts && Object.prototype.hasOwnProperty.call(opts, 'sha')
    ? opts.sha
    : (await getJsonFile(path, opts)).sha;
  const body = {
    message: opts?.message || `데이터 저장: ${path}`,
    content: Buffer.from(JSON.stringify(data, null, 2) + '\n').toString('base64'),
    sha,
  };
  const put = await fetch(contentsUrl(path, opts?.owner, opts?.repo), { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
  if (!put.ok) throw new Error(`저장 실패(${path}): ${put.status} ${await put.text()}`);
}

// 게시판 읽기 → 회의 목록 + 쓰기용 sha. 없으면 빈 목록.
export async function getBoard(key: string): Promise<{ entries: BoardEntry[]; sha?: string }> {
  const { data, sha } = await getJsonFile<{ entries?: BoardEntry[] }>(`boards/${safeKey(key)}.json`);
  return { entries: Array.isArray(data?.entries) ? data.entries : [], sha };
}

// 게시판 저장 — 현재 sha 와 함께 PUT(동시 수정 덮어쓰기 방지). nowIso 는 호출부에서 전달.
export async function saveBoard(key: string, entries: BoardEntry[], nowIso: string): Promise<void> {
  await saveJsonFile(`boards/${safeKey(key)}.json`, { entries, updatedAt: nowIso }, {
    message: `회의 게시판 저장: ${safeKey(key)}`,
  });
}
