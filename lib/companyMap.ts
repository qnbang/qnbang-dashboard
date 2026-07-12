// 회사지도(회장 전용 /company) 데이터 빌더 — "이번 주 챙길 것" + 돈 밴드 + 5개 가지를 한 번에 만든다.
// 원본: 큐앤뱅-사내시스템/회사지도/지도생성.py(로컬 필사본 회사지도.html 생성기)를 대시보드 안으로 이식.
// 다른 점: python판은 워크스페이스 폴더를 직접 스캔하지만, 이 웹앱은 배포 환경에 그 폴더가 없으므로
//         전부 GitHub API(qnbang-project 토픽 repo)·시트(서비스계정)로 대신 읽는다.
//
// ⚠️ 돈의 진실원(중요 — 실제 사고 재발 방지):
//   계약금액 = 카드(각 repo 프로젝트.json)가 정답. 입금 = 매출 시트(통장 원장, lib/money.ts)가 정답.
//   카드의 입금액/입금상태 칸은 손으로 갱신하다 낡기 쉬워(실사고: 카드는 완납인데 시트엔 미수 남음) 헤드라인에 절대 안 쓴다.
//   대행 프로젝트가 매출 시트에서 한 건도 안 잡히면 미수 숫자를 지어내지 않고 '장부 매칭 안 됨' 배지만 띄운다.
import { listProjectRepos, getProjectMeta, type ProjectRepo, type ProjectMeta } from './github';
import { fetchMoneyData, type Contract } from './money';
import { buildOffice } from './office';
import { buildCRM } from './crm';
import { getBoard, getJsonFile } from './boards';
import { getSheets } from './sheetCache';
import { BRANDS } from '@/app/components/bizCatalog';

export interface MapNode {
  key: string;
  이름: string;
  상태?: string;
  담당?: string;
  마감?: string;
  계약?: number;      // 카드 값(대행만)
  입금?: number;      // 매출 시트 매칭 합(대행만) — 매칭 안 되면 0
  미수?: number;       // 계약 − 입금(매칭 안 됐으면 undefined — 지어내지 않음)
  카드입금?: number;    // 참고용 "카드값"(프로젝트.json 입금액 필드, 헤드라인엔 안 씀)
  장부매칭안됨?: boolean; // true면 미수 숫자 대신 배지만
  repo?: string;
  owner?: string;      // 기본 조직(GITHUB_OWNER)이 아니면 채움 — 예: 'chalrie92'
  editable?: boolean;  // 진행상태 select·정리표시 팝오버 노출(정식 repo·기본 조직만 true)
  done?: boolean;      // 완료·폐기·중단 — 흐림 처리
  제안?: string;        // AI 제안(company/제안.json '노드')
}
export interface Branch {
  key: string;
  title: string;
  nodes: MapNode[];
  collapsedDefault?: boolean;
  moneyVisible?: boolean;
}
export interface WeekInbox { 대기: MapNode[]; 마감: MapNode[]; 미수: MapNode[]; }
export interface MoneyBand { 계약: number; 입금: number; 미수: number; }
export interface Suggestion { 생성: string; 종합: string[]; 노드: Record<string, string>; }
export interface CompanyMapData {
  생성: string;
  대행수: number; 제품수: number; 브랜드수: number;
  이번주: WeekInbox;
  돈: MoneyBand;
  branches: Branch[];
  제안: Suggestion | null;
}

const DONE_STATUS = new Set(['완료', '폐기', '중단']);
const isDone = (s?: string) => !!s && DONE_STATUS.has(s);
const 오늘 = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

// ── 이름 매칭(카드 이름 ↔ 매출 시트 계약명·클라이언트) ──
// archive.ts(과업↔매출 묶기)·ProjectDocs.tsx(제목↔repo)와 같은 규칙: 공백 제거 부분포함 우선 → 안 되면 의미 토큰 겹침.
const STOP = new Set(['큐앤뱅', '프로젝트', '대행', '자체', '홈페이지', '웹사이트', '리뉴얼', '디자인', '제작', '개발']);
const sq = (s: string) => String(s || '').replace(/\s+/g, '');
const toks = (s: string) => (String(s).match(/[가-힣]{2,}|[A-Za-z]{3,}/g) || []).filter((w) => !STOP.has(w));

function matchContracts(name: string, contracts: Contract[]): Contract[] {
  const n = sq(name);
  if (!n) return [];
  const byName = contracts.filter((c) => { const q = sq(c.계약명); return !!q && (q.includes(n) || n.includes(q)); });
  if (byName.length) return byName;
  const byClient = contracts.filter((c) => { const q = sq(c.클라이언트); return !!q && (q.includes(n) || n.includes(q)); });
  if (byClient.length) return byClient;
  const T = toks(name);
  if (!T.length) return [];
  return contracts.filter((c) => toks(c.계약명 + ' ' + c.클라이언트).some((p) => T.includes(p)));
}

function 대행노드(p: ProjectRepo, contracts: Contract[]): MapNode {
  const 계약 = p.amount || 0;
  const matched = matchContracts(p.title, contracts);
  const 매칭됨 = matched.length > 0;
  const 입금 = matched.reduce((s, c) => s + c.입금액, 0);
  const 장부매칭안됨 = 계약 > 0 && !매칭됨;
  return {
    key: `repo:${p.repo}`, 이름: p.title, 상태: p.progressStatus, 담당: p.manager, 마감: p.endDate,
    계약, 입금, 미수: 장부매칭안됨 ? undefined : Math.max(0, 계약 - 입금),
    카드입금: p.paidAmount, 장부매칭안됨, repo: p.repo, editable: true, done: isDone(p.progressStatus),
  };
}

function 시트행들(sheet: unknown[][] | undefined): Record<string, string>[] {
  if (!Array.isArray(sheet) || sheet.length < 2) return [];
  const head = (sheet[0] as unknown[]).map((h) => String(h));
  return sheet.slice(1)
    .filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''))
    .map((r) => Object.fromEntries(head.map((h, i) => [h, String((r as unknown[])[i] ?? '').trim()])));
}

// 자체 제품 라인 — 4개 저장소 고정(각자 자기 프로젝트.json으로 관리). owner가 기본 조직과 다르면 읽기 전용.
const PRODUCT_REPOS: { owner: string; repo: string }[] = [
  { owner: 'chalrie92', repo: 'qnbang-naver-keyword' },
  { owner: 'chalrie92', repo: 'qnbang-price-monitor' },
  { owner: 'chalrie92', repo: 'qnbang-seo-namer' },
  { owner: 'qnbang', repo: 'qnbang-macro-briefing' },
];
const DEFAULT_OWNER = process.env.GITHUB_OWNER || 'qnbang';

// 인프라·도구 — 등록카드에 없는 "어디에 쓰이나" 수동 데이터. 지도생성.py와 같은 목록(SSOT는 그쪽 주석 참고).
const 인프라목록 = [
  { 이름: '사내 웹대시보드', 상태: 'dashboard.qnbang.com — 과업·프로젝트·게시판·공유', 담당: '전 프로젝트·팀원' },
  { 이름: '라크 자동화', 상태: '채팅→일정·지출·매출·과업 자동 등록 (GCP 상주)', 담당: '일정·재무·과업 시트' },
  { 이름: '업무OS 시드', 상태: '프로젝트동기화 등 과업 시트 관리 스크립트', 담당: '대시보드·과업 시트' },
  { 이름: '드라이브 자동미러', 상태: '세션 종료 때 산출물을 구글드라이브로 백업', 담당: '전 프로젝트' },
  { 이름: '업무일지·마감', 상태: '작업 자동 일지 + /업무종료 마감 브리핑', 담당: '회장 보고' },
  { 이름: '규칙점검 검사기', 상태: '폴더·문서 규칙 위반 일괄 검사 (.tools)', 담당: '워크스페이스 전체' },
];
const 도구목록 = [
  { 이름: '숏폼공장', 담당: '자동화청년 콘텐츠' },
  { 이름: '플레이라이트', 담당: '웹 검증·캡처 전반' },
  { 이름: '이미지보정(업스케일·워터마크)', 담당: '디자인 납품물' },
  { 이름: '한글 hwpx 편집', 담당: '관공서·계약 문서' },
  { 이름: 'PPT 읽기', 담당: '제안서 검토' },
  { 이름: '구글 OAuth 드라이브·시트', 담당: '재무·데이터 쓰기' },
];

export async function buildCompanyMap(): Promise<CompanyMapData> {
  const [repos, money, office, crm, postsBoard, suggestionFile, sheets] = await Promise.all([
    listProjectRepos().catch(() => [] as ProjectRepo[]),
    fetchMoneyData().catch(() => null),
    buildOffice().catch(() => null),
    buildCRM().catch(() => null),
    getBoard('posts').catch(() => ({ entries: [] })),
    getJsonFile<Suggestion>('company/제안.json').catch(() => ({ data: null })),
    getSheets().catch(() => null),
  ]);
  const contracts = money?.계약목록 || [];

  // ── 가지 ① 대행(진행) ──
  const 대행Repos = repos.filter((p) => p.category === '대행');
  const 대행노드들 = 대행Repos
    .map((p) => 대행노드(p, contracts))
    .sort((a, b) => (Number(!!a.done) - Number(!!b.done)) || (a.마감 || '9999').localeCompare(b.마감 || '9999'));

  // ── 가지 ② 자체 제품 라인 ──
  const 제품노드들: MapNode[] = await Promise.all(
    PRODUCT_REPOS.map(async ({ owner, repo }) => {
      const meta: ProjectMeta = await getProjectMeta(repo, owner).catch(() => ({}));
      return {
        key: `repo:${owner}/${repo}`, 이름: meta.name || repo, 상태: meta.progressStatus,
        담당: meta.manager, 마감: meta.endDate, repo, owner: owner === DEFAULT_OWNER ? undefined : owner,
        editable: false, done: isDone(meta.progressStatus),
      };
    })
  );

  // ── 가지 ③ 상시 브랜드 (bizCatalog.ts — app/page.tsx 자체사업 탭과 같은 출처) ──
  const 브랜드노드들: MapNode[] = BRANDS.map((b) => ({
    key: `brand:${b.name}`, 이름: b.name, 상태: b.status, editable: false,
  }));

  // ── 가지 ④ 신사업·영업 파이프라인 ──
  const 과업행 = 시트행들(sheets?.['과업']);
  const 리서치노드들: MapNode[] = 과업행
    .filter((t) => (t['분류'] || '') === '리서치')
    .map((t, i) => ({
      key: `lab:${t['id'] || i}`, 이름: t['프로젝트'] || t['과업명'] || '(이름 없음)',
      상태: t['현재상태'] || '리서치', 담당: t['담당자'] || '', done: t['공위치'] === '완수',
    }));
  const 자체사업노드들: MapNode[] = (office?.자체 || []).map((t) => ({
    key: `biz:${t.id}`, 이름: t.project || t.task, 상태: t.status || t.nextStep || '', 담당: t.owner, 마감: t.due,
  }));
  const 영업노드들: MapNode[] = (crm?.영업중 || []).map((c, i) => ({
    key: `lead:${i}:${c.고객}`, 이름: c.고객, 상태: c.단계 || '영업 중', 담당: (c.담당 || []).join(', '),
  }));
  const 아이디어노드들: MapNode[] = (postsBoard?.entries || [])
    .filter((e) => ['아이디어', '리서치'].includes(e.tag || '아이디어'))
    .map((e, i) => ({ key: `post:${i}`, 이름: e.title, 상태: e.tag || '아이디어', 마감: e.date }));
  const 파이프라인노드들 = [...영업노드들, ...자체사업노드들, ...리서치노드들, ...아이디어노드들];

  // ── 가지 ⑤ 인프라·도구 (기본 접힘, 정적) ──
  const 인프라노드들: MapNode[] = [...인프라목록, ...도구목록].map((x, i) => ({
    key: `infra:${i}:${x.이름}`, 이름: x.이름, 상태: (x as { 상태?: string }).상태, 담당: x.담당,
  }));

  const branches: Branch[] = [
    { key: '대행', title: '돈 버는 중 — 대행', nodes: 대행노드들, moneyVisible: true },
    { key: '제품', title: '자체 제품 라인', nodes: 제품노드들 },
    { key: '브랜드', title: '상시 브랜드', nodes: 브랜드노드들 },
    { key: '파이프라인', title: '신사업·영업 파이프라인', nodes: 파이프라인노드들 },
    { key: '인프라', title: '인프라·도구 (떠받침)', nodes: 인프라노드들, collapsedDefault: true },
  ];

  // ── AI 제안(company/제안.json) — 노드 배지 부착. 파일 없으면 통째로 숨김(null) ──
  const 제안 = suggestionFile?.data || null;
  if (제안?.노드) {
    for (const br of branches) {
      for (const n of br.nodes) {
        const hit = 제안.노드[n.이름];
        if (hit) n.제안 = hit;
      }
    }
  }

  // ── 이번 주 챙길 것 ──
  const 한주뒤 = new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  const WAIT_STATUS = new Set(['피드백 대기', '시작 전', '시작전', '보류']);
  const 대기: MapNode[] = repos.filter((p) => WAIT_STATUS.has(p.progressStatus || ''))
    .map((p) => ({ key: `repo:${p.repo}`, 이름: p.title, 상태: p.progressStatus, 담당: p.manager, 마감: p.endDate, repo: p.repo, editable: true, done: isDone(p.progressStatus) }));
  const 마감: MapNode[] = repos.filter((p) => !isDone(p.progressStatus) && p.endDate && p.endDate <= 한주뒤)
    .map((p) => ({ key: `repo:${p.repo}`, 이름: p.title, 상태: p.progressStatus, 담당: p.manager, 마감: p.endDate, repo: p.repo, editable: true, done: isDone(p.progressStatus) }))
    .sort((a, b) => (a.마감 || '').localeCompare(b.마감 || ''));
  const 미수큐 = [
    ...대행노드들.filter((n) => n.장부매칭안됨),
    ...대행노드들.filter((n) => !n.장부매칭안됨 && (n.미수 || 0) > 0).sort((a, b) => (b.미수 || 0) - (a.미수 || 0)),
  ];

  // ── 돈 밴드(대행 카테고리만) ──
  const 계약합계 = 대행노드들.reduce((s, n) => s + (n.계약 || 0), 0);
  const 입금합계 = 대행노드들.reduce((s, n) => s + (n.입금 || 0), 0);

  return {
    생성: 오늘(),
    대행수: 대행Repos.length, 제품수: PRODUCT_REPOS.length, 브랜드수: BRANDS.length,
    이번주: { 대기, 마감, 미수: 미수큐 },
    돈: { 계약: 계약합계, 입금: 입금합계, 미수: Math.max(0, 계약합계 - 입금합계) },
    branches,
    제안,
  };
}
