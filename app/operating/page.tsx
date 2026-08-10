'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import styles from './operating.module.css';

type View = '홈' | '수신함' | '할 일' | '캘린더' | '고객 관리' | '프로젝트' | '재무·정산' | '공용 도구' | '사이트 관리' | '이관 현황' | '통합 운영 로그' | '운영 설정';
type Workstream = { name: string; outcome: string; status: string; owner: string; next: string; due?: string; links?: string };
type Project = { name: string; client: string; progress: number; next: string; status: string; owner: string; summary?: string; blocker?: string; due?: string; workstreams?: Workstream[]; hubUrl?: string };

const menuGroups: { label: string; items: View[] }[] = [
  { label: '운영', items: ['홈', '수신함', '할 일', '캘린더', '프로젝트', '고객 관리', '재무·정산'] },
  { label: '자산', items: ['공용 도구', '사이트 관리'] },
  { label: '전환', items: ['이관 현황', '통합 운영 로그', '운영 설정'] },
];
const tasks = [
  { title: '시그니처 종목과 예산 구조 확정', project: '다리마티 운동회', due: '이번 주', owner: '신종호', state: '진행 중' },
  { title: '제안 문서와 체크리스트 현황 확인', project: '브이큐 업무자동화', due: '이번 주', owner: '신종호', state: '진행 중' },
  { title: '러너 세션 납품 문서 4종 대표님 검토', project: '좋은움직임연구소 러너 세션', due: '검토 대기', owner: '신종호', state: '진행 중' },
  { title: '라이브 서비스와 어드민 최종 검수', project: '다비교랩', due: '다음 순서', owner: '신종호', state: '검수' },
  { title: '행사 개발·현장테스트 일정 재확인', project: '망원 야간보물찾기', due: '확인 필요', owner: '신종호', state: '진행 중' },
];
const projects: Project[] = [
  { name: '다리마티 운동회', client: '다리마티', progress: 18, next: '시그니처 종목과 예산 구조 확정', status: '기획 중', owner: '신종호', blocker: '후보 공간과 예산 기준 결정 필요', due: '이번 주' },
  { name: '브이큐 업무자동화', client: '브이큐스튜디오', progress: 42, next: '제안 문서와 체크리스트 현황 확인', status: '진행 중', owner: '신종호', blocker: '고객 검토 범위 확인 필요', due: '이번 주' },
  { name: '좋은움직임연구소 러너 세션', client: '좋은움직임연구소', progress: 72, next: '세션 문구 검토 결과를 반영', status: '검토 중', owner: '신종호', blocker: '대표님 검토 회신 대기', due: '검토 대기', summary: '통증·재발이 있는 일반 러너를 위한 60분 세션을, 문구·고객관리·크루 컨택까지 실제 실행 단위로 정리합니다.', workstreams: [{ name: '세션 문구 검토', outcome: '세션명과 전문 동작 표현 확정', status: '검토 중', owner: '신종호', next: '대표님 검토 의견 반영', due: '이번 주' }, { name: '고객 관리 양식 확정', outcome: '참여자 사전·사후 관리 양식 확정', status: '준비 중', owner: '신종호', next: '필수 항목 초안 작성' }, { name: '크루 컨택 준비', outcome: '우선 컨택 대상과 안내 문구 준비', status: '대기', owner: '신종호', next: '크루 후보 목록 확인' }], hubUrl: '/hub/good-movement' },
  { name: '다비교랩', client: '큐앤뱅 자체사업', progress: 92, next: '라이브 서비스와 어드민 최종 검수', status: '검수 중', owner: '신종호', blocker: '최종 검수 항목 정리 필요', due: '다음 순서' },
  { name: '망원 야간보물찾기', client: '망리단길골목형상점가 상인회', progress: 58, next: '행사 개발·현장테스트 일정 재확인', status: '진행 중', owner: '신종호', blocker: '참여 매장 명단 확인 필요', due: '확인 필요' },
];
const messages = [
  { channel: '라크', sender: '다리마티 프로젝트', time: '최신', body: '첫 행사는 10월 18일로 확정. 시그니처 종목 개발 원칙을 정리했습니다.', project: '다리마티 운동회', customer: '다리마티', action: '종목·공간·예산 우선순위 확정' },
  { channel: '문서', sender: '좋은움직임연구소', time: '오늘', body: '대표님 제공 60분 프로그램을 반영한 납품 문서 4종 초안이 준비되었습니다.', project: '좋은움직임연구소 러너 세션', customer: '좋은움직임연구소', action: '세션명·전문 동작·후속 안내 범위를 대표님과 검토' },
  { channel: '라크', sender: '망원 야간보물찾기', time: '최신', body: '개발·현장 테스트 일정과 참여 매장 명단 일정을 다시 확인해야 합니다.', project: '망원 야간보물찾기', customer: '망리단길골목형상점가 상인회', action: '크리티컬 패스 일정 점검' },
];

const sharedTools = [
  { name: '키워드 광고 도구', kind: '웹 도구', platform: '공용', purpose: '네이버 키워드 광고 데이터를 확인하는 업무 도구입니다.', url: 'https://qnbang-naver-keyword.vercel.app' },
  { name: 'SEO 상품 작명기', kind: '웹 도구', platform: '공용', purpose: '상품명 후보와 검색 노출 키워드를 정리합니다.', url: 'https://qnbang-seo-namer.vercel.app' },
  { name: '스레드 링크 자동수집기', kind: '웹 도구', platform: '공용', purpose: '스레드 링크를 수집하고 작업 후보로 정리합니다.', url: 'https://collector.qnbang.com' },
  { name: '매크로 투자 브리핑', kind: '웹 도구', platform: '공용', purpose: '시장 브리핑을 확인하는 내부 서비스입니다.', url: 'https://qnbang-macro-briefing.vercel.app' },
  { name: '가격 모니터링', kind: '웹 도구', platform: '공용', purpose: '상품 가격 변동을 확인하는 내부 서비스입니다.', url: 'https://qnbang-price-monitor.vercel.app' },
  { name: '쇼츠 자동편집기', kind: '로컬 도구', platform: 'macOS 확인됨', purpose: '현재 맥 작업환경에서 영상 전사·컷 구성·자막 작업을 실행합니다.', note: '공용도구 이관과 윈도우 실행 검증 후 팀 공용 실행 버튼을 연결합니다.' },
  { name: '시각편집기', kind: '로컬 도구', platform: 'macOS 확인됨', purpose: '정적 사이트 화면을 브라우저에서 고치고 원본 프로젝트에 저장합니다.', note: '프로젝트 폴더에서 실행합니다. 윈도우는 실행 검증이 필요합니다.' },
  { name: '이미지보정', kind: '로컬 도구', platform: 'macOS 전용', purpose: '이미지 업스케일·워터마크 제거 등 고해상도 보정 작업을 합니다.', note: '현재 제공 실행 파일이 macOS용입니다. 윈도우는 별도 패키지가 필요합니다.' },
  { name: '한글 HWPX 편집', kind: '로컬 도구', platform: 'macOS 확인됨', purpose: '한컴 없이 HWPX 문서의 내용을 교체하고 서식을 보존합니다.', note: '윈도우 실행 환경은 별도 확인이 필요합니다.' },
  { name: 'PPT 읽기', kind: '로컬 도구', platform: 'macOS 확인됨', purpose: 'PPTX 표·노트·슬라이드 내용을 정밀하게 추출합니다.', note: '윈도우 실행 환경은 별도 확인이 필요합니다.' },
  { name: '템플릿 깃 검증', kind: '로컬 도구', platform: 'Windows 확인됨', purpose: '받은 템플릿에 남은 외부 깃 기록을 정리하고 검증합니다.', note: '윈도우 PowerShell용입니다. macOS용 실행 흐름은 별도 준비가 필요합니다.' },
];

const managedSites = [
  { name: '큐앤뱅 공식 홈페이지', kind: '회사 사이트', status: '관리 주소 대조 중', site: 'https://qnbang.com', detail: '공개 홈페이지와 별도 관리 화면이 있습니다. 대시보드 회사 현황 화면으로 임의 연결하지 않고, 기존 배포 기록에서 정확한 관리 주소를 대조 중입니다.' },
  { name: '큐앤뱅 운영 대시보드', kind: '내부 운영', status: '운영 중', site: 'https://dashboard.qnbang.com', admin: 'https://dashboard.qnbang.com', detail: '팀 운영·정산·프로젝트 허브. 같은 주소에서 로그인 후 관리합니다.' },
  { name: '반보', kind: '자체 서비스', status: '운영 중', site: 'https://banbo-preview.vercel.app', admin: 'https://banbo-preview.vercel.app/admin.html', detail: '공개 화면과 전용 어드민을 분리해 운영합니다.' },
  { name: '다비교랩', kind: '자체 서비스', status: '검수 중', site: 'https://dabigyo-lab.vercel.app', admin: 'https://dabigyo-lab.vercel.app/admin', detail: '공개 서비스와 콘텐츠 관리 화면을 분리해 운영합니다.' },
  { name: '자동화청년 사례집', kind: '자체 브랜드', status: '운영 중', site: 'https://jadong-cases.vercel.app', detail: '브랜드 사례를 보여주는 공개 사이트입니다.' },
  { name: '소리쉼', kind: '고객 사이트', status: '운영 중', site: 'https://xn--oy2b17lvua.com', admin: 'https://xn--oy2b17lvua.com/admin.html', adminLabel: '고객 관리자 열기', detail: '고객이 문구·가격·사진·연락처·SEO를 수정하는 전용 관리자 화면입니다.' },
  { name: '모호소 홈페이지', kind: '고객 사이트', status: '운영 중', site: 'https://mohoso-website.vercel.app', detail: '고객 홈페이지의 공개 운영 주소입니다.' },
];

const operatingLogs = [
  { date: '2026.08.10', area: '운영OS', text: '공용 도구와 사이트 관리를 분리하고, 실제로 확인된 웹 도구·운영 주소를 자산 화면에 등록함.' },
  { date: '2026.08.09', area: '데이터 이관', text: '기존 프로젝트와 자동화청년 원본 보존 복사를 완료하고, 새 기준 공간에서 검증을 시작함.' },
  { date: '2026.08.09', area: '프로젝트 원장', text: '프로젝트별 원장을 개요·진행·할일·결정·일정·이력·링크 기준으로 전환함.' },
  { date: '2026.08.07', area: '운영OS', text: '기존 대시보드를 유지한 채 새 운영OS 화면을 별도 경로로 시작함.' },
];

const Badge = ({ children }: { children: string }) => <span className={styles.badge}>{children}</span>;

export default function OperatingPage() {
  const [view, setView] = useState<View>('홈');
  const [query, setQuery] = useState('');
  const [operatingProjects, setOperatingProjects] = useState<Project[]>(projects);
  const [selectedMessage, setSelectedMessage] = useState(messages[0]);
  const [selectedProject, setSelectedProject] = useState(projects[0]);
  const [openedProject, setOpenedProject] = useState<Project | null>(null);
  const shownProjects = useMemo(() => operatingProjects.filter((p) => `${p.name} ${p.client}`.includes(query)), [operatingProjects, query]);
  const openProject = (project: Project) => { setSelectedProject(project); setOpenedProject(project); };
  const openProjectByName = (name: string) => { const project = operatingProjects.find((item) => item.name === name); if (project) openProject(project); };

  useEffect(() => {
    fetch('/api/operating/good-movement').then(async (response) => {
      if (!response.ok) return;
      const data = await response.json();
      const next = data.tasks?.[0]?.title || data.overview?.['다음 행동'];
      const updated = operatingProjects.map((project) => project.name !== '좋은움직임연구소 러너 세션' ? project : {
        ...project,
        status: data.overview?.['상태'] || project.status,
        next: next || project.next,
        workstreams: data.workstreams?.filter((item: Workstream) => item.name) || project.workstreams,
      });
      setOperatingProjects(updated);
      setSelectedProject((project) => project.name !== '좋은움직임연구소 러너 세션' ? project : updated.find((item) => item.name === project.name) || project);
    }).catch(() => undefined);
  }, []);

  const content = () => {
    if (view === '수신함') return <Inbox selected={selectedMessage} onSelect={setSelectedMessage} />;
    if (view === '할 일') return <TaskList projects={operatingProjects} onOpenProject={openProjectByName} />;
    if (view === '캘린더') return <Calendar />;
    if (view === '고객 관리') return <Partners query={query} />;
    if (view === '프로젝트') return <Projects projects={shownProjects} selected={selectedProject} onSelect={setSelectedProject} onOpenProject={openProject} />;
    if (view === '재무·정산') return <Finance />;
    if (view === '공용 도구') return <Tools />;
    if (view === '사이트 관리') return <Sites />;
    if (view === '이관 현황') return <Migration />;
    if (view === '통합 운영 로그') return <OperatingLog />;
    if (view === '운영 설정') return <Settings />;
    return <Home onView={setView} projects={operatingProjects} onOpenProject={openProject} />;
  };

  return <div className={styles.shell}>
    <aside className={styles.side}>
      <Link className={styles.brand} href="/">QNB <span>운영OS</span></Link>
      <nav>{menuGroups.map((group) => <section className={styles.navGroup} key={group.label}><span>{group.label}</span>{group.items.map((item) => <button key={item} className={view === item ? styles.active : ''} onClick={() => setView(item)}>{item}</button>)}</section>)}</nav>
      <div className={styles.sync}><strong>전면 이관 진행</strong><p>새 기준: 큐앤뱅 뉴 대시보드</p><p>기존 시스템은 원본 보존</p></div>
    </aside>
    <main className={styles.main}>
      <header className={styles.top}><div><p className={styles.crumb}>큐앤뱅 운영 허브</p><h1>{view}</h1></div><div className={styles.actions}><input aria-label="프로젝트와 고객 검색" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="프로젝트·고객 검색"/><button className={styles.primary} onClick={() => setView('프로젝트')}>새 프로젝트</button></div></header>
      {content()}
      {openedProject && <ProjectModal project={openedProject} onClose={() => setOpenedProject(null)} />}
    </main>
  </div>;
}

function Home({ onView, projects: homeProjects, onOpenProject }: { onView: (view: View) => void; projects: Project[]; onOpenProject: (project: Project) => void }) { return <>
  <section className={styles.hero}><div><p className={styles.eyebrow}>오늘, 팀이 이어서 일할 수 있게</p><h2>놓친 대화와 다음 행동을<br/>한 곳에서 확인합니다.</h2><p>라크·메일·카카오톡·캘린더·정산 원장을 연결해, 같은 일을 두 번 입력하지 않습니다.</p></div><button className={styles.primary} onClick={() => onView('프로젝트')}>새 프로젝트</button></section>
  <section className={styles.metrics}><Metric label="새 할 일" value="8" detail="오늘 처리할 항목"/><Metric label="확인 대기" value="3" detail="정산·고객 연결 필요"/><Metric label="진행 중 프로젝트" value="3" detail="다음 행동이 등록됨"/><Metric label="오늘 일정" value="4" detail="라크·구글 캘린더"/></section>
  <section className={styles.columns}><div className={styles.panel}><Header title="통합 수신함" action="수신함 열기" onClick={() => onView('수신함')} />{messages.map((m) => <button key={m.time} className={styles.messageRow} onClick={() => onView('수신함')}><Badge>{m.channel}</Badge><span><b>{m.sender}</b><small>{m.body}</small></span><time>{m.time}</time></button>)}</div><div className={styles.panel}><Header title="오늘 우선 처리" action="할 일 보기" onClick={() => onView('할 일')} />{tasks.slice(0,3).map((t) => <div className={styles.taskRow} key={t.title}><span className={styles.check}></span><span><b>{t.title}</b><small>{t.project}</small></span><Badge>{t.due}</Badge></div>)}</div></section>
  <section className={styles.columns}><div className={styles.panel}><Header title="진행 중 프로젝트" action="프로젝트 열기" onClick={() => onView('프로젝트')} />{homeProjects.map((p) => <button className={styles.projectRow} key={p.name} onClick={() => onOpenProject(p)}><span><b>{p.name}</b><small>{p.client} · 다음 행동: {p.next}</small></span><span className={styles.progress}><i style={{ width: `${p.progress}%` }}></i></span><strong>{p.progress}%</strong></button>)}</div><div className={styles.panel}><Header title="오늘 캘린더" action="캘린더 보기" onClick={() => onView('캘린더')} /><div className={styles.schedule}><b>10:00</b><span>모호스 수정안 정리 <small>집중 작업</small></span></div><div className={styles.schedule}><b>14:00</b><span>금문도 담당자 미팅 <small>구글 캘린더</small></span></div><div className={styles.schedule}><b>16:30</b><span>프로젝트 폴더 정리 <small>라크에서 생성</small></span></div></div></section>
  <section className={styles.notice}><div><b>정산 확인 필요</b><p>카카오뱅크 입금 1건이 ‘오르’와 연결 후보입니다. 자동 분류 신뢰도 72%.</p></div><button onClick={() => onView('재무·정산')}>확인하기</button></section>
</> }

function Inbox({ selected, onSelect }: { selected: typeof messages[number]; onSelect: (item: typeof messages[number]) => void }) { return <div className={styles.inbox}><section className={styles.panel}><Header title="통합 수신함" action="전체 3건"/>{messages.map((m) => <button className={`${styles.inboxRow} ${selected.time === m.time ? styles.selected : ''}`} key={m.time} onClick={() => onSelect(m)}><Badge>{m.channel}</Badge><div><b>{m.sender}</b><p>{m.body}</p><small>{m.project}</small></div><time>{m.time}</time></button>)}</section><section className={`${styles.panel} ${styles.detail}`}><Header title="원문 대화" action={selected.channel}/><p className={styles.meta}>{selected.customer} · {selected.project}</p><div className={styles.bubble}>{selected.body}</div><div className={styles.detailInfo}><p><b>연결 고객</b>{selected.customer}</p><p><b>연결 프로젝트</b>{selected.project}</p><p><b>추천 다음 행동</b>{selected.action}</p></div><button className={styles.primary}>할 일로 등록</button></section></div> }

function TaskList({ projects: taskProjects, onOpenProject }: { projects: Project[]; onOpenProject: (name: string) => void }) { const [done, setDone] = useState<string[]>([]); const [projectFilter, setProjectFilter] = useState('전체'); const visible = tasks.filter((task) => projectFilter === '전체' || task.project === projectFilter); const toggle = (title: string) => setDone((current) => current.includes(title) ? current.filter((item) => item !== title) : [...current, title]); return <section className={styles.panel}><div className={styles.filterBar}><div><Badge>{`오늘 ${visible.filter((task) => !done.includes(task.title)).length}`}</Badge><Badge>{`완료 ${done.length}`}</Badge><Badge>{`전체 ${tasks.length}`}</Badge></div><select aria-label="프로젝트 필터" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="전체">프로젝트 전체</option>{taskProjects.map((project) => <option key={project.name} value={project.name}>{project.name}</option>)}</select></div><Header title="오늘 우선 처리" action="마감·고객 응답·정산 확인 순"/>{visible.map((t) => <div className={`${styles.taskListRow} ${done.includes(t.title) ? styles.taskDone : ''}`} key={t.title}><button className={`${styles.checkButton} ${done.includes(t.title) ? styles.checked : ''}`} aria-label={`${t.title} 완료 처리`} aria-pressed={done.includes(t.title)} onClick={() => toggle(t.title)}>{done.includes(t.title) ? '✓' : ''}</button><div><b>{t.title}</b><small>{t.owner} · {done.includes(t.title) ? '완료' : t.state}</small></div><button className={styles.taskProjectButton} onClick={() => onOpenProject(t.project)}>{t.project}</button><time>{t.due}</time></div>)}<div className={styles.waiting}><b>대기 중 3건</b><span>고객 연결·거래 분류·일정 시간 확인이 필요한 항목입니다.</span></div></section> }

function Calendar() { return <section className={styles.panel}><div className={styles.calendarHead}><div><Header title="2026년 8월 둘째 주" action="구글 캘린더 + 라크 일정"/></div><button>오늘</button></div><div className={styles.week}><div className={styles.timeCol}>시간</div>{['월 10','화 11','수 12','목 13','금 14'].map((d) => <b key={d}>{d}</b>)}<div>10:00</div><Event title="운동회 기획 정리" project="다리마티"/><div></div><Event title="계약서 최종 확인" project="좋은움직임"/><div></div><div>14:00</div><div></div><Event title="자동화 문서 점검" project="브이큐"/><div></div><div></div><div></div><div>16:30</div><Event title="행사 일정 점검" project="망원"/><div></div><Event title="서비스 최종 검수" project="다비교랩"/><div></div><div></div></div><p className={styles.calendarNote}>미팅은 구글 캘린더 일정으로, 실행해야 할 일은 프로젝트·고객과 연결된 할 일 원장으로 분리합니다.</p></section> }

type Partner = { id: string; name: string; kind: '회사' | '개인'; status: '고객' | '계약 전' | '외주·파트너'; projects: string[]; last: string; next: string; contacts: { name: string; role: string; phone?: string; email?: string; card?: string }[]; note: string };
const initialPartners: Partner[] = [
  { id: 'p-darimati', name: '다리마티', kind: '회사', status: '고객', projects: ['다리마티 운동회'], last: '8월 7일 · 라크', next: '시그니처 종목·공간·예산 구조 우선순위 확정', contacts: [{ name: '황현욱', role: '프로젝트 담당', card: '명함 등록됨' }], note: '첫 행사는 10월 18일로 확정되었습니다.' },
  { id: 'p-vq', name: '브이큐스튜디오', kind: '회사', status: '고객', projects: ['브이큐 업무자동화'], last: '8월 5일 · 문서', next: '제안 문서와 체크리스트 현황 확인', contacts: [{ name: '손정현', role: '대표', card: '명함 등록됨' }], note: '업무자동화 제안 문서와 체크리스트를 함께 확인 중입니다.' },
  { id: 'p-good', name: '좋은움직임연구소', kind: '회사', status: '고객', projects: ['좋은움직임연구소 러너 세션'], last: '7월 31일 · 문서', next: '납품 문서 4종을 대표님과 검토', contacts: [{ name: '오승식', role: '대표', email: 'contact@movementlab.kr' }], note: '60분 러너 세션의 표현·홍보·고객관리 문서를 묶어 검토합니다.' },
  { id: 'p-mangwon', name: '망리단길골목형상점가 상인회', kind: '회사', status: '고객', projects: ['망원 야간보물찾기'], last: '최신 기록 확인 필요', next: '행사 개발·현장테스트 일정 재확인', contacts: [{ name: '상인회 담당자', role: '운영 담당' }], note: '행사 일정과 참여 매장 명단을 다시 확인해야 합니다.' },
  { id: 'p-minji', name: '김민지', kind: '개인', status: '계약 전', projects: [], last: '8월 2일 · 명함', next: '첫 대화와 다음 행동 확인', contacts: [{ name: '김민지', role: '개인', card: '명함 등록됨' }], note: '명함을 받고 대화를 시작한 개인 연락처입니다.' },
];

function Partners({ query }: { query: string }) {
  const [partners, setPartners] = useState<Partner[]>(initialPartners);
  const [selectedId, setSelectedId] = useState(initialPartners[0].id);
  const [filter, setFilter] = useState<'전체' | Partner['kind']>('전체');
  const [isRegistering, setIsRegistering] = useState(false);
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [form, setForm] = useState({ partnerId: 'new', partnerName: '', kind: '회사' as Partner['kind'], status: '계약 전' as Partner['status'], contactName: '', role: '', phone: '', email: '' });
  const rows = partners.filter((partner) => (filter === '전체' || partner.kind === filter) && `${partner.name} ${partner.contacts.map((contact) => contact.name).join(' ')}`.includes(query));
  const selected = partners.find((partner) => partner.id === selectedId) || rows[0] || partners[0];
  const updateForm = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const register = () => {
    const contactName = form.contactName.trim();
    const partnerName = form.partnerId === 'new' ? form.partnerName.trim() : partners.find((partner) => partner.id === form.partnerId)?.name || '';
    if (!partnerName || !contactName) return;
    const contact = { name: contactName, role: form.role.trim() || (form.kind === '개인' ? '개인' : '담당자'), phone: form.phone.trim() || undefined, email: form.email.trim() || undefined, card: cardFile?.name || '명함 정보 직접 등록' };
    if (form.partnerId !== 'new') {
      setPartners((current) => current.map((partner) => partner.id === form.partnerId ? { ...partner, contacts: [...partner.contacts, contact], last: '방금 명함 등록', next: partner.next } : partner));
      setSelectedId(form.partnerId);
    } else {
      const id = `p-${Date.now()}`;
      setPartners((current) => [...current, { id, name: partnerName, kind: form.kind, status: form.status, projects: [], last: '방금 명함 등록', next: '첫 대화와 다음 행동 등록', contacts: [contact], note: '명함에서 새로 등록한 고객 또는 개인 연락처입니다.' }]);
      setSelectedId(id);
    }
    setCardFile(null);
    setForm({ partnerId: 'new', partnerName: '', kind: '회사', status: '계약 전', contactName: '', role: '', phone: '', email: '' });
    setIsRegistering(false);
  };
  return <>
    <section className={styles.partnerToolbar}><div><h2>고객 관리</h2><p>회사와 개인을 한 번만 등록하고, 담당자·명함·프로젝트를 연결합니다.</p></div><button className={styles.primary} onClick={() => setIsRegistering(true)}>명함 등록</button></section>
    <section className={styles.partnerFilters}>{(['전체', '회사', '개인'] as const).map((item) => <button key={item} className={filter === item ? styles.filterActive : ''} onClick={() => setFilter(item)}>{item}</button>)}</section>
    <section className={styles.partnerLayout}><div className={styles.panel}><Header title="고객·개인 목록" action={`${rows.length}건`} />{rows.length ? <div className={styles.partnerList}>{rows.map((partner) => <button className={`${styles.partnerRow} ${selected.id === partner.id ? styles.selected : ''}`} key={partner.id} onClick={() => setSelectedId(partner.id)}><div><b>{partner.name}</b><small>{partner.kind} · {partner.status} · 담당자 {partner.contacts.length}명</small></div><span><Badge>{partner.projects.length ? `${partner.projects.length}개 프로젝트` : '프로젝트 미연결'}</Badge><small>{partner.last}</small></span></button>)}</div> : <p className={styles.empty}>조건에 맞는 고객이나 개인이 없습니다.</p>}</div>
      <div className={`${styles.panel} ${styles.partnerDetail}`}><Header title={selected.name} action={`${selected.kind} · ${selected.status}`} /><p className={styles.meta}>{selected.note}</p><div className={styles.partnerSection}><h3>담당자와 명함</h3>{selected.contacts.map((contact) => <div className={styles.contactRow} key={contact.name}><div><b>{contact.name}</b><small>{contact.role}{contact.phone ? ` · ${contact.phone}` : ''}{contact.email ? ` · ${contact.email}` : ''}</small></div>{contact.card ? <Badge>{contact.card === '명함 등록됨' ? '명함 있음' : '등록됨'}</Badge> : <span className={styles.noCard}>명함 없음</span>}</div>)}</div><div className={styles.partnerSection}><h3>연결 프로젝트</h3>{selected.projects.length ? selected.projects.map((project) => <div className={styles.linkRow} key={project}><b>{project}</b><span>프로젝트 원장에서 진행 상황 확인</span></div>) : <p className={styles.empty}>아직 연결한 프로젝트가 없습니다.</p>}</div><div className={styles.partnerSection}><h3>최근 기록</h3><div className={styles.timeline}><p><b>최근 접점</b>{selected.last}</p><p><b>다음 행동</b>{selected.next}</p></div></div></div>
    </section>
    {isRegistering && <div className={styles.modalBackdrop} role="presentation"><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="card-register-title"><div className={styles.modalHead}><div><h2 id="card-register-title">명함 등록</h2><p>사진을 올리고, 연결할 회사 또는 개인과 담당자만 확인하면 됩니다.</p></div><button className={styles.closeButton} aria-label="명함 등록 닫기" onClick={() => setIsRegistering(false)}>닫기</button></div><div className={styles.formGrid}><label className={styles.fileField}><span>명함 사진</span><input type="file" accept="image/*" onChange={(event) => setCardFile(event.target.files?.[0] || null)} /><strong>{cardFile ? cardFile.name : '사진 선택'}</strong><small>자동 추출 연동 전에는 사진과 정보를 함께 보관합니다.</small></label><label className={styles.field}><span>연결할 회사 또는 개인</span><select value={form.partnerId} onChange={(event) => updateForm('partnerId', event.target.value)}><option value="new">새로 등록하기</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</select></label>{form.partnerId === 'new' && <><label className={styles.field}><span>회사명 또는 이름</span><input value={form.partnerName} onChange={(event) => updateForm('partnerName', event.target.value)} placeholder="회사명 또는 개인 이름" /></label><label className={styles.field}><span>상태</span><select value={form.status} onChange={(event) => updateForm('status', event.target.value)}><option>계약 전</option><option>고객</option><option>외주·파트너</option></select></label><label className={styles.field}><span>구분</span><select value={form.kind} onChange={(event) => updateForm('kind', event.target.value)}><option>회사</option><option>개인</option></select></label></>}<label className={styles.field}><span>담당자 이름</span><input value={form.contactName} onChange={(event) => updateForm('contactName', event.target.value)} placeholder="명함에 적힌 이름" /></label><label className={styles.field}><span>직함 또는 역할</span><input value={form.role} onChange={(event) => updateForm('role', event.target.value)} placeholder="예: 대표, 프로젝트 담당" /></label><label className={styles.field}><span>전화번호</span><input value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} placeholder="선택 입력" /></label><label className={styles.field}><span>이메일</span><input value={form.email} onChange={(event) => updateForm('email', event.target.value)} placeholder="선택 입력" /></label></div><div className={styles.modalFooter}><button className={styles.secondary} onClick={() => setIsRegistering(false)}>취소</button><button className={styles.primary} disabled={!(form.contactName.trim() && (form.partnerId !== 'new' || form.partnerName.trim()))} onClick={register}>등록하기</button></div></section></div>}
  </>;
}

function Projects({ projects: rows, selected, onSelect, onOpenProject }: { projects: Project[]; selected: Project; onSelect: (p: Project) => void; onOpenProject: (p: Project) => void }) { return <section className={styles.panel}><Header title="프로젝트 목록" action={`${rows.length}건`} />{rows.map((p) => <button className={`${styles.projectSelect} ${selected.name === p.name ? styles.selected : ''}`} onClick={() => { onSelect(p); onOpenProject(p); }} key={p.name}><span><b>{p.name}</b><small>{p.client} · 담당 {p.owner}</small><small>다음 행동 · {p.next}</small></span><Badge>{p.status}</Badge><strong>{p.progress}%</strong></button>)}</section> }

function ProjectModal({ project, onClose }: { project: Project; onClose: () => void }) { const workstreams = project.workstreams || []; return <div className={styles.modalBackdrop} role="presentation" onMouseDown={onClose}><section className={`${styles.modal} ${styles.projectModal}`} role="dialog" aria-modal="true" aria-label={`${project.name} 프로젝트 상세`} onMouseDown={(event) => event.stopPropagation()}><div className={styles.modalHead}><div><h2>{project.name}</h2><p>{project.client} · 담당 {project.owner} · 확인 시점 {project.due || '미정'}</p></div><button className={styles.closeButton} onClick={onClose}>닫기</button></div><div className={styles.projectSnapshot}><p><b>목표</b>{project.summary || '프로젝트 목표와 합의된 범위를 원장에서 확인합니다.'}</p><p><b>막힌 점</b>{project.blocker || '현재 등록된 막힘 없음'}</p><p><b>다음 행동</b>{project.next}</p></div><div className={styles.workstreamHead}><h3>진행 묶음</h3><span>결과를 만드는 업무 단위</span></div>{workstreams.length ? <div className={styles.workstreamList}>{workstreams.map((stream) => <article className={styles.workstream} key={stream.name}><div><b>{stream.name}</b><small>만들 결과 · {stream.outcome || '결과 정의 필요'}</small></div><Badge>{stream.status || '상태 확인 필요'}</Badge><p><span>담당</span>{stream.owner || '미정'}</p><p><span>다음 행동</span>{stream.next || '다음 행동 등록 필요'}</p>{stream.due && <p><span>확인 시점</span>{stream.due}</p>}{stream.links && <p><span>자료 링크</span><a href={stream.links} target="_blank" rel="noreferrer">연결 자료 열기</a></p>}</article>)}</div> : <p className={styles.empty}>아직 진행 묶음이 없습니다. 프로젝트 원장에서 결과·상태·담당·다음 행동을 먼저 등록합니다.</p>}<div className={styles.projectFootnote}><span>할일 · 결정 · 일정 · 이력 · 링크는 프로젝트 원장에서 이어서 확인합니다.</span><span>드라이브에는 실제 파일만 두고, 이 화면은 필요한 링크만 표시합니다.</span></div>{project.hubUrl && <Link className={styles.primary} href={project.hubUrl}>협업 허브 열기</Link>}</section></div> }

function Finance() { const rows = [{time:'오늘 09:12', who:'주식회사 오르', amount:'1,100,000원', type:'입금', category:'프로젝트 매출', confidence:'72%', state:'확인 필요'}, {time:'어제 16:44', who:'어도비', amount:'33,000원', type:'출금', category:'프로그램 사용료', confidence:'98%', state:'자동 분류'}, {time:'어제 13:28', who:'모호스 스튜디오', amount:'2,200,000원', type:'입금', category:'프로젝트 매출', confidence:'99%', state:'자동 분류'}]; return <><section className={styles.metrics}><Metric label="이번 달 입금" value="8,420,000" detail="확정 매출 기준"/><Metric label="이번 달 지출" value="1,264,000" detail="통장 기록 기준"/><Metric label="확인 대기" value="1" detail="사람 확인 필요"/><Metric label="미수금" value="3,300,000" detail="기존 원장 연동"/></section><section className={styles.panel}><Header title="통장 기록" action="자동 분류 · 확인 후 확정"/><table><thead><tr><th>시각</th><th>상대</th><th>금액</th><th>자동 분류</th><th>신뢰도</th><th>상태</th></tr></thead><tbody>{rows.map((r) => <tr key={r.time}><td>{r.time}</td><td><b>{r.who}</b></td><td>{r.amount}<small>{r.type}</small></td><td>{r.category}</td><td>{r.confidence}</td><td><Badge>{r.state}</Badge></td></tr>)}</tbody></table></section><section className={styles.notice}><div><b>사람 확인이 필요한 거래</b><p>‘주식회사 오르’ 입금은 고객·프로젝트 후보를 찾아두었습니다. 확인하면 기존 정산 원장에 기록합니다.</p></div><button>거래 확인</button></section></> }

function Tools() { return <>
  <section className={styles.assetIntro}><div><h2>팀 공용 도구</h2><p>실제로 실행하거나 웹에서 열 수 있는 도구만 둡니다. 결과물·개인 설정·실험 중인 파일은 이 목록에 넣지 않습니다.</p></div><Badge>07_공용도구 기준</Badge></section>
  <section className={styles.toolGrid}>{sharedTools.map((tool) => <article className={styles.tool} key={tool.name}><div className={styles.assetMeta}><Badge>{tool.kind}</Badge><Badge>{tool.platform}</Badge></div><h3>{tool.name}</h3><p>{tool.purpose}</p>{tool.url ? <a className={styles.assetLink} href={tool.url} target="_blank" rel="noreferrer">도구 열기</a> : <span className={styles.pendingLink}>{tool.note}</span>}</article>)}</section>
</> }

function Sites() { return <>
  <section className={styles.assetIntro}><div><h2>사이트 관리</h2><p>공개 사이트·관리 화면·배포된 서비스를 따로 모읍니다. 프로젝트 화면은 만드는 일을 관리하고, 이 화면은 이미 운영하는 사이트를 엽니다.</p></div><Badge>운영 자산</Badge></section>
  <section className={styles.siteGrid}>{managedSites.map((site) => <article className={styles.siteCard} key={site.name}><div className={styles.siteHeading}><div><h3>{site.name}</h3><p>{site.kind}</p></div><Badge>{site.status}</Badge></div><p className={styles.siteDetail}>{site.detail}</p><div className={styles.siteActions}>{site.site && <a className={styles.secondaryLink} href={site.site} target="_blank" rel="noreferrer">사이트 열기</a>}{site.admin && <a className={styles.assetLink} href={site.admin} target="_blank" rel="noreferrer">{site.adminLabel || '관리 화면 열기'}</a>}</div></article>)}</section>
</> }

function OperatingLog() { return <section className={styles.logLayout}><div className={styles.panel}><Header title="통합 운영 로그" action="프로젝트 로그와 분리"/><p className={styles.logGuide}>홈페이지·대시보드·도구·연동·저장 규칙처럼 여러 프로젝트에 영향을 주는 변경만 한 줄로 남깁니다.</p><div className={styles.logList}>{operatingLogs.map((log) => <article className={styles.logRow} key={`${log.date}-${log.area}`}><time>{log.date}</time><Badge>{log.area}</Badge><p>{log.text}</p></article>)}</div></div><aside className={`${styles.panel} ${styles.logRule}`}><Header title="기록 기준" action="운영원장 연결 예정"/><p><b>여기에 기록</b>사이트 수정, 배포 방식 변경, 도구 추가·폐기, 라크·카카오톡·캘린더 연결 변경</p><p><b>여기에 기록하지 않음</b>고객별 회의, 제작 피드백, 개별 프로젝트 진행 상황</p><p><b>저장 원칙</b>확정 후에는 운영원장 ‘통합 운영 로그’ 탭에 한 줄로 저장하고 이 화면에서 읽습니다.</p></aside></section> }
function Migration() { const rows = [
  ['프로젝트 파일', '기존 프로젝트 31개 확인', '새 번호·고객ID 배정 전'],
  ['고객·담당자·명함', '고객 관리 화면 우선 구축', '기존 CRM 원장 대조 전'],
  ['할 일·결정·일정', '기존 과업·캘린더 자동화 유지', '프로젝트 원장 7개 탭 이관 전'],
  ['계약·매출·지출', '기존 재무 단일원장 유지', '월별 행 수·합계 대조 전'],
  ['수신함·회의록', '라크·메일 경로 확인됨', '카카오톡봇 맥북 연결 필요'],
  ['공용도구·개인규칙', '새 드라이브 폴더 생성 완료', '실행 가능 여부 점검 전'],
]; return <><section className={styles.hero}><div><p className={styles.eyebrow}>전체 데이터 이주</p><h2>새 운영은 새 폴더에서,<br/>기존 기록은 그대로 보존합니다.</h2><p>새 기준 공간은 구글 드라이브 최상단의 ‘큐앤뱅 뉴 대시보드’입니다. 파일을 먼저 복사·대조한 뒤에만 기존 시스템을 과거 열람으로 전환합니다.</p></div><Badge>원본 삭제 없음</Badge></section><section className={styles.panel}><Header title="이관 현황" action="전면 이관 준비"/><table><thead><tr><th>데이터</th><th>현재 확인</th><th>다음 작업</th></tr></thead><tbody>{rows.map(([name, current, next]) => <tr key={name}><td><b>{name}</b></td><td>{current}</td><td>{next}</td></tr>)}</tbody></table></section><section className={styles.notice}><div><b>다른 맥북 작업 1건</b><p>카카오톡봇이 돌아가는 맥북에서 원문·발신시각·대화ID·첨부 링크를 GCP 수신 주소로 보내도록 바꾸면, 새 통합 수신함에서 고객과 프로젝트 후보를 연결할 수 있습니다.</p></div><button>작업 목록 보기</button></section></> }
function Settings() { return <section className={styles.panel}><Header title="운영OS 연결 상태" action="전면 이관 준비"/><div className={styles.settings}><p><b>구글 드라이브</b><span>‘큐앤뱅 뉴 대시보드’ 전용 루트 생성 완료</span></p><p><b>구글 시트</b><span>고객·프로젝트·할 일·수신·정산 원장을 새 기준으로 이관 예정</span></p><p><b>라크</b><span>기존 실시간 자동화를 새 통합수신함과 원장으로 단계 전환</span></p><p><b>구글 캘린더</b><span>기존 일정 원본을 보존하며 새 일정 원장으로 연결</span></p><p><b>카카오톡봇</b><span>별도 맥북의 봇을 GCP 수신 주소에 연결해야 함</span></p><p><b>GitHub</b><span>배포 코드만 유지 · 운영 지식과 문서는 드라이브 중심</span></p></div></section> }
function Header({ title, action, onClick }: { title:string; action:string; onClick?: () => void }) { return <div className={styles.panelHead}><h2>{title}</h2>{onClick ? <button onClick={onClick}>{action}</button> : <span>{action}</span>}</div> }
function Metric({ label, value, detail }: { label:string; value:string; detail:string }) { return <div className={styles.metric}><span>{label}</span><b>{value}</b><small>{detail}</small></div> }
function Event({ title, project }: { title:string; project:string }) { return <div className={styles.event}><b>{title}</b><small>{project}</small></div> }
