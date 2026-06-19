// 사무실뷰 — 과업 단위. "공이 누구에게" 6방에 과업을 배치한다.
// 과업 데이터는 lib/seed-tasks.json(미리보기 시드). 추후 구글시트 "과업" 탭으로 이전(편집·라크쓰기 가능).
// 공위치: start🌱 시작전 / mywork🛠️ 내작업 / myreply📤 내회신 / client📥 고객대기 / hold⏸️ 보류 / done✅ 완수

import seed from '@/lib/seed-tasks.json';

const OWNER_ME = '신종호';

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
}

const ROOMS = [
  { key: 'boss', name: '🏛️ 사장실', hint: '내 회신·급함' },
  { key: 'work', name: '🖥️ 작업 구역', hint: '내 작업 차례' },
  { key: 'lobby', name: '🚪 로비', hint: '고객 답 대기' },
  { key: 'team', name: '🧑‍🤝‍🧑 팀원 방', hint: '팀원 담당' },
  { key: 'idea', name: '💡 아이디어 보드', hint: '착수 전' },
  { key: 'store', name: '📚 자료실', hint: '보류·완수' },
];

function dday(due?: string): number | null {
  if (!due) return null;
  const m = due.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
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

export async function buildOffice(): Promise<OfficeData> {
  const 가동률: Record<string, number> = {};
  const tasks: OfficeTask[] = (seed as Seed[]).map((s) => {
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

  return { rooms, 가동률, 과업수: tasks.length };
}
