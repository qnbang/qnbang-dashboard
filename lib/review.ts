// 장표(문서) 검토 코멘트의 백엔드 — 사장님이 각 장표에 남긴 "상태 + 코멘트"를
// 상태 전용 repo(qnbang-dashboard-data)의 reviews/<key>.json 에 저장한다.
// share.ts 와 같은 구조: GitHub Contents API + sha 기반 쓰기, no-store 읽기로 즉시 반영.
// 코드 repo 가 아니라 상태 전용 repo 에 둬서 사람(로컬 커밋)과 서버가 갈라지지 않게 한다.

const TOKEN = process.env.GITHUB_TOKEN!;
const OWNER = process.env.GITHUB_OWNER || 'qnbang';
const REGISTRY_REPO = process.env.DASHBOARD_DATA_REPO || 'qnbang-dashboard-data';

const headers = () => ({
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

// 한 장표(섹션)에 대한 사장님의 검토 = 확정 여부 + 코멘트
// confirmed: 이 장표를 다 봤다(확정). 다시 손볼 수 있게 해제 가능. comment: 자유 지시(고칠 것·뺄 것 등).
export interface ReviewItem {
  confirmed: boolean;
  comment: string;
}
export interface ReviewData {
  items: Record<string, ReviewItem>; // 섹션 id → 검토
  updatedAt: string;
}

// key 는 검토 대상 식별자(예: 'm650'). 영숫자·하이픈만 허용(경로 안전).
function safeKey(key: string): string {
  return key.replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'doc';
}
const fileUrl = (key: string) =>
  `https://api.github.com/repos/${OWNER}/${REGISTRY_REPO}/contents/reviews/${safeKey(key)}.json`;

// 저장된 검토 읽기 → 데이터 + 쓰기용 sha. 없으면 빈 데이터.
export async function getReview(key: string): Promise<{ data: ReviewData; sha?: string }> {
  const res = await fetch(fileUrl(key), { headers: headers(), cache: 'no-store' });
  if (res.status === 404) return { data: { items: {}, updatedAt: '' } };
  if (!res.ok) throw new Error(`검토 읽기 실패: ${res.status} ${await res.text()}`);
  const json = await res.json();
  try {
    const decoded = Buffer.from(json.content, 'base64').toString('utf8');
    const data = JSON.parse(decoded) as ReviewData;
    return { data: { items: data.items || {}, updatedAt: data.updatedAt || '' }, sha: json.sha };
  } catch {
    return { data: { items: {}, updatedAt: '' }, sha: json.sha };
  }
}

// 검토 저장 — 현재 sha 와 함께 PUT(동시 수정 충돌 방지). nowIso 는 호출부에서 전달.
export async function saveReview(key: string, items: ReviewData['items'], nowIso: string): Promise<ReviewData> {
  const { sha } = await getReview(key);
  const data: ReviewData = { items, updatedAt: nowIso };
  const body = {
    message: `검토 저장: ${safeKey(key)}`,
    content: Buffer.from(JSON.stringify(data, null, 2) + '\n').toString('base64'),
    sha,
  };
  const put = await fetch(fileUrl(key), { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
  if (!put.ok) throw new Error(`검토 저장 실패: ${put.status} ${await put.text()}`);
  return data;
}
