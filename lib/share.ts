// 노션식 공유 토글의 백엔드 — "어떤 문서가 공개인지"를 GitHub 파일 하나(share-registry.json)에
// slug 단위로 기록한다 (서버 전용). 대시보드 repo 루트에 둔 이 파일에 항목이 있으면 = 공개.
// 토글 = 이 파일에 추가/제거하는 커밋 → 런타임에 no-store 로 읽으므로 배포 없이 즉시 반영된다.
// 이미 동작 중인 GITHUB_TOKEN 쓰기 권한(lib/github.ts 의 PUT 패턴)을 그대로 재사용한다.

import { randomBytes } from 'node:crypto';

const TOKEN = process.env.GITHUB_TOKEN!;
const OWNER = process.env.GITHUB_OWNER || 'qnbang';
// 공유 기록 파일을 둘 곳 = 대시보드 자신의 repo (인프라 설정의 집)
const REGISTRY_REPO = process.env.DASHBOARD_REPO || 'qnbang-dashboard';
const REGISTRY_PATH = 'share-registry.json';

const headers = () => ({
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

export interface ShareEntry {
  slug: string;    // 공개 링크의 추측 어려운 식별자
  repo: string;    // 원본 문서가 있는 프로젝트 repo
  path: string;    // repo 내 문서 경로
  title: string;   // 표시용 제목
  sharedAt: string; // 공개 시작 시각(ISO)
}

const fileUrl = () =>
  `https://api.github.com/repos/${OWNER}/${REGISTRY_REPO}/contents/${REGISTRY_PATH}`;

// 기록 파일을 통째로 읽는다 → 항목 목록 + 쓰기에 필요한 sha. 파일이 없으면 빈 목록.
async function readRegistry(): Promise<{ entries: ShareEntry[]; sha?: string }> {
  const res = await fetch(fileUrl(), { headers: headers(), cache: 'no-store' });
  if (res.status === 404) return { entries: [] };
  if (!res.ok) throw new Error(`공유 기록 읽기 실패: ${res.status} ${await res.text()}`);
  const json = await res.json();
  try {
    const decoded = Buffer.from(json.content, 'base64').toString('utf8');
    const entries = JSON.parse(decoded) as ShareEntry[];
    return { entries: Array.isArray(entries) ? entries : [], sha: json.sha };
  } catch {
    return { entries: [], sha: json.sha };
  }
}

// 항목 목록을 파일에 다시 쓴다 (sha 기반 → 동시 수정 충돌 방지)
async function writeRegistry(entries: ShareEntry[], sha: string | undefined, message: string): Promise<void> {
  const body = {
    message,
    content: Buffer.from(JSON.stringify(entries, null, 2) + '\n').toString('base64'),
    sha,
  };
  const put = await fetch(fileUrl(), { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
  if (!put.ok) throw new Error(`공유 기록 저장 실패: ${put.status} ${await put.text()}`);
}

// 공개 중인 전체 목록
export async function listShares(): Promise<ShareEntry[]> {
  return (await readRegistry()).entries;
}

// slug 로 공개 항목 찾기 (공유 페이지가 사용) — 없으면 null
export async function getShareBySlug(slug: string): Promise<ShareEntry | null> {
  const { entries } = await readRegistry();
  return entries.find((e) => e.slug === slug) || null;
}

// 특정 문서(repo+path)가 공개 중인지 — 항목 또는 null
export async function findShare(repo: string, path: string): Promise<ShareEntry | null> {
  const { entries } = await readRegistry();
  return entries.find((e) => e.repo === repo && e.path === path) || null;
}

// 공개 켜기 — 이미 공개면 기존 항목 그대로 반환(멱등). 새로면 slug 발급 후 기록.
export async function enableShare(repo: string, path: string, title: string, nowIso: string): Promise<ShareEntry> {
  const { entries, sha } = await readRegistry();
  const existing = entries.find((e) => e.repo === repo && e.path === path);
  if (existing) return existing;
  const entry: ShareEntry = {
    slug: randomBytes(8).toString('hex'), // 16자리 16진수 — 링크 모르면 못 찾음
    repo,
    path,
    title,
    sharedAt: nowIso,
  };
  await writeRegistry([...entries, entry], sha, `공유 켜기: ${title}`);
  return entry;
}

// 공개 끄기 — 해당 문서 항목 제거. 원래 공개 아니었으면 아무 일도 안 함.
export async function disableShare(repo: string, path: string): Promise<void> {
  const { entries, sha } = await readRegistry();
  const next = entries.filter((e) => !(e.repo === repo && e.path === path));
  if (next.length === entries.length) return;
  await writeRegistry(next, sha, `공유 끄기: ${repo}/${path}`);
}
