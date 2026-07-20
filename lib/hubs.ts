// 협업 허브 설정(SSOT) — 허브 페이지와 체크리스트 토글 API가 같은 설정을 공유한다.
// 토글 API가 여기 statusRepo/statusPath 로만 쓰기 때문에, 임의 repo 쓰기가 원천 차단된다.
import type { Cfg } from '@/app/hub/[key]/HubView';

export type HubCfg = Cfg & { statusRepo?: string; statusPath?: string };

// ── 새 프로젝트 추가 표준(하드코딩 금지, 아래 키만 채우면 됨) ──────────────
//   title/sub/deadline : 제목·한줄설명·기준일(D-day)
//   role/footerText    : 상단 협업 표기·하단 푸터 (안 쓰면 씨투아/M650 기본)
//   ddayLabel/ddayNote : 기준일 성격. 입찰=생략(기본 '제출 마감'), 행사='피크데이' 등
//   coLabel            : 담당 범례의 협력사 이름 (기본 '씨투아', 사례별 '상인회' 등)
//   statusRepo/Path    : 체크리스트 소스(깃 repo의 현황판.md). 없으면 작업순서 블록 자동 숨김
//                        현황판 항목 담당 = 줄 앞 [큐앤뱅]/[상인회]/[협의] 태그
//   nav                : 바로가기 카드. src = public/share/*.html 파일명 OR 공유슬러그(/share/<slug>)
//   comments           : 코멘트→수정방법 표 (없으면 [])
// ──────────────────────────────────────────────────────────────────────
export const HUB: Record<string, HubCfg> = {
  mangwon: {
    title: '망원 야간 보물찾기 — 기획',
    sub: '마포구 야간·음식문화 활성화 지원사업. 골목에서 보물을 찾고, 매장 영수증으로 얻은 열쇠로 경품 보물상자에 도전. 행사 9/17(목)~9/20(일), 피크데이 9/19(토) 야간. 예산 2,000만원.',
    deadline: '2026-09-19',
    role: '큐앤뱅(QN!) × 망리단길골목형상점가 상인회',
    footerText: '큐앤뱅(QN!) × 망리단길골목형상점가 상인회 · 망원 야간 보물찾기',
    ddayLabel: '피크데이',
    ddayNote: '(행사 9/17~9/20 · 피크데이 9/19 야간)',
    coLabel: '상인회',
    statusRepo: 'qnbang-proj-mangwon',
    statusPath: '현황판.md',
    nav: [
      // 계획안·회의록은 마크다운 공유문서(슬러그) — 대시보드 '공유된 문서' 탭에서 바로 수정 가능
      { src: 'mangwon-plan', title: '1차 계획안', ic: '📋', t: '1차 계획안', d: '운영·경품·페이백·일정 (최신)', primary: true },
      { src: 'mangwon-actionplan', title: '실행 액션플랜', ic: '📅', t: '실행 액션플랜', d: '계약 확정 후 실행 단계·역할·일정' },
      // 회의록 = 데이터화된 게시판(/board/mangwon). 새 회의는 화면에서 추가(배포 불필요).
      { src: 'board:mangwon', title: '회의록', ic: '📝', t: '회의록', d: '회의 기록 모음' },
    ],
    comments: [],
  },
  m650: {
    title: 'M650 탄광문화축제 — 제안서 디벨롭',
    sub: '11페이지 스토리라인(석탄이 6단계)을 축으로 제안서 전체를 정리하는 작업입니다. 진행 상황을 함께 관리합니다.',
    deadline: '2026-06-30',
    statusRepo: 'qnbang-proj-m650',
    statusPath: '현황판.md',
    nav: [
      { src: 'board:m650', title: '회의록', ic: '📝', t: '회의록', d: '회의 기록 모음' },
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
  'good-movement': {
    title: '좋은움직임연구소 — 러너 세션 기획',
    sub: '망원 재활·운동 센터의 러너 타깃 세션 기획. 45만원(VAT 별도) · 소요 1주.',
    deadline: '2026-07-27',
    role: '큐앤뱅(QN!) × 좋은움직임연구소 · 러너 세션 기획',
    footerText: '큐앤뱅(QN!) × 좋은움직임연구소 · 러너 세션 기획',
    ddayLabel: '납품 목표',
    coLabel: '좋은움직임',
    statusRepo: 'qnbang-proj-good-movement',
    statusPath: '현황판.md',
    goal: {
      title: '러너가 “건강하자고 운동하는데 더 아픈” 상태를 벗어나게 — 대표님이 반복해서 열 수 있는 러너 세션 한 세트',
      meta: '45만원(VAT 별도) · 소요 1주 · 컨셉·운영·홍보·협업 크루까지 한 세트로 납품. 세션은 러너 회원 유입의 첫 마중물.',
    },
    deliverables: [
      { name: '세션 기획서', badge: '작성 중 · 초안 v1', badgeType: 'doing' },
      { name: '운영 매뉴얼 + 체크리스트', badge: '체크리스트만 있음' },
      { name: '홍보 문구 세트 (크루 제안·SNS·플레이스)', badge: '대기 · 7/24 관찰 후' },
      { name: '협업 크루·코치 후보 리스트', badge: '대기' },
    ],
    nav: [],
    navGroups: [
      { label: '모든 허브 공통', items: [
        { src: 'good-movement-plan', title: '진행 플랜', t: '진행 플랜', d: '4단계 흐름·일정·역할' },
        { src: 'good-movement', title: '회의록', t: '회의록', d: '미팅 기록' },
      ] },
      { label: '이 프로젝트 문서', items: [
        { src: 'survey:good-movement-survey', title: '사전 질문지', t: '사전 질문지', d: '방향 설문 (작성·전달)' },
        { src: 'good-movement-survey', title: '질문지 미리보기', t: '질문지 미리보기', d: '읽기용' },
      ] },
    ],
    comments: [],
  },
};

// statusRepo → HUB key 역인덱스. HUB가 이미 SSOT이므로 하드코딩이 아니라 자동 파생.
// 사무실 과업의 '저장소' 칸이 이 맵에 걸리면 그 과업은 해당 허브와 연결된다(카드가 현황판 단계를 우선 표시).
export const hubKeyForRepo: Record<string, string> = Object.fromEntries(
  Object.entries(HUB)
    .filter(([, c]) => c.statusRepo)
    .map(([k, c]) => [c.statusRepo as string, k])
);

// 현황판.md 에서 특정 섹션(## …)의 특정 체크박스 항목을 찾아 [x] <-> [ ] 뒤집는다.
// text = 화면에 보이는 항목 텍스트(담당 [태그] 제거·trim된 상태). page.tsx parseStatus 와 같은 규칙.
// 반환: { md 갱신본, state } 또는 못 찾으면 null.
export function toggleChecklistItem(
  md: string,
  sectionName: string,
  text: string
): { md: string; state: 'done' | 'todo' } | null {
  const lines = md.split('\n');
  let inSection = false;
  const wantSec = sectionName.trim();
  const wantText = text.trim();
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^##\s+(.+?)\s*$/);
    if (h) { inSection = h[1].trim() === wantSec; continue; }
    if (!inSection) continue;
    const m = lines[i].match(/^(\s*[-*]\s*\[)([ xX~-])(\]\s*)(.+)$/);
    if (!m) continue;
    let itemText = m[4].trim();
    const w = itemText.match(/^\[([가-힣A-Za-z]{2,6})\]\s*/);
    if (w) itemText = itemText.slice(w[0].length).trim();
    if (itemText !== wantText) continue;
    const isDone = m[2].toLowerCase() === 'x';
    const nextMark = isDone ? ' ' : 'x';
    lines[i] = m[1] + nextMark + m[3] + m[4];
    return { md: lines.join('\n'), state: isDone ? 'todo' : 'done' };
  }
  return null;
}
