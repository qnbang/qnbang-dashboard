// 협업 허브 (외부 공개) — 현황판.md(SSOT)를 읽어 작업순서를 동적으로 표시한다.
// 메인 대시보드 진행현황도 같은 현황판.md를 보므로 둘이 항상 동기화된다.
import { notFound } from 'next/navigation';
import { getDoc } from '@/lib/github';
import HubView, { type Cfg, type Section } from './HubView';

export const dynamic = 'force-dynamic';

// 허브별 콘텐츠 — 현황판(체크리스트)은 SSOT에서, 바로가기·코멘트표는 여기서.
const HUB: Record<string, Cfg & { statusRepo: string; statusPath: string }> = {
  m650: {
    title: 'M650 탄광문화축제 — 제안서 디벨롭',
    sub: '11페이지 스토리라인(석탄이 6단계)을 축으로 제안서 전체를 정리하는 작업입니다. 진행 상황을 함께 관리합니다.',
    deadline: '2026-06-30',
    statusRepo: 'qnbang-proj-m650',
    statusPath: '현황판.md',
    nav: [
      { src: 'm650-meeting-board.html', title: '회의록', ic: '📝', t: '회의록', d: '회의 기록 모음' },
      { src: 'm650-actionplan.html', title: '액션플랜 — 6/30 마감', ic: '📅', t: '액션플랜', d: '6/30까지 일정·마일스톤', primary: true },
      { src: 'm650-questions.html', title: '확인사항 — 씨투아 협의', ic: '❓', t: '확인사항', d: '함께 정할 질문' },
      { src: 'm650-festival-ideas.html', title: '디벨롭 아이디어 ①~⑩', ic: '💡', t: '디벨롭 아이디어', d: '①~⑩ 추천안' },
      { src: 'm650-storyboard.html', title: '게임형 스토리보드 콘셉트', ic: '🎮', t: '스토리보드', d: '게임형 콘셉트' },
      { src: 'm650-concept-pages.html', title: '컨셉 페이지 통일안', ic: '🎨', t: '컨셉 페이지', d: '전 장소 통일' },
      { src: 'm650-story-plan.html', title: 'M650 스토리 기획안 — 장소별(최신)', ic: '📖', t: '스토리 기획안', d: '장소별 최신' },
      { src: 'm650-diagnosis.html', title: '스토리라인 정렬 진단', ic: '🔍', t: '정렬 진단', d: '현재 점검' },
    ],
    comments: [
      ['뿌리관 메인 후 프로그램, 내용 섞임', '챕터 틀(감정→미션→변화→다음)로 재서술', '큐앤뱅'],
      ["'사북의 전사들' 전시 표현 확인", '문구 초안 → 실제 전시물 유무 확인', '큐앤뱅'],
      ['플리마켓·푸드트럭 실제 진행내용', '운영 흐름·콘텐츠 구체화', '큐앤뱅'],
      ["퍼레이드 '길드처럼' 지역별 명확히", '7개 시군 길드 컨셉 + 정화 피날레로 위치 이동', '큐앤뱅'],
      ['갓챠 방법·이미지·강화권 / 빨강·파랑물', '갓챠 규칙·강화권 동선 설계, 아이템 재배치(이미지 별도)', '큐앤뱅'],
      ['개막식 더 화려 + 진행자 잔재', '아티스트·관객참여형 방향 문구화, 잔재 삭제', '큐앤뱅'],
      ['별빛폭포/도롱이연못 던전 느낌 강화', '분노 절정·봉인된 갱도·최종 던전 연출 보강', '큐앤뱅'],
      ['여름 사전이벤트(워터밤)·사전홍보', '사전홍보 프로그램 기획 초안', '큐앤뱅'],
    ],
  },
};

// 현황판.md 파싱 — ## 단계 + 체크박스(- [x]/[ ]/[~]) + [담당] 태그
function parseStatus(md: string): { sections: Section[]; done: number; total: number } {
  const lines = md.split('\n');
  const sections: Section[] = [];
  let cur: Section | null = null;
  let done = 0, total = 0;
  for (const line of lines) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) { if (cur) sections.push(cur); cur = { name: h[1], items: [] }; continue; }
    const m = line.match(/^\s*[-*]\s*\[([ xX~-])\]\s*(.+)$/);
    if (m && cur) {
      const mark = m[1].toLowerCase();
      const state: Section['items'][number]['state'] = mark === 'x' ? 'done' : (mark === '~' || mark === '-') ? 'wait' : 'todo';
      let text = m[2].trim(); let who = '';
      const w = text.match(/^\[(큐앤뱅|씨투아|협의)\]\s*/);
      if (w) { who = w[1]; text = text.slice(w[0].length); }
      cur.items.push({ state, who, text });
      total++; if (state === 'done') done++;
    }
  }
  if (cur) sections.push(cur);
  return { sections, done, total };
}

export default async function HubPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const cfg = HUB[key];
  if (!cfg) notFound();
  const md = await getDoc(cfg.statusRepo, cfg.statusPath);
  const { sections, done, total } = parseStatus(md || '');
  return <HubView cfg={cfg} sections={sections} done={done} total={total} />;
}
