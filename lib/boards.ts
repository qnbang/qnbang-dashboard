// 회의 게시판(회의록 목록)의 백엔드 — 코드 repo 가 아니라 상태 전용 repo(qnbang-dashboard-data)의
// boards/<key>.json 에 저장한다. review.ts·share.ts 와 같은 구조(GitHub Contents API + sha).
// 목록이 코드 밖에 있어 "새 회의 추가"가 코드 배포 없이 이 JSON 만 바꿔 반영된다.

const TOKEN = process.env.GITHUB_TOKEN!;
const OWNER = process.env.GITHUB_OWNER || 'qnbang';
const REGISTRY_REPO = process.env.DASHBOARD_DATA_REPO || 'qnbang-dashboard-data';

const headers = () => ({
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

// 게시판 한 줄(회의 하나). date = 'YYYY-MM-DD'(표시할 때 'YYYY. MM. DD'로). href = 회의 본문 링크(없어도 됨).
export interface BoardEntry {
  title: string;
  desc: string;
  date: string;
  href?: string;
  tag?: string;
}

// key = 게시판 식별자(허브 키, 예 'm650'). 영숫자·하이픈만(경로 안전).
function safeKey(key: string): string {
  return key.replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'board';
}
const fileUrl = (key: string) =>
  `https://api.github.com/repos/${OWNER}/${REGISTRY_REPO}/contents/boards/${safeKey(key)}.json`;

// 게시판 읽기 → 회의 목록 + 쓰기용 sha. 없으면 빈 목록.
export async function getBoard(key: string): Promise<{ entries: BoardEntry[]; sha?: string }> {
  const res = await fetch(fileUrl(key), { headers: headers(), cache: 'no-store' });
  if (res.status === 404) return { entries: [] };
  if (!res.ok) throw new Error(`게시판 읽기 실패: ${res.status} ${await res.text()}`);
  const json = await res.json();
  try {
    const decoded = Buffer.from(json.content, 'base64').toString('utf8');
    const data = JSON.parse(decoded) as { entries?: BoardEntry[] };
    return { entries: Array.isArray(data.entries) ? data.entries : [], sha: json.sha };
  } catch {
    return { entries: [], sha: json.sha };
  }
}

// 게시판 저장 — 현재 sha 와 함께 PUT(동시 수정 덮어쓰기 방지). nowIso 는 호출부에서 전달.
export async function saveBoard(key: string, entries: BoardEntry[], nowIso: string): Promise<void> {
  const { sha } = await getBoard(key);
  const body = {
    message: `회의 게시판 저장: ${safeKey(key)}`,
    content: Buffer.from(JSON.stringify({ entries, updatedAt: nowIso }, null, 2) + '\n').toString('base64'),
    sha,
  };
  const put = await fetch(fileUrl(key), { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
  if (!put.ok) throw new Error(`게시판 저장 실패: ${put.status} ${await put.text()}`);
}
