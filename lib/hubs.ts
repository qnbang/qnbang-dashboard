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
    title: '좋은움직임연구소 — 러닝 세션 A–Z',
    sub: '망원 재활·운동 센터 대표님의 러닝 세션을 일반인에게 맞게 다듬어 홍보·운영·컨택까지 한 세트로. 60만원(VAT 별도) · 검토 대기.',
    deadline: '2026-08-14',
    role: '큐앤뱅(QN!) × 좋은움직임연구소 · 러닝 세션 A–Z',
    footerText: '큐앤뱅(QN!) × 좋은움직임연구소 · 러닝 세션 A–Z',
    ddayLabel: '납품 목표(예정)',
    coLabel: '좋은움직임',
    statusRepo: 'qnbang-proj-good-movement',
    statusPath: '현황판.md',
    goal: {
      title: '통증·재발 있는 일반 러너를 위한 세션을, 반복해서 굴리고 고객·영업까지 관리하는 한 세트로',
      meta: '60만원(VAT 별도) · 크롤링 제외 약 1주 / 포함 약 2주 · 프로그램 다듬기·홍보 문구·고객 관리·크루 컨택까지 한 세트로 납품.',
    },
    deliverables: [
      { name: '프로그램 다듬기 + 세션 네이밍', badge: '예정', src: 'good-movement-session-plan' },
      { name: '홍보 문구 세트 (네이버·인스타)', badge: '예정', src: 'good-movement-promo' },
      { name: '고객 관리 세트 (체크리스트·후기·관리대장)', badge: '예정', src: 'good-movement-ops' },
      { name: '크루·모임 컨택 (리스트·템플릿·간단 크롤링)', badge: '예정', src: 'good-movement-crew' },
    ],
    nav: [],
    navGroups: [
      { label: '모든 허브 공통', items: [
        { src: 'good-movement-plan', title: '진행 계획', t: '진행 계획', d: '만드는 것·비용·일정·역할' },
        { src: 'good-movement', title: '회의록', t: '회의록', d: '미팅 기록' },
      ] },
      { label: '이 프로젝트 문서', items: [
        { src: 'good-movement-retro', title: '7/24 세션 회고', t: '7/24 세션 회고', d: '진행자 회고 설문' },
        { src: 'good-movement-survey', title: '사전 질문지', t: '사전 질문지', d: '방향 설문 (읽기용)' },
      ] },
    ],
    comments: [],
  },
  dabigyo: {
    title: '다비교랩 — JV 공동운영',
    sub: '유튜브 채널 “다비교”(구독 13.3만) × 큐앤뱅. 제품 비교 플랫폼 다비교랩(dabigyo-lab.vercel.app)을 공동 운영하고 쿠팡 제휴로 자동 수익화. 수익배분·역할·정산을 함께 관리한다.',
    deadline: '2026-08-05',
    role: '큐앤뱅(QN!) × 다비교',
    footerText: '큐앤뱅(QN!) × 다비교 · 다비교랩 공동운영',
    ddayLabel: '정식 런칭',
    coLabel: '다비교',
    statusRepo: 'qnbang-proj-dabigyo',
    statusPath: '현황판.md',
    nav: [
      { src: 'dabigyo-contract', title: '수익배분 협약서(초안)', ic: '📜', t: '수익배분 협약서', d: '제휴 65:35 · 커머스 50:50 · 정산 · 브랜드 귀속 (다비교 협의 전)', primary: true },
      { src: 'dabigyo-decisions', title: '논의·결정 사항', ic: '🧩', t: '논의·결정 사항', d: '킥오프부터 지금까지 정한 것·미결 과제' },
      { src: 'dabigyo-meeting', title: '킥오프 회의록', ic: '📝', t: '회의록', d: '2026-07-14 킥오프' },
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
    // 담당 태그·날짜를 모두 떼고 비교(화면 표시 텍스트와 같은 규칙) — 날짜 붙은 항목도 토글되게
    if (bareText(m[4]) !== wantText) continue;
    const isDone = m[2].toLowerCase() === 'x';
    const nextMark = isDone ? ' ' : 'x';
    lines[i] = m[1] + nextMark + m[3] + m[4];
    return { md: lines.join('\n'), state: isDone ? 'todo' : 'done' };
  }
  return null;
}

// 항목 텍스트만 비교하기 위해 담당 태그·날짜를 벗겨낸다(화면 표시 텍스트와 같은 규칙).
function bareText(itemText: string): string {
  let t = itemText.trim();
  const w = t.match(/^\[([가-힣A-Za-z]{2,6})\]\s*/);
  if (w) t = t.slice(w[0].length).trim();
  t = t.replace(/\s*@\s*\d{1,2}\/\d{1,2}\s*$/, '').trim();
  return t;
}

// 섹션 끝(다음 ## 직전)에 `- [ ] text` 추가. 섹션 못 찾으면 null.
export function addChecklistItem(md: string, sectionName: string, text: string): string | null {
  const lines = md.split('\n');
  const want = sectionName.trim();
  let inSec = false, lastItem = -1, secStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^##\s+(.+?)\s*$/);
    if (h) { if (inSec) break; inSec = h[1].trim() === want; if (inSec) secStart = i; continue; }
    if (inSec && /^\s*[-*]\s*\[[ xX~-]\]/.test(lines[i])) lastItem = i;
  }
  if (secStart < 0) return null;
  const at = lastItem >= 0 ? lastItem + 1 : secStart + 1;
  lines.splice(at, 0, `- [ ] ${text.trim()}`);
  return lines.join('\n');
}

// 섹션 내 해당 항목 줄 삭제. 못 찾으면 null.
export function removeChecklistItem(md: string, sectionName: string, text: string): string | null {
  const lines = md.split('\n');
  const want = sectionName.trim(), wt = text.trim();
  let inSec = false;
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^##\s+(.+?)\s*$/);
    if (h) { inSec = h[1].trim() === want; continue; }
    if (!inSec) continue;
    const m = lines[i].match(/^\s*[-*]\s*\[[ xX~-]\]\s*(.+)$/);
    if (m && bareText(m[1]) === wt) { lines.splice(i, 1); return lines.join('\n'); }
  }
  return null;
}

// 섹션 내 항목의 텍스트만 교체(체크 상태·담당 태그·날짜는 유지). 못 찾으면 null.
export function editChecklistItem(md: string, sectionName: string, oldText: string, newText: string): string | null {
  const lines = md.split('\n');
  const want = sectionName.trim(), wt = oldText.trim();
  let inSec = false;
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^##\s+(.+?)\s*$/);
    if (h) { inSec = h[1].trim() === want; continue; }
    if (!inSec) continue;
    const m = lines[i].match(/^(\s*[-*]\s*\[[ xX~-]\]\s*)(.+)$/);
    if (!m) continue;
    let rest = m[2], tag = '', date = '';
    const w = rest.match(/^\[[가-힣A-Za-z]{2,6}\]\s*/);
    if (w) { tag = w[0]; rest = rest.slice(w[0].length); }
    const dm = rest.match(/(\s*@\s*\d{1,2}\/\d{1,2}\s*)$/);
    if (dm) { date = dm[1]; rest = rest.slice(0, rest.length - dm[1].length); }
    if (rest.trim() === wt) { lines[i] = m[1] + tag + newText.trim() + date; return lines.join('\n'); }
  }
  return null;
}
