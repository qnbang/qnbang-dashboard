// 자체사업 카탈로그 — 브랜드 / 큐앤뱅 서비스(도구) / 실험실 3단.
// app/page.tsx(자체사업 탭)와 app/company/CompanyMap.tsx(회사지도 '상시 브랜드' 가지)가 같이 쓰는 단일 출처.
// 새 항목은 아래 배열에 한 줄 추가. 단일 서비스는 href, 사이트/어드민처럼 갈래가 나뉘면 links.
// 로고가 있으면 logo(없으면 icon 이모지). 시트에 분류=도구로 등록된 행은 BizView가 /api/office에서 읽어 자동 합류.
export type WorkTool = {
  name: string;
  desc: string;
  color: string;
  icon?: string;
  logo?: string;
  href?: string;
  links?: { label: string; href: string }[];
  status?: string;   // 배포됨·진행 중 등 (없으면 표시 안 함)
  owner?: string;    // 담당 뱃지 (예: 김지영)
  bizKey?: 'banbo' | 'ikneunda' | 'autoboy'; // 브랜드 운영 뷰 식별자(모달 슬롯)
  sheetId?: string;  // 과업 시트 행 id (시트 도구 카드 — 메모 편집용)
  memo?: string;     // 시트 메모 원문 (도구 카드 모달 문서)
};
// 1. 브랜드 — 시장에 정착시키는 이름
export const BRANDS: WorkTool[] = [
  {
    name: '자동화청년',
    desc: '"자동화 잘하는 옆집 청년" — 인스타·스레드에 실제로 돌린 자동화를 순서대로 공유해 외주를 한 곳으로 모으는 콘텐츠 채널. 릴스·레터·캐러셀·스레드.',
    icon: '📣',
    color: 'bg-orange-50 text-orange-600 border-orange-200',
    status: '콘텐츠 제작 중',
    bizKey: 'autoboy',
    links: [{ label: '사례도감', href: 'https://jadong-cases.vercel.app' }],
  },
  {
    name: '읽는다',
    desc: '수요일 밤 충무로 인문학 사일런트 북클럽 — 침묵 독서 60분 + 해피아워("읽고 마신다"). 기획 확정, SNS 런칭 준비.',
    icon: '📖',
    color: 'bg-amber-50 text-amber-600 border-amber-200',
    status: '준비 중',
    bizKey: 'ikneunda',
  },
  {
    name: '반보',
    desc: '"반 보" 앞에서 함께 가는 지역 오프라인 커뮤니티 — 먼저 해본 멘토가 곁에서 같이 하는 모임. 오늘의 문장 1기 운영 중.',
    logo: '/logos/banbo.png',
    color: 'bg-orange-50 text-orange-600 border-orange-200',
    status: '운영 중',
    bizKey: 'banbo',
    links: [
      { label: '사이트', href: 'https://banbo-preview.vercel.app' },
      { label: '어드민', href: 'https://banbo-preview.vercel.app/admin.html' },
    ],
  },
  {
    name: '다비교',
    desc: '제품·서비스를 나란히 비교해 고르게 돕는 JV 플랫폼 — 쿠팡 제휴 링크로 자동 수익화. 전략실(대시보드) + 판매채널(프론트) 2층 구조.',
    icon: '⚖️',
    color: 'bg-rose-50 text-rose-600 border-rose-200',
    status: '진행 중',
    links: [{ label: '사이트', href: 'https://dabigyo-lab.vercel.app' }],
  },
];
// 2. 큐앤뱅 서비스 — 사면·쓰면 작동하는 도구 (시트 분류=도구 행이 뒤에 자동 합류)
export const WORK_TOOLS: WorkTool[] = [
  {
    name: '키워드 광고 도구',
    desc: '네이버 검색광고 키워드 월간 검색량·연관키워드 조회',
    href: 'https://qnbang-naver-keyword.vercel.app',
    icon: '🔍',
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    status: '배포됨',
  },
  {
    name: 'SEO 상품 작명기',
    desc: '네이버 쇼핑 데이터 기반 검색 최적화 상품명 생성',
    href: 'https://qnbang-seo-namer.vercel.app',
    icon: '✏️',
    color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    status: '배포됨',
  },
  {
    name: '스레드 링크 자동수집기',
    desc: '스레드·인스타 링크를 던지면 도구·기법을 자동 식별·요약해 위키로 쌓고, 적용 지시서까지 뽑아주는 도구',
    href: 'https://collector.qnbang.com',
    icon: '🧲',
    color: 'bg-sky-50 text-sky-600 border-sky-200',
    status: '배포됨',
  },
  {
    name: '매크로 투자 브리핑',
    desc: '글로벌 거시 흐름을 한국 투자자 언어(원화·코스피)로 번역해 매일 아침 자동 발행하는 브리핑 사이트',
    href: 'https://qnbang-macro-briefing.vercel.app',
    icon: '📈',
    color: 'bg-blue-50 text-blue-600 border-blue-200',
    status: '배포됨',
  },
  {
    name: '가격 모니터링',
    desc: '경쟁사·상품 가격을 자동 추적하는 모니터링 도구 — 서비스개발 1호',
    href: 'https://qnbang-price-monitor.vercel.app',
    icon: '💰',
    color: 'bg-teal-50 text-teal-600 border-teal-200',
    status: '배포됨',
  },
  {
    name: '큐앤뱅 위키',
    desc: '사내 지식 위키',
    icon: '📚',
    color: 'bg-violet-50 text-violet-600 border-violet-200',
    status: '진행 중',
    owner: '김지영',
  },
];
// 실험실은 2026-07-14 게시판 '실험실' 배지로 이사 — 미정·테스트는 게시판 글, 끝그림이 잡히면 여기(브랜드/서비스)로 승격.
