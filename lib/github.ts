// GitHub API 유틸 — 프로젝트 repo의 작업로그·커밋을 읽어 대시보드에 보여준다 (서버 전용).
// 'qnbang-project' 토픽이 붙은 private repo를 프로젝트로 인식한다.

const TOKEN = process.env.GITHUB_TOKEN!;
const OWNER = process.env.GITHUB_OWNER || 'chalrie92';
const TOPIC = 'qnbang-project';

const headers = () => ({
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

export interface ProjectRepo {
  repo: string;        // repo 이름 (slug)
  title: string;       // 화면 표시 이름 (프로젝트.json 이름 우선)
  category?: string;   // 대행 | 자체
  manager?: string;    // 담당자
  startDate?: string;  // 착수일 (정렬용)
  endDate?: string;    // 마감일 (D-day 계산용)
  pushedAt: string;    // 마지막 작업 시각
  htmlUrl: string;     // GitHub 페이지
  driveFolderId?: string;   // 연결된 드라이브 폴더 (있으면)
  progressStatus?: string;  // 진행 상태 (시작 전 | 진행 중 | 피드백 대기 | 보류 | 완료 | 중단)
  contractStatus?: string;  // 계약 상태 (계약 완료 | 구두 계약 | 계약 대기)
  paymentStatus?: string;   // 입금 상태 (완수금 | 착수금 | 입금 대기)
  amount?: number;          // 계약 금액
  paidAmount?: number;      // 받은 금액
}

export interface ProjectMeta {
  driveFolderId?: string;
  name?: string;            // 프로젝트 이름(폴더명 기준) — 표시용 정답
  category?: string;        // 대행 | 자체
  manager?: string;         // 담당자
  progressStatus?: string;
  contractStatus?: string;
  paymentStatus?: string;
  amount?: number;
  paidAmount?: number;
  startDate?: string;       // 착수일 YYYY-MM-DD
  endDate?: string;         // 마감일 YYYY-MM-DD
  contractUrl?: string;     // 계약서 원본 링크(드라이브)
}

// 화면용 ASCII 필드 ↔ 프로젝트.json 한글 키 매핑
export const META_KEYS: Record<string, string> = {
  name: '이름',
  category: '분류',
  manager: '담당자',
  progressStatus: '진행상태',
  contractStatus: '계약상태',
  paymentStatus: '입금상태',
  amount: '계약금액',
  paidAmount: '입금액',
  startDate: '착수일',
  endDate: '마감일',
  contractUrl: '계약서링크',
};

// repo 루트 프로젝트.json 을 읽어 메타데이터로 (없으면 빈 객체)
export async function getProjectMeta(repo: string): Promise<ProjectMeta> {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${repo}/contents/프로젝트.json`,
    { headers: headers(), cache: 'no-store' }
  );
  if (!res.ok) return {};
  const json = await res.json();
  if (!json.content) return {};
  try {
    const c = JSON.parse(Buffer.from(json.content, 'base64').toString('utf8'));
    return {
      driveFolderId: c.driveFolderId,
      name: c['이름'],
      category: c['분류'],
      manager: c['담당자'],
      progressStatus: c['진행상태'],
      contractStatus: c['계약상태'],
      paymentStatus: c['입금상태'],
      amount: typeof c['계약금액'] === 'number' ? c['계약금액'] : undefined,
      paidAmount: typeof c['입금액'] === 'number' ? c['입금액'] : undefined,
      startDate: c['착수일'],
      endDate: c['마감일'],
      contractUrl: c['계약서링크'],
    };
  } catch {
    return {};
  }
}

// 프로젝트.json 일부 필드를 GitHub에 직접 저장 (대시보드에서 편집)
export async function updateProjectMeta(repo: string, patch: Record<string, unknown>): Promise<void> {
  const url = `https://api.github.com/repos/${OWNER}/${repo}/contents/프로젝트.json`;
  const cur = await fetch(url, { headers: headers(), cache: 'no-store' });
  let sha: string | undefined;
  let existing: Record<string, unknown> = {};
  if (cur.ok) {
    const j = await cur.json();
    sha = j.sha;
    try { existing = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')); } catch {}
  }
  const merged = { ...existing, ...patch };
  const body = {
    message: '대시보드에서 프로젝트 정보 수정',
    content: Buffer.from(JSON.stringify(merged, null, 2) + '\n').toString('base64'),
    sha,
  };
  const put = await fetch(url, { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
  if (!put.ok) throw new Error(`프로젝트.json 저장 실패: ${put.status} ${await put.text()}`);
}

export interface Commit {
  sha: string;
  message: string;
  date: string;
}

const AUTOMATED_COMMIT_PATTERNS = [
  /산출물\s*정정/i,
  /폴더\s*정리/i,
  /폴더\s*구조/i,
  /작업\s*동기화/i,
  /대시보드에서\s*프로젝트\s*정보\s*수정/i,
  /드라이브\s*연결을\s*공식\s*폴더로/i,
  /데일리\s*자동발행/i,
  /자동\s*발행/i,
];

// 프로젝트 repo 목록 — repo 전체를 받아 'qnbang-project' 토픽으로 거른다.
// (검색 API는 색인 지연이 있어, 새 repo가 즉시 안 잡힘 → 목록 API로 즉시 반영)
export async function listProjectRepos(): Promise<ProjectRepo[]> {
  const res = await fetch(
    `https://api.github.com/orgs/${OWNER}/repos?per_page=100&sort=updated`,
    { headers: headers(), cache: 'no-store' }
  );
  if (!res.ok) throw new Error(`GitHub repo 목록 실패: ${res.status} ${await res.text()}`);
  const repos = await res.json();
  const tagged = (repos as { name: string; pushed_at: string; html_url: string; topics?: string[] }[])
    .filter((r) => (r.topics || []).includes(TOPIC));

  // 각 repo: 작업로그 H1(이름) + 프로젝트.json(계약·입금·금액)
  const projects: ProjectRepo[] = await Promise.all(
    tagged.map(async (r) => {
      const meta = await getProjectMeta(r.name);
      // 이름은 프로젝트.json '이름'이 정답 → 없으면 작업로그 H1 → 그것도 없으면 slug
      const title = meta.name || (await getWorkLogTitle(r.name)) || r.name;

      // 1안. 깃허브 커밋 메시지 필터링으로 최근작업일 보정
      let updatedAt = r.pushed_at;
      try {
        const commits = await getCommits(r.name, 10);
        const realCommit = commits.find((c) => {
          const msg = c.message;
          const isAutomated = AUTOMATED_COMMIT_PATTERNS.some((pattern) => pattern.test(msg));
          return !isAutomated;
        });
        if (realCommit) {
          updatedAt = realCommit.date;
        }
      } catch (e) {
        // 에러 시 기존 pushed_at으로 안전하게 대체
        console.error(`Failed to fetch commits or filter for ${r.name}:`, e);
      }

      return {
        repo: r.name,
        title,
        category: meta.category,
        manager: meta.manager,
        startDate: meta.startDate,
        endDate: meta.endDate,
        pushedAt: updatedAt,
        htmlUrl: r.html_url,
        driveFolderId: meta.driveFolderId,
        progressStatus: meta.progressStatus,
        contractStatus: meta.contractStatus,
        paymentStatus: meta.paymentStatus,
        amount: meta.amount,
        paidAmount: meta.paidAmount,
      };
    })
  );
  // 착수일 최신순 (없으면 맨 뒤로)
  projects.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  return projects;
}

// 작업로그 파일 내용 (마크다운 원문)
export async function getWorkLog(repo: string): Promise<string | null> {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${repo}/contents/0_작업로그.md`,
    { headers: headers(), cache: 'no-store' }
  );
  if (!res.ok) return null;
  const json = await res.json();
  if (!json.content) return null;
  return Buffer.from(json.content, 'base64').toString('utf8');
}

async function getWorkLogTitle(repo: string): Promise<string | null> {
  const content = await getWorkLog(repo);
  if (!content) return null;
  const m = content.match(/^#\s+(.+)$/m);
  if (!m) return null;
  // "0_작업로그 — 촌캉스 빈집사업" / "작업 로그 — 큐앤뱅 대시보드" → 대시(—) 뒤의 실제 이름
  const h1 = m[1].trim();
  const parts = h1.split(/\s+[—–]\s+/);
  return (parts.length > 1 ? parts[parts.length - 1] : h1).trim();
}

export interface DocItem {
  path: string;   // repo 내 경로
  title: string;  // 보기 좋은 제목
  group: string;  // 주제(폴더명)
}

// 파일·폴더명을 보기 좋게 — 번호접두어·날짜꼬리·확장자 제거, -_ 를 공백으로
function pretty(name: string): string {
  return name
    .replace(/\.md$/i, '')
    .replace(/^\d+[._-]\s*/, '')
    .replace(/[_-]\d{4}-\d{2}-\d{2}$/, '')
    .replace(/[-_]/g, ' ')
    .trim();
}

// 프로젝트 repo의 마크다운 문서 목록 (작업로그 제외) — 주제(폴더)별로 묶기 좋게 반환
export async function listProjectDocs(repo: string): Promise<DocItem[]> {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${repo}/git/trees/main?recursive=1`,
    { headers: headers(), cache: 'no-store' }
  );
  if (!res.ok) return [];
  const json = await res.json();
  const tree = (json.tree || []) as { path: string; type: string }[];
  // 노이즈 제외: 작업로그·현황판·코드용 파일·빈 placeholder·검수노트 등
  const NOISE = /^(0_작업로그|현황판|readme|claude|agents?|contributing|changelog|license)\.md$/i;
  const isNoise = (base: string) =>
    NOISE.test(base) ||
    base.startsWith('_') ||
    base.includes('여기에') ||
    base.includes('검수노트');
  return tree
    .filter((t) => {
      if (t.type !== 'blob' || !/\.md$/i.test(t.path)) return false;
      const base = t.path.split('/').pop()!;
      // 의존성·빌드 폴더 안 문서도 제외
      if (/(^|\/)(node_modules|\.venv|dist|build|\.next)\//.test(t.path)) return false;
      return !isNoise(base);
    })
    .map((t) => {
      const parts = t.path.split('/');
      const base = parts[parts.length - 1];
      const group = parts.length > 1 ? pretty(parts[0]) : '문서';
      return { path: t.path, title: pretty(base), group };
    });
}

// 진행 현황판 — repo 루트의 현황판.md (체크박스). 없으면 null.
export async function getStatusBoard(repo: string): Promise<string | null> {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${repo}/contents/현황판.md`,
    { headers: headers(), cache: 'no-store' }
  );
  if (!res.ok) return null;
  const json = await res.json();
  if (!json.content) return null;
  return Buffer.from(json.content, 'base64').toString('utf8');
}

// 특정 문서 내용 (마크다운 원문)
export async function getDoc(repo: string, docPath: string): Promise<string | null> {
  const encoded = docPath.split('/').map(encodeURIComponent).join('/');
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${repo}/contents/${encoded}`,
    { headers: headers(), cache: 'no-store' }
  );
  if (!res.ok) return null;
  const json = await res.json();
  if (!json.content) return null;
  return Buffer.from(json.content, 'base64').toString('utf8');
}

// repo 트리에서 파일명(basename)이 일치하는 문서 경로를 찾는다.
// 폴더를 옮긴 뒤 공유 링크가 안 깨지게 자동 복구하는 용도. 정확히 하나일 때만 반환(0개·중복이면 null — 오인 방지).
export async function findDocByName(repo: string, baseName: string): Promise<string | null> {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${repo}/git/trees/main?recursive=1`,
    { headers: headers(), cache: 'no-store' }
  );
  if (!res.ok) return null;
  const json = await res.json();
  const matches = ((json.tree || []) as { path: string; type: string }[])
    .filter((t) => t.type === 'blob' && t.path.split('/').pop() === baseName)
    .map((t) => t.path);
  return matches.length === 1 ? matches[0] : null;
}

// 문서 내용 + sha 함께 (편집용 — 저장할 때 이 sha 로 충돌 검사)
export async function getDocFull(repo: string, docPath: string): Promise<{ content: string; sha: string } | null> {
  const encoded = docPath.split('/').map(encodeURIComponent).join('/');
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${repo}/contents/${encoded}`,
    { headers: headers(), cache: 'no-store' }
  );
  if (!res.ok) return null;
  const json = await res.json();
  if (!json.content || !json.sha) return null;
  return { content: Buffer.from(json.content, 'base64').toString('utf8'), sha: json.sha };
}

// 문서 저장 (대시보드 편집) — Contents API PUT.
// 반드시 불러올 때 받은 sha 를 넘긴다 → 그 사이 origin 이 바뀌었으면 GitHub 가 409 로 거절(=덮어쓰기 사고 방지).
// 충돌이면 { conflict: true } 반환, 성공이면 새 sha 반환.
export async function saveDoc(
  repo: string,
  docPath: string,
  content: string,
  sha: string
): Promise<{ ok: true; sha: string } | { ok: false; conflict: boolean; error: string }> {
  const encoded = docPath.split('/').map(encodeURIComponent).join('/');
  const url = `https://api.github.com/repos/${OWNER}/${repo}/contents/${encoded}`;
  const body = {
    message: `대시보드에서 문서 편집: ${docPath}`,
    content: Buffer.from(content, 'utf8').toString('base64'),
    sha,
  };
  const put = await fetch(url, { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
  if (put.ok) {
    const j = await put.json();
    return { ok: true, sha: j.content?.sha };
  }
  const text = await put.text();
  // 409(Conflict) 또는 422(sha 불일치) = 그 사이 다른 곳에서 먼저 바뀜
  const conflict = put.status === 409 || put.status === 422;
  return { ok: false, conflict, error: `${put.status} ${text}` };
}

// 프로젝트 설정 — repo 루트의 프로젝트.json { driveFolderId } 을 읽는다 (없으면 null)
export async function getDriveFolderId(repo: string): Promise<string | null> {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${repo}/contents/프로젝트.json`,
    { headers: headers(), cache: 'no-store' }
  );
  if (!res.ok) return null;
  const json = await res.json();
  if (!json.content) return null;
  try {
    const cfg = JSON.parse(Buffer.from(json.content, 'base64').toString('utf8'));
    return cfg.driveFolderId || null;
  } catch {
    return null;
  }
}

// 최근 커밋 목록
export async function getCommits(repo: string, count = 8): Promise<Commit[]> {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${repo}/commits?per_page=${count}`,
    { headers: headers(), cache: 'no-store' }
  );
  if (!res.ok) return [];
  const json = await res.json();
  return (json || []).map((c: { sha: string; commit: { message: string; author: { date: string } } }) => ({
    sha: c.sha.slice(0, 7),
    message: c.commit.message.split('\n')[0],
    date: c.commit.author.date,
  }));
}

export interface OrgMember {
  login: string;
  avatarUrl: string;
  htmlUrl: string;
}

// 조직 멤버 목록 조회
export async function listOrganizationMembers(): Promise<OrgMember[]> {
  const res = await fetch(
    `https://api.github.com/orgs/${OWNER}/members?per_page=100`,
    { headers: headers(), cache: 'no-store' }
  );
  if (!res.ok) throw new Error(`GitHub 멤버 목록 실패: ${res.status} ${await res.text()}`);
  const members = await res.json();
  return (members as { login: string; avatar_url: string; html_url: string }[]).map((m) => ({
    login: m.login,
    avatarUrl: m.avatar_url,
    htmlUrl: m.html_url,
  }));
}

