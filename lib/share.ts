// 노션식 공유 토글의 백엔드 — "어떤 문서가 공개인지"를 GitHub 파일 하나(share-registry.json)에
// slug 단위로 기록한다 (서버 전용). 이 파일에 항목이 있으면 = 공개.
// 토글 = 이 파일에 추가/제거하는 커밋 → 런타임에 no-store 로 읽으므로 배포 없이 즉시 반영된다.
// 이미 동작 중인 GITHUB_TOKEN 쓰기 권한(lib/github.ts 의 PUT 패턴)을 그대로 재사용한다.
//
// ⚠️ 저장 위치 = 코드 repo 가 아니라 "상태 전용 repo"(qnbang-dashboard-data).
// 이유: 코드 repo 에 두면 사람(로컬 커밋)과 서버(런타임 커밋)가 같은 repo 에 써서 갈래가
// 벌어진다(diverge). 사람이 손대지 않는 별도 repo 에 두면 코드 repo 는 한 줄로 흐른다.

import { createHash } from 'node:crypto';
import { getJsonFile, saveJsonFile } from './boards';

// 공유 기록 파일 경로 — 저장 위치(owner·repo)는 boards.ts 의 기본 데이터 repo(qnbang-dashboard-data)를 그대로 쓴다.
const REGISTRY_PATH = 'share-registry.json';

export interface ShareEntry {
  slug: string;    // 공개 링크의 추측 어려운 식별자
  repo: string;    // 원본 문서가 있는 프로젝트 repo
  path: string;    // repo 내 문서 경로
  title: string;   // 표시용 제목
  sharedAt: string; // 공개 시작 시각(ISO)
}

// 기록 파일을 통째로 읽는다 → 항목 목록 + 쓰기에 필요한 sha. 파일이 없으면 빈 목록.
async function readRegistry(): Promise<{ entries: ShareEntry[]; sha?: string }> {
  const { data, sha } = await getJsonFile<ShareEntry[]>(REGISTRY_PATH);
  return { entries: Array.isArray(data) ? data : [], sha };
}

// 항목 목록을 파일에 다시 쓴다 (sha 기반 → 동시 수정 충돌 방지)
async function writeRegistry(entries: ShareEntry[], sha: string | undefined, message: string): Promise<void> {
  await saveJsonFile(REGISTRY_PATH, entries, { sha, message });
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

// 읽기 쉬운·고정 슬러그: repo 이름의 핵심만 뽑아 사람이 알아보는 주소로.
//  (예: qnbang-proj-geummundo-branding → geummundo)
// 결정적이라 공유를 껐다 켜도 같은 주소가 유지된다. 같은 base가 다른 문서에 이미
// 쓰였을 때만 경로 해시 4자리를 붙여 충돌을 막는다.
function deriveSlug(repo: string, path: string, entries: ShareEntry[]): string {
  // 가상 좌표(@post/@sheet/@hub) = 저장소 파일 아닌 게시판 글. repo·path가 영문 이름을 안 주므로
  // (한글 제목뿐) 좌표 해시로 짧고 안 겹치는 주소를 만든다. 껐다 켜도 같은 주소 유지.
  if (repo.startsWith('@')) {
    return `p-${createHash('sha1').update(`${repo}/${path}`).digest('hex').slice(0, 8)}`;
  }
  let base = repo.toLowerCase()
    .replace(/^qnbang-proj-/, '')
    .replace(/^qnbang-/, '')
    .replace(/-(branding|website|site|web|landing|dashboard)$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!base) base = 'doc';
  const conflict = entries.some((e) => e.slug === base && !(e.repo === repo && e.path === path));
  return conflict
    ? `${base}-${createHash('sha1').update(`${repo}/${path}`).digest('hex').slice(0, 4)}`
    : base;
}

// 공개 켜기 — 이미 공개면 기존 항목 그대로 반환(멱등). 새로면 slug 발급 후 기록.
export async function enableShare(repo: string, path: string, title: string, nowIso: string): Promise<ShareEntry> {
  const { entries, sha } = await readRegistry();
  const existing = entries.find((e) => e.repo === repo && e.path === path);
  if (existing) return existing;
  const entry: ShareEntry = {
    slug: deriveSlug(repo, path, entries), // 읽기 쉬운 고정 주소 (예: geummundo)
    repo,
    path,
    title,
    sharedAt: nowIso,
  };
  await writeRegistry([...entries, entry], sha, `공유 켜기: ${title}`);
  return entry;
}

// 공유 중인 문서가 폴더 이동 등으로 경로가 바뀌었을 때, 기록의 경로만 새 경로로 고친다.
// slug(링크 주소)는 그대로라 이미 보낸 링크가 안 깨진다. (공유 페이지가 자동 복구할 때 호출)
export async function healSharePath(repo: string, oldPath: string, newPath: string): Promise<void> {
  if (oldPath === newPath) return;
  const { entries, sha } = await readRegistry();
  const e = entries.find((x) => x.repo === repo && x.path === oldPath);
  if (!e) return;
  e.path = newPath;
  await writeRegistry(entries, sha, `공유 경로 자동 정정: ${oldPath} → ${newPath}`);
}

// 공개 끄기 — 해당 문서 항목 제거. 원래 공개 아니었으면 아무 일도 안 함.
export async function disableShare(repo: string, path: string): Promise<void> {
  const { entries, sha } = await readRegistry();
  const next = entries.filter((e) => !(e.repo === repo && e.path === path));
  if (next.length === entries.length) return;
  await writeRegistry(next, sha, `공유 끄기: ${repo}/${path}`);
}
