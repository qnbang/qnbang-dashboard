'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import styles from './operating.module.css';

type View = '홈' | '수신함' | '할 일' | '캘린더' | '고객 관리' | '프로젝트' | '재무·정산' | '공용 도구' | '운영 설정';

const menu: View[] = ['홈', '수신함', '할 일', '캘린더', '고객 관리', '프로젝트', '재무·정산', '공용 도구', '운영 설정'];
const tasks = [
  { title: '시그니처 종목과 예산 구조 확정', project: '다리마티 운동회', due: '이번 주', owner: '신종호', state: '진행 중' },
  { title: '제안 문서와 체크리스트 현황 확인', project: '브이큐 업무자동화', due: '이번 주', owner: '신종호', state: '진행 중' },
  { title: '전자서명 발송 전 계약서 최종 확인', project: '좋은움직임연구소 러너 세션', due: '확인 필요', owner: '신종호', state: '대기' },
  { title: '라이브 서비스와 어드민 최종 검수', project: '다비교랩', due: '다음 순서', owner: '신종호', state: '검수' },
  { title: '행사 개발·현장테스트 일정 재확인', project: '망원 야간보물찾기', due: '확인 필요', owner: '신종호', state: '진행 중' },
];
const projects = [
  { name: '다리마티 운동회', client: '다리마티', progress: 18, next: '시그니처 종목과 예산 구조 확정', status: '기획 중', owner: '신종호' },
  { name: '브이큐 업무자동화', client: '브이큐스튜디오', progress: 42, next: '제안 문서와 체크리스트 현황 확인', status: '진행 중', owner: '신종호' },
  { name: '좋은움직임연구소 러너 세션', client: '좋은움직임연구소', progress: 64, next: '전자서명 발송 전 계약서 최종 확인', status: '계약 진행', owner: '신종호' },
  { name: '다비교랩', client: '큐앤뱅 자체사업', progress: 92, next: '라이브 서비스와 어드민 최종 검수', status: '검수 중', owner: '신종호' },
  { name: '망원 야간보물찾기', client: '망리단길골목형상점가 상인회', progress: 58, next: '행사 개발·현장테스트 일정 재확인', status: '진행 중', owner: '신종호' },
];
const messages = [
  { channel: '라크', sender: '다리마티 프로젝트', time: '최신', body: '첫 행사는 10월 18일로 확정. 시그니처 종목 개발 원칙을 정리했습니다.', project: '다리마티 운동회', customer: '다리마티', action: '종목·공간·예산 우선순위 확정' },
  { channel: '메일', sender: '좋은움직임연구소', time: '최신', body: '계약서 전자서명 발송 전 최종 확인이 필요합니다.', project: '좋은움직임연구소 러너 세션', customer: '좋은움직임연구소', action: '계약서 확인 후 전자서명 발송' },
  { channel: '라크', sender: '망원 야간보물찾기', time: '최신', body: '개발·현장 테스트 일정과 참여 매장 명단 일정을 다시 확인해야 합니다.', project: '망원 야간보물찾기', customer: '망리단길골목형상점가 상인회', action: '크리티컬 패스 일정 점검' },
];

const Badge = ({ children }: { children: string }) => <span className={styles.badge}>{children}</span>;

export default function OperatingPage() {
  const [view, setView] = useState<View>('홈');
  const [query, setQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(messages[0]);
  const [selectedProject, setSelectedProject] = useState(projects[0]);
  const shownProjects = useMemo(() => projects.filter((p) => `${p.name} ${p.client}`.includes(query)), [query]);

  const content = () => {
    if (view === '수신함') return <Inbox selected={selectedMessage} onSelect={setSelectedMessage} />;
    if (view === '할 일') return <TaskList />;
    if (view === '캘린더') return <Calendar />;
    if (view === '고객 관리') return <Customers query={query} />;
    if (view === '프로젝트') return <Projects projects={shownProjects} selected={selectedProject} onSelect={setSelectedProject} />;
    if (view === '재무·정산') return <Finance />;
    if (view === '공용 도구') return <Tools />;
    if (view === '운영 설정') return <Settings />;
    return <Home onView={setView} />;
  };

  return <div className={styles.shell}>
    <aside className={styles.side}>
      <Link className={styles.brand} href="/">QNB <span>운영OS</span></Link>
      <nav>{menu.map((item) => <button key={item} className={view === item ? styles.active : ''} onClick={() => setView(item)}>{item}</button>)}</nav>
      <div className={styles.sync}><strong>실험 모드</strong><p>기존 라크·정산은 유지 중</p><p>원장 연결 대기</p></div>
    </aside>
    <main className={styles.main}>
      <header className={styles.top}><div><p className={styles.crumb}>큐앤뱅 운영 허브</p><h1>{view}</h1></div><div className={styles.actions}><input aria-label="프로젝트와 고객 검색" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="프로젝트·고객 검색"/><button className={styles.primary} onClick={() => setView('프로젝트')}>새 프로젝트</button></div></header>
      {content()}
    </main>
  </div>;
}

function Home({ onView }: { onView: (view: View) => void }) { return <>
  <section className={styles.hero}><div><p className={styles.eyebrow}>오늘, 팀이 이어서 일할 수 있게</p><h2>놓친 대화와 다음 행동을<br/>한 곳에서 확인합니다.</h2><p>라크·메일·카카오톡·캘린더·정산 원장을 연결해, 같은 일을 두 번 입력하지 않습니다.</p></div><button className={styles.primary} onClick={() => onView('프로젝트')}>새 프로젝트</button></section>
  <section className={styles.metrics}><Metric label="새 할 일" value="8" detail="오늘 처리할 항목"/><Metric label="확인 대기" value="3" detail="정산·고객 연결 필요"/><Metric label="진행 중 프로젝트" value="3" detail="다음 행동이 등록됨"/><Metric label="오늘 일정" value="4" detail="라크·구글 캘린더"/></section>
  <section className={styles.columns}><div className={styles.panel}><Header title="통합 수신함" action="수신함 열기" onClick={() => onView('수신함')} />{messages.map((m) => <button key={m.time} className={styles.messageRow} onClick={() => onView('수신함')}><Badge>{m.channel}</Badge><span><b>{m.sender}</b><small>{m.body}</small></span><time>{m.time}</time></button>)}</div><div className={styles.panel}><Header title="오늘 우선 처리" action="할 일 보기" onClick={() => onView('할 일')} />{tasks.slice(0,3).map((t) => <div className={styles.taskRow} key={t.title}><span className={styles.check}></span><span><b>{t.title}</b><small>{t.project}</small></span><Badge>{t.due}</Badge></div>)}</div></section>
  <section className={styles.columns}><div className={styles.panel}><Header title="진행 중 프로젝트" action="프로젝트 열기" onClick={() => onView('프로젝트')} />{projects.map((p) => <div className={styles.projectRow} key={p.name}><div><b>{p.name}</b><small>{p.client} · 다음 행동: {p.next}</small></div><div className={styles.progress}><span style={{ width: `${p.progress}%` }}></span></div><strong>{p.progress}%</strong></div>)}</div><div className={styles.panel}><Header title="오늘 캘린더" action="캘린더 보기" onClick={() => onView('캘린더')} /><div className={styles.schedule}><b>10:00</b><span>모호스 수정안 정리 <small>집중 작업</small></span></div><div className={styles.schedule}><b>14:00</b><span>금문도 담당자 미팅 <small>구글 캘린더</small></span></div><div className={styles.schedule}><b>16:30</b><span>프로젝트 폴더 정리 <small>라크에서 생성</small></span></div></div></section>
  <section className={styles.notice}><div><b>정산 확인 필요</b><p>카카오뱅크 입금 1건이 ‘오르’와 연결 후보입니다. 자동 분류 신뢰도 72%.</p></div><button onClick={() => onView('재무·정산')}>확인하기</button></section>
</> }

function Inbox({ selected, onSelect }: { selected: typeof messages[number]; onSelect: (item: typeof messages[number]) => void }) { return <div className={styles.inbox}><section className={styles.panel}><Header title="통합 수신함" action="전체 3건"/>{messages.map((m) => <button className={`${styles.inboxRow} ${selected.time === m.time ? styles.selected : ''}`} key={m.time} onClick={() => onSelect(m)}><Badge>{m.channel}</Badge><div><b>{m.sender}</b><p>{m.body}</p><small>{m.project}</small></div><time>{m.time}</time></button>)}</section><section className={`${styles.panel} ${styles.detail}`}><Header title="원문 대화" action={selected.channel}/><p className={styles.meta}>{selected.customer} · {selected.project}</p><div className={styles.bubble}>{selected.body}</div><div className={styles.detailInfo}><p><b>연결 고객</b>{selected.customer}</p><p><b>연결 프로젝트</b>{selected.project}</p><p><b>추천 다음 행동</b>{selected.action}</p></div><button className={styles.primary}>할 일로 등록</button></section></div> }

function TaskList() { return <section className={styles.panel}><div className={styles.filterBar}><div><Badge>오늘 5</Badge><Badge>이번 주 12</Badge><Badge>대기 3</Badge></div><select aria-label="프로젝트 필터"><option>프로젝트 전체</option><option>모호스 브랜드 웹사이트 개편</option><option>금문도 패키지 리뉴얼</option></select></div><Header title="오늘 우선 처리" action="마감·고객 응답·정산 확인 순"/>{tasks.map((t) => <div className={styles.taskListRow} key={t.title}><span className={styles.check}></span><div><b>{t.title}</b><small>{t.owner} · {t.state}</small></div><Badge>{t.project}</Badge><time>{t.due}</time></div>)}<div className={styles.waiting}><b>대기 중 3건</b><span>고객 연결·거래 분류·일정 시간 확인이 필요한 항목입니다.</span></div></section> }

function Calendar() { return <section className={styles.panel}><div className={styles.calendarHead}><div><Header title="2026년 8월 둘째 주" action="구글 캘린더 + 라크 일정"/></div><button>오늘</button></div><div className={styles.week}><div className={styles.timeCol}>시간</div>{['월 10','화 11','수 12','목 13','금 14'].map((d) => <b key={d}>{d}</b>)}<div>10:00</div><Event title="운동회 기획 정리" project="다리마티"/><div></div><Event title="계약서 최종 확인" project="좋은움직임"/><div></div><div>14:00</div><div></div><Event title="자동화 문서 점검" project="브이큐"/><div></div><div></div><div></div><div>16:30</div><Event title="행사 일정 점검" project="망원"/><div></div><Event title="서비스 최종 검수" project="다비교랩"/><div></div><div></div></div><p className={styles.calendarNote}>미팅은 구글 캘린더 일정으로, 실행해야 할 일은 프로젝트·고객과 연결된 할 일 원장으로 분리합니다.</p></section> }

function Customers({ query }: { query: string }) { const rows = [{name:'다리마티',person:'황현욱',state:'진행 중',project:'다리마티 운동회',last:'8월 7일'}, {name:'브이큐스튜디오',person:'손정현',state:'진행 중',project:'브이큐 업무자동화',last:'8월 5일'}, {name:'좋은움직임연구소',person:'오승식',state:'계약 진행',project:'러너 세션 기획',last:'7월 31일'}, {name:'망리단길골목형상점가 상인회',person:'상인회 담당자',state:'진행 중',project:'망원 야간보물찾기',last:'최신 기록 확인 필요'}].filter((r) => `${r.name} ${r.person}`.includes(query)); return <section className={styles.customerGrid}><div className={styles.panel}><Header title="고객사" action={`${rows.length}곳`} /><table><thead><tr><th>고객사</th><th>담당자</th><th>진행 상태</th><th>연결 프로젝트</th><th>최근 대화</th></tr></thead><tbody>{rows.map((r) => <tr key={r.name}><td><b>{r.name}</b></td><td>{r.person}</td><td><Badge>{r.state}</Badge></td><td>{r.project}</td><td>{r.last}</td></tr>)}</tbody></table></div><div className={styles.panel}><Header title="선택한 고객" action="다리마티"/><h3>다리마티</h3><p>운동회 신규 기획 · 최신 프로젝트</p><div className={styles.detailInfo}><p><b>진행 프로젝트</b>다리마티 운동회</p><p><b>최근 결정</b>첫 행사는 10월 18일로 확정</p><p><b>다음 행동</b>시그니처 종목·후보 공간·예산 구조 우선순위 확정</p></div></div></section> }

function Projects({ projects: rows, selected, onSelect }: { projects: typeof projects; selected: typeof projects[number]; onSelect: (p: typeof projects[number]) => void }) { return <div className={styles.projectLayout}><section className={styles.panel}><Header title="프로젝트 목록" action={`${rows.length}건`} />{rows.map((p) => <button className={`${styles.projectSelect} ${selected.name === p.name ? styles.selected : ''}`} onClick={() => onSelect(p)} key={p.name}><span><b>{p.name}</b><small>{p.client} · {p.owner}</small></span><Badge>{p.status}</Badge><strong>{p.progress}%</strong></button>)}</section><section className={`${styles.panel} ${styles.projectDetail}`}><Header title={selected.name} action={selected.status}/><p className={styles.meta}>{selected.client} · 담당 {selected.owner} · 진행률 {selected.progress}%</p><div className={styles.doc}><h3>프로젝트 개요</h3><p>고객과 합의한 목표, 작업 범위, 결정 사항을 이 공간에서 누적합니다. 구글 드라이브 폴더의 문서·파일을 바로 연결해 팀이 같은 맥락에서 이어서 작업합니다.</p><h3>다음 행동</h3><p>{selected.next}</p><h3>연결 자료</h3><ul><li>구글 드라이브 · 프로젝트 폴더</li><li>제안서 및 계약 관련 문서</li><li>시안 및 전달 파일</li></ul></div><button className={styles.primary}>프로젝트 열기</button></section></div> }

function Finance() { const rows = [{time:'오늘 09:12', who:'주식회사 오르', amount:'1,100,000원', type:'입금', category:'프로젝트 매출', confidence:'72%', state:'확인 필요'}, {time:'어제 16:44', who:'어도비', amount:'33,000원', type:'출금', category:'프로그램 사용료', confidence:'98%', state:'자동 분류'}, {time:'어제 13:28', who:'모호스 스튜디오', amount:'2,200,000원', type:'입금', category:'프로젝트 매출', confidence:'99%', state:'자동 분류'}]; return <><section className={styles.metrics}><Metric label="이번 달 입금" value="8,420,000" detail="확정 매출 기준"/><Metric label="이번 달 지출" value="1,264,000" detail="통장 기록 기준"/><Metric label="확인 대기" value="1" detail="사람 확인 필요"/><Metric label="미수금" value="3,300,000" detail="기존 원장 연동"/></section><section className={styles.panel}><Header title="통장 기록" action="자동 분류 · 확인 후 확정"/><table><thead><tr><th>시각</th><th>상대</th><th>금액</th><th>자동 분류</th><th>신뢰도</th><th>상태</th></tr></thead><tbody>{rows.map((r) => <tr key={r.time}><td>{r.time}</td><td><b>{r.who}</b></td><td>{r.amount}<small>{r.type}</small></td><td>{r.category}</td><td>{r.confidence}</td><td><Badge>{r.state}</Badge></td></tr>)}</tbody></table></section><section className={styles.notice}><div><b>사람 확인이 필요한 거래</b><p>‘주식회사 오르’ 입금은 고객·프로젝트 후보를 찾아두었습니다. 확인하면 기존 정산 원장에 기록합니다.</p></div><button>거래 확인</button></section></> }

function Tools() { return <section className={styles.panel}><Header title="팀 공용 도구" action="드라이브 자산"/><div className={styles.toolGrid}>{[['쇼츠 자동편집기','맥·윈도우 지원','영상 제작'], ['견적서 생성기','웹에서 사용','운영 문서'], ['키워드 검색기','웹에서 사용','마케팅']].map(([name,os,purpose]) => <div className={styles.tool} key={name}><h3>{name}</h3><p>{purpose}</p><Badge>{os}</Badge><button>사용 안내</button></div>)}</div></section> }
function Settings() { return <section className={styles.panel}><Header title="운영OS 연결 상태" action="실험 단계"/><div className={styles.settings}><p><b>구글 드라이브</b><span>공식 폴더 생성 완료 · 실험 원장 연결 대기</span></p><p><b>구글 시트</b><span>고객·프로젝트·할 일·수신·정산 확인 원장 준비</span></p><p><b>라크</b><span>기존 실시간 자동화 유지 · 신규 원장은 읽기 중심</span></p><p><b>구글 캘린더</b><span>기존 연동 유지 · 일정/할 일 분리 표시</span></p><p><b>GitHub</b><span>배포 코드만 유지 · 운영 지식과 문서는 드라이브 중심</span></p></div></section> }
function Header({ title, action, onClick }: { title:string; action:string; onClick?: () => void }) { return <div className={styles.panelHead}><h2>{title}</h2>{onClick ? <button onClick={onClick}>{action}</button> : <span>{action}</span>}</div> }
function Metric({ label, value, detail }: { label:string; value:string; detail:string }) { return <div className={styles.metric}><span>{label}</span><b>{value}</b><small>{detail}</small></div> }
function Event({ title, project }: { title:string; project:string }) { return <div className={styles.event}><b>{title}</b><small>{project}</small></div> }
