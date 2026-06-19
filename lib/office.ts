// 사무실뷰 — 기존 프로젝트 repo(lib/github.ts)를 "공이 누구에게" 6방에 배치한다.
// 1차는 프로젝트 단위(진행상태→공위치 추론). 과업 단위 세분화는 다음 단계.
// 공위치: start🌱 시작전 / mywork🛠️ 내작업 / client📥 고객대기 / done✅ 완수 / urgent‼️ 급함

import { listProjectRepos } from '@/lib/github';

const OWNER_ME = '신종호';
const MONEY: Record<string, string> = { 대행: '매출', 자체: '투자' };

export interface OfficeCard {
  project: string; owner: string; money: string; ball: string;
  progressStatus: string; dday: number | null; urgent: boolean;
}
export interface OfficeRoom { key: string; name: string; hint: string; cards: OfficeCard[]; }
export interface OfficeData {
  rooms: OfficeRoom[];
  가동률: Record<string, number>;
  프로젝트수: number;
}

const ROOMS: { key: string; name: string; hint: string }[] = [
  { key: 'boss', name: '🏛️ 사장실', hint: '급한·내 결정' },
  { key: 'work', name: '🖥️ 작업 구역', hint: '내 작업 차례' },
  { key: 'lobby', name: '🚪 로비', hint: '고객 답 대기' },
  { key: 'team', name: '🧑‍🤝‍🧑 팀원 방', hint: '팀원 담당' },
  { key: 'idea', name: '💡 아이디어 보드', hint: '착수 전' },
  { key: 'store', name: '📚 자료실', hint: '중단·완수' },
];

function dday(endDate?: string): number | null {
  if (!endDate) return null;
  const m = endDate.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!m) return null;
  const due = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

// 진행상태 → 공위치
function ball(status: string, urgent: boolean): string {
  if (urgent) return 'urgent';
  if (status === '시작 전' || status === '시작전') return 'start';
  if (status === '피드백 대기') return 'client';
  if (status === '완료' || status === '완수') return 'done';
  if (status === '중단' || status === '보류') return 'hold';
  return 'mywork'; // 진행 중 등
}

function roomOf(c: OfficeCard, owner: string): string {
  if (owner && owner !== OWNER_ME) return 'team';
  if (c.ball === 'hold' || c.ball === 'done') return 'store';
  if (c.ball === 'start') return 'idea';
  if (c.urgent) return 'boss';
  if (c.ball === 'client') return 'lobby';
  return 'work';
}

export async function buildOffice(): Promise<OfficeData> {
  const projects = await listProjectRepos();
  const 가동률: Record<string, number> = {};
  const cards: { card: OfficeCard; room: string }[] = [];

  for (const p of projects) {
    const status = p.progressStatus || '진행 중';
    const owner = p.manager || OWNER_ME;
    const dd = dday(p.endDate);
    // 살아있는 일만 가동률 카운트(중단·완료 제외)
    const alive = status !== '완료' && status !== '완수' && status !== '중단' && status !== '보류';
    const urgent = alive && dd !== null && dd <= 7 && dd >= 0;
    const card: OfficeCard = {
      project: p.title,
      owner,
      money: MONEY[p.category || ''] || '운영',
      ball: ball(status, urgent),
      progressStatus: status,
      dday: dd,
      urgent,
    };
    if (alive) 가동률[owner] = (가동률[owner] || 0) + 1;
    cards.push({ card, room: roomOf(card, owner) });
  }

  const rooms = ROOMS.map((r) => ({
    ...r,
    cards: cards.filter((c) => c.room === r.key).map((c) => c.card),
  }));

  return { rooms, 가동률, 프로젝트수: projects.length };
}
