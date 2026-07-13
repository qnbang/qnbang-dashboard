// 사무실뷰 — 과업 단위. "공이 누구에게" 6방에 과업을 배치한다.
// 데이터 소스: 구글시트 "큐앤뱅 지출장부"의 '과업' 탭(읽기 엔드포인트가 모든 탭 export) — 유일 원장.
//   seed 폴백은 2026-07-13 제거(이중원장 금지 — 못 읽으면 unavailable로 정직하게 빈 화면).
// 공위치: start🌱 시작전 / mywork🛠️ 내작업 / myreply📤 내회신 / client📥 고객대기 / hold⏸️ 보류 / done✅ 완수

import { getSheets } from './sheetCache';

const SHEET_URL = process.env.SHEET_URL;
const SHEET_KEY = process.env.SHEET_KEY;

// 과업 탭 '공위치' 한글 라벨 → 내부 코드(과업POST.py BALL2POS의 역방향)
// 받은일(inbox) = 외부·메일로 막 들어와 아직 분류 안 한 입력(시작전보다 앞). 빈 공위치(unset)와 함께 받은일 바구니로.
const POS2BALL: Record<string, string> = {
  '받은일': 'inbox',
  '시작전': 'start', '내작업': 'mywork', '내회신': 'myreply',
  '고객대기': 'client', '보류': 'hold', '완수': 'done',
};

export interface OfficeTask {
  id: string; project: string; task: string; owner: string;
  client: string;          // 고객(회사) — 프로젝트와 구분. 카드 상단에 표시.
  money: string; ball: string; due: string; dday: number | null;
  urgent: boolean; todos: string[];
  category: string;        // 분류(대행/도구/리서치/자체사업/내부) — 시트 칸. 카드 색·칩 필터·포트폴리오.
  memo: string;            // 📝 메모(살아있는 현재 정리·문서 링크) — 시트 칸. 리서치 등 진행 기록.
  status: string;          // 현재상태(지금 무슨 상황) — 시트 칸
  nextStep: string;        // 다음할일(다음 한 수) — 시트 칸, 없으면 todos[0]
  reason: string;          // 판정근거(공위치 왜) — P6가 채움
  updatedAt: string;       // 갱신일(원본)
  staleDays: number | null; // 마지막 갱신 후 며칠(노화)
  stale: boolean;          // 공위치별 임계 넘겨 "썩는 공"인가
  repo: string;            // 저장소(깃 repo slug) — 시트 칸. 깃 프로젝트와 연결·중복제거 키.
  history: { when: string; what: string }[]; // 🕘 이력(이력 탭에서, 최신순) — 여정 타임라인
}
export interface OfficeRoom { key: string; name: string; hint: string; tasks: OfficeTask[]; }
export interface OfficeData {
  rooms: OfficeRoom[];
  가동률: Record<string, number>;
  과업수: number;
  // 데이터 출처 — 정직한 신뢰(P1): sheet=실데이터 / unavailable=시트 미설정 또는 못읽음(빈화면)
  source: 'sheet' | 'unavailable';
  syncedAt: string;   // 이 화면을 만든(=시트를 읽은) 시각(KST). "지금 보는 게 언제 것"인지.
  언젠가: OfficeTask[];   // 보류=언제 할지 모르는 아이디어. 메인서 빼고 따로(접힘). 오래되면 resurface.
  자체: OfficeTask[];     // 자체(내부·투자) 사업 — 고객 '공 차례' 개념 없어 방에서 빼고 따로 관리.
}

const ROOMS = [
  { key: 'boss', name: '🏛️ 사장실', hint: '내 회신·급함' },
  { key: 'work', name: '🖥️ 작업 구역', hint: '내 작업 차례' },
  { key: 'lobby', name: '🚪 로비', hint: '고객 답 대기' },
  { key: 'idea', name: '💡 아이디어 보드', hint: '착수 전' },
];
// 보류(언젠가)·완수는 메인 6방에서 빼서 따로 — 보류=언젠가 칸(접힘), 완수=아카이브(complete가 이동).

// 기한 D-day. 시트 export는 ISO UTC(예 2026-07-03T15:00:00Z=KST 7/4)라 정규식 자르기 금지.
// new Date()로 파싱 후 양쪽을 KST 자정 기준으로 환산해 일수 차를 구한다.
function kstYMD(d: Date): [number, number, number] {
  const s = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }); // 'YYYY-MM-DD'
  const [y, m, dd] = s.split('-').map(Number);
  return [y, m, dd];
}
function dday(due?: string): number | null {
  if (!due) return null;
  const d = new Date(due);
  if (isNaN(d.getTime())) return null;
  const [y, m, dd] = kstYMD(d);
  const [ty, tm, td] = kstYMD(new Date());
  return Math.round((Date.UTC(y, m - 1, dd) - Date.UTC(ty, tm - 1, td)) / 86400000);
}
// 갱신일로부터 며칠 지났나(노화). 미래/오늘=0, 과거=양수. (P2)
function daysSince(d?: string): number | null {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  const [y, m, dd] = kstYMD(dt);
  const [ty, tm, td] = kstYMD(new Date());
  return Math.max(0, Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(y, m - 1, dd)) / 86400000));
}
// 공위치별 "이만큼 안 움직이면 썩는 공" 임계(일). 로비/내회신=빨리, 작업=느긋, 미정=즉시. hold/done은 노화 안 봄.
const STALE_DAYS: Record<string, number> = { client: 7, myreply: 7, mywork: 14, unset: 3, start: 30 };

function roomOf(t: OfficeTask): string {
  // 공위치 우선 배치(담당자는 카드 태그로만). 팀원 일도 공위치대로 — 김지영 고객대기면 로비에 '김지영' 태그.
  if (t.ball === 'start') return 'idea';
  if (t.urgent || t.ball === 'myreply') return 'boss';
  if (t.ball === 'client') return 'lobby';
  return 'work'; // mywork
}

type Seed = {
  id: string; project: string; task: string; owner: string;
  ball: string; due: string; money: string; customer: string; todos: string[];
  status?: string; nextStep?: string; reason?: string; updatedAt?: string; category?: string; memo?: string; repo?: string;
  history?: { when: string; what: string }[];
};

// 과업 시트 탭 → Seed[] 로 정규화. 못 읽으면 null(→ 폴백).
async function fetchTasksFromSheet(): Promise<Seed[] | null> {
  if (!SHEET_URL || !SHEET_KEY) return null;
  try {
    const sheets = await getSheets();
    const rows: unknown[][] = sheets?.['과업'];
    if (!Array.isArray(rows) || rows.length < 2) return null;

    const head = (rows[0] as unknown[]).map((h) => String(h));
    const col = (name: string) => head.indexOf(name);
    const ci = {
      id: col('id'), project: col('프로젝트'), task: col('과업명'), owner: col('담당자'),
      pos: col('공위치'), due: col('기한'), money: col('돈종류'),
      customer: col('고객'), todos: col('할일'),
      status: col('현재상태'), nextStep: col('다음할일'), reason: col('판정근거'), updatedAt: col('갱신일'), category: col('분류'), memo: col('메모'), repo: col('저장소'),
    };

    // 🕘 이력 탭 → 과업id별 이벤트(최신순). 탭 없으면 빈 history.
    const hist: Record<string, { when: string; what: string }[]> = {};
    const hrows: unknown[][] = sheets?.['이력'];
    if (Array.isArray(hrows) && hrows.length > 1) {
      const hh = (hrows[0] as unknown[]).map((h) => String(h));
      const hi = { id: hh.indexOf('과업id'), when: hh.indexOf('시각'), what: hh.indexOf('내용') };
      for (let k = 1; k < hrows.length; k++) {
        const hr = hrows[k];
        if (!Array.isArray(hr)) continue;
        const tid = String(hr[hi.id] ?? '').trim();
        if (!tid) continue;
        (hist[tid] ||= []).push({ when: String(hr[hi.when] ?? ''), what: String(hr[hi.what] ?? '') });
      }
      for (const k of Object.keys(hist)) hist[k].reverse(); // 최신순
    }

    const out: Seed[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!Array.isArray(r) || r.every((c) => String(c ?? '').trim() === '')) continue;
      const get = (j: number) => (j >= 0 ? String(r[j] ?? '').trim() : '');
      // 유령행 스킵: 소프트삭제(칸 비우기)가 id·담당자·출처만 남긴 행 — 안 거르면 받은일 바구니에 빈 카드로 떠서 "할 일이 이상하다"가 됨(2026-07-06)
      if (!get(ci.project) && !get(ci.task)) continue;
      const todosRaw = get(ci.todos);
      const tid = get(ci.id) || `r${i}`;
      out.push({
        id: tid,
        history: hist[tid] || [],
        project: get(ci.project),
        task: get(ci.task),
        owner: get(ci.owner),
        ball: POS2BALL[get(ci.pos)] || 'unset',   // 빈 공위치는 'mywork' 가장(假裝) 금지 → '미정'으로 드러냄(P1)
        due: get(ci.due),
        money: get(ci.money) || '매출',
        customer: get(ci.customer),
        todos: todosRaw ? todosRaw.split(/\s*;\s*/).filter(Boolean) : [],
        status: get(ci.status),
        nextStep: get(ci.nextStep),
        reason: get(ci.reason),
        updatedAt: get(ci.updatedAt),
        category: get(ci.category),
        memo: get(ci.memo),
        repo: get(ci.repo),
      });
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

export async function buildOffice(): Promise<OfficeData> {
  // 정직한 신뢰(P1): 시트가 유일 원장 — 미설정·못읽음 모두 unavailable(빈화면, 박제 금지)
  let source: 'sheet' | 'unavailable';
  let src: Seed[];
  const fromSheet = (SHEET_URL && SHEET_KEY) ? await fetchTasksFromSheet() : null;
  if (fromSheet) { source = 'sheet'; src = fromSheet; }
  else { source = 'unavailable'; src = []; }
  const syncedAt = new Date().toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short',
  });

  const 가동률: Record<string, number> = {};
  const tasks: OfficeTask[] = src.map((s) => {
    const dd = dday(s.due);
    const alive = s.ball !== 'hold' && s.ball !== 'done';
    const urgent = alive && dd !== null && dd >= 0 && dd <= 7;
    const staleDays = daysSince(s.updatedAt);
    const stale = alive && staleDays !== null && staleDays >= (STALE_DAYS[s.ball] ?? Infinity);
    // 미정(unset)은 "진행 중 과업"이 아니라 분류 대기 → 가동률에서 제외(감시 견제1)
    if (alive && s.ball !== 'unset') 가동률[s.owner] = (가동률[s.owner] || 0) + 1;
    return {
      id: s.id, project: s.project, task: s.task, owner: s.owner,
      client: s.customer || s.project,
      money: s.money, ball: s.ball, due: s.due, dday: dd, urgent,
      todos: s.todos || [],
      category: s.category || '',
      memo: s.memo || '',
      status: s.status || '',
      nextStep: s.nextStep || (s.todos && s.todos[0]) || '',
      reason: s.reason || '',
      updatedAt: s.updatedAt || '',
      staleDays, stale,
      repo: s.repo || '',
      history: s.history || [],
    };
  });

  // 방 안 정렬: 급함 > 썩는 공(노화) > 기한 가까움. (기한 없으면 뒤로) — "뭐 먼저?"에 답.
  tasks.sort((a, b) => {
    const au = a.ball === 'unset', bu = b.ball === 'unset';
    if (au !== bu) return au ? -1 : 1;   // 미정=분류 필요 → 방 맨 위로 부상(감시 견제1)
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    if (a.stale !== b.stale) return a.stale ? -1 : 1;
    return (a.dday ?? 9999) - (b.dday ?? 9999);
  });

  // 보류(언젠가)·완수는 메인서 제외. 언젠가=따로 칸, 완수=아카이브로 이미 빠짐.
  const 활성 = tasks.filter((t) => t.ball !== 'hold' && t.ball !== 'done');
  // 대행(고객 일)만 방(공위치=공 차례)에. 자체(투자)는 따로 — 고객 '공 차례' 개념 없음.
  const 대행 = 활성.filter((t) => t.money !== '투자');
  const 자체 = 활성.filter((t) => t.money === '투자');
  const rooms = ROOMS.map((r) => ({
    ...r,
    tasks: 대행.filter((t) => roomOf(t) === r.key),
  }));
  const 언젠가 = tasks.filter((t) => t.ball === 'hold')
    .sort((a, b) => (b.staleDays ?? 0) - (a.staleDays ?? 0)); // 오래된 것 먼저(resurface)

  return { rooms, 가동률, 과업수: 대행.length, source, syncedAt, 언젠가, 자체 };
}
