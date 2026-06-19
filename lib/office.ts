// 사무실뷰 — 과업 단위. "공이 누구에게" 6방에 과업을 배치한다.
// 데이터 소스: 구글시트 "큐앤뱅 지출장부"의 '과업' 탭(읽기 엔드포인트가 모든 탭 export).
//   시트를 못 읽으면 lib/seed-tasks.json(미리보기 시드)으로 폴백.
// 공위치: start🌱 시작전 / mywork🛠️ 내작업 / myreply📤 내회신 / client📥 고객대기 / hold⏸️ 보류 / done✅ 완수

import seed from '@/lib/seed-tasks.json';

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
}
export interface OfficeRoom { key: string; name: string; hint: string; tasks: OfficeTask[]; }
export interface OfficeData {
  rooms: OfficeRoom[];
  가동률: Record<string, number>;
  과업수: number;
  source: 'sheet' | 'seed';   // 데이터 출처(디버그·배지용)
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
};

// 과업 시트 탭 → Seed[] 로 정규화. 못 읽으면 null(→ 폴백).
async function fetchTasksFromSheet(): Promise<Seed[] | null> {
  if (!SHEET_URL || !SHEET_KEY) return null;
  try {
    const res = await fetch(`${SHEET_URL}?key=${encodeURIComponent(SHEET_KEY)}`, { cache: 'no-store' });
    const json = await res.json();
    const rows: unknown[][] = json?.sheets?.['과업'];
    if (!Array.isArray(rows) || rows.length < 2) return null;

    const head = (rows[0] as unknown[]).map((h) => String(h));
    const col = (name: string) => head.indexOf(name);
    const ci = {
      id: col('id'), project: col('프로젝트'), task: col('과업명'), owner: col('담당자'),
      pos: col('공위치'), due: col('기한'), money: col('돈종류'),
      customer: col('고객'), todos: col('할일'),
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
        ball: POS2BALL[get(ci.pos)] || 'mywork',
        due: get(ci.due),
        money: get(ci.money) || '매출',
        customer: get(ci.customer),
        todos: todosRaw ? todosRaw.split(/\s*;\s*/).filter(Boolean) : [],
      });
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

export async function buildOffice(): Promise<OfficeData> {
  const fromSheet = await fetchTasksFromSheet();
  const source: 'sheet' | 'seed' = fromSheet ? 'sheet' : 'seed';
  const src: Seed[] = fromSheet ?? (seed as Seed[]);

  const 가동률: Record<string, number> = {};
  const tasks: OfficeTask[] = src.map((s) => {
    const dd = dday(s.due);
    const alive = s.ball !== 'hold' && s.ball !== 'done';
    const urgent = alive && dd !== null && dd >= 0 && dd <= 7;
    if (alive) 가동률[s.owner] = (가동률[s.owner] || 0) + 1;
    return {
      id: s.id, project: s.project, task: s.task, owner: s.owner,
      money: s.money, ball: s.ball, due: s.due, dday: dd, urgent,
      todos: s.todos || [],
    };
  });

  const rooms = ROOMS.map((r) => ({
    ...r,
    tasks: tasks.filter((t) => roomOf(t) === r.key),
  }));

  return { rooms, 가동률, 과업수: tasks.length, source };
}
