// 사무실뷰 — 과업 단위. "공이 누구에게" 6방에 과업을 배치한다.
// 데이터 소스: 구글시트 "큐앤뱅 지출장부"의 '과업' 탭(읽기 엔드포인트가 모든 탭 export).
//   시트를 못 읽으면 lib/seed-tasks.json(미리보기 시드)으로 폴백.
// 공위치: start🌱 시작전 / mywork🛠️ 내작업 / myreply📤 내회신 / client📥 고객대기 / hold⏸️ 보류 / done✅ 완수

import seed from '@/lib/seed-tasks.json';
import { getSheets } from './sheetCache';

const OWNER_ME = '신종호';
const SHEET_URL = process.env.SHEET_URL;
const SHEET_KEY = process.env.SHEET_KEY;

// 과업 탭 '공위치' 한글 라벨 → 내부 코드(과업POST.py BALL2POS의 역방향)
const POS2BALL: Record<string, string> = {
  '시작전': 'start', '내작업': 'mywork', '내회신': 'myreply',
  '고객대기': 'client', '보류': 'hold', '완수': 'done',
};

export interface OfficeTask {
  id: string; project: string; task: string; owner: string;
  money: string; ball: string; due: string; dday: number | null;
  urgent: boolean; todos: string[];
  status: string;          // 현재상태(지금 무슨 상황) — 시트 칸
  nextStep: string;        // 다음할일(다음 한 수) — 시트 칸, 없으면 todos[0]
  reason: string;          // 판정근거(공위치 왜) — P6가 채움
  updatedAt: string;       // 갱신일(원본)
  staleDays: number | null; // 마지막 갱신 후 며칠(노화)
  stale: boolean;          // 공위치별 임계 넘겨 "썩는 공"인가
}
export interface OfficeRoom { key: string; name: string; hint: string; tasks: OfficeTask[]; }
export interface OfficeData {
  rooms: OfficeRoom[];
  가동률: Record<string, number>;
  과업수: number;
  // 데이터 출처 — 정직한 신뢰(P1): sheet=실데이터 / seed=로컬 미리보기(시트 미설정) / unavailable=설정됐으나 못읽음(빈화면)
  source: 'sheet' | 'seed' | 'unavailable';
  syncedAt: string;   // 이 화면을 만든(=시트를 읽은) 시각(KST). "지금 보는 게 언제 것"인지.
}

const ROOMS = [
  { key: 'boss', name: '🏛️ 사장실', hint: '내 회신·급함' },
  { key: 'work', name: '🖥️ 작업 구역', hint: '내 작업 차례' },
  { key: 'lobby', name: '🚪 로비', hint: '고객 답 대기' },
  { key: 'team', name: '🧑‍🤝‍🧑 팀원 방', hint: '팀원 담당' },
  { key: 'idea', name: '💡 아이디어 보드', hint: '착수 전' },
  { key: 'store', name: '📚 자료실', hint: '보류·완수' },
];

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
  if (t.owner && t.owner !== OWNER_ME) return 'team';
  if (t.ball === 'hold' || t.ball === 'done') return 'store';
  if (t.ball === 'start') return 'idea';
  if (t.urgent || t.ball === 'myreply') return 'boss';
  if (t.ball === 'client') return 'lobby';
  return 'work'; // mywork
}

type Seed = {
  id: string; project: string; task: string; owner: string;
  ball: string; due: string; money: string; customer: string; todos: string[];
  status?: string; nextStep?: string; reason?: string; updatedAt?: string;
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
      status: col('현재상태'), nextStep: col('다음할일'), reason: col('판정근거'), updatedAt: col('갱신일'),
    };

    const out: Seed[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!Array.isArray(r) || r.every((c) => String(c ?? '').trim() === '')) continue;
      const get = (j: number) => (j >= 0 ? String(r[j] ?? '').trim() : '');
      const todosRaw = get(ci.todos);
      out.push({
        id: get(ci.id) || `r${i}`,
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
      });
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

export async function buildOffice(): Promise<OfficeData> {
  // 정직한 신뢰(P1): 시트 미설정=seed 미리보기 / 설정됐는데 못읽음=unavailable(빈화면, 박제 안 보여줌) / 정상=sheet
  let source: 'sheet' | 'seed' | 'unavailable';
  let src: Seed[];
  if (!SHEET_URL || !SHEET_KEY) {
    source = 'seed';
    src = seed as Seed[];
  } else {
    const fromSheet = await fetchTasksFromSheet();
    if (fromSheet) { source = 'sheet'; src = fromSheet; }
    else { source = 'unavailable'; src = []; }   // 시트 연결 끊김 → 빈 화면으로 정직하게(seed 박제 금지)
  }
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
      money: s.money, ball: s.ball, due: s.due, dday: dd, urgent,
      todos: s.todos || [],
      status: s.status || '',
      nextStep: s.nextStep || (s.todos && s.todos[0]) || '',
      reason: s.reason || '',
      updatedAt: s.updatedAt || '',
      staleDays, stale,
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

  const rooms = ROOMS.map((r) => ({
    ...r,
    tasks: tasks.filter((t) => roomOf(t) === r.key),
  }));

  return { rooms, 가동률, 과업수: tasks.length, source, syncedAt };
}
