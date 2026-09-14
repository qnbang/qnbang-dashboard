'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import BusinessCardCapture, { type 명함등록값 } from './components/BusinessCardCapture';
import OperatingInbox, { type 수신메시지 } from './components/OperatingInbox';
import ProjectWorkspaceModal, { type 운영프로젝트 } from './components/ProjectWorkspaceModal';
import styles from './operating.module.css';

type View = '홈' | '수신함' | '할 일' | '캘린더' | '프로젝트' | '자체브랜드' | '고객 관리' | '재무·정산';
type Workstream = { name: string; outcome?: string; status?: string; owner?: string; next?: string; due?: string; links?: string };
type ProjectActivity = { id?: string; title: string; detail?: string; actor?: string; at?: string; end?: string; kind: '결정' | '일정' | '이력' };
type ProjectLink = { name: string; purpose?: string; url: string; stream?: string };
type Project = { category?: string; readable?: boolean; reason?: string; dataWarnings?: string[]; id?: string; spreadsheetId?: string; name: string; client: string; progress: number; next: string; status: string; owner: string; summary?: string; blocker?: string; due?: string; workstreams?: Workstream[]; links?: ProjectLink[]; decisions?: ProjectActivity[]; schedules?: ProjectActivity[]; histories?: ProjectActivity[]; hubUrl?: string; driveUrl?: string; lifecycle?: '현재 진행' | '고객대기' | '보류' | '완료·과거' | '착수 전' | '확인 필요'; updatedAt?: string; taskCount?: number };
type DashboardTask = { id?: string; ledgerProjectId?: string; title: string; project: string; due: string; owner: string; state: string; source?: string };
type CalendarEvent = { id: string; title: string; start: string; end?: string; allDay: boolean; location?: string; link?: string; source: string };

const menuGroups: { label: string; items: View[] }[] = [
  { label: '운영', items: ['홈', '수신함', '할 일', '캘린더', '프로젝트', '자체브랜드', '고객 관리', '재무·정산'] },
];

function 자체브랜드(project: { category?: string }) { return project.category === '자체브랜드'; }

const Badge = ({ children }: { children: string }) => <span className={styles.badge}>{children}</span>;

function StatusBadge({ lifecycle, status }: { lifecycle?: Project['lifecycle']; status: string }) {
  const state = lifecycle || (status === '진행 중' ? '현재 진행' : status);
  const tone = state === '현재 진행' ? styles.statusRunning : state === '고객대기' ? styles.statusWaiting : state === '보류' ? styles.statusHold : styles.statusComplete;
  const label = state === '현재 진행' ? '진행 중' : state;
  return <span className={`${styles.statusBadge} ${tone}`}>{label}</span>;
}

export default function OperatingPage() {
  const [view, setView] = useState<View>('홈');
  const [query, setQuery] = useState('');
  const [operatingProjects, setOperatingProjects] = useState<Project[]>([]);
  const [projectStatus, setProjectStatus] = useState('불러오는 중');
  const [ledgerTasks, setLedgerTasks] = useState<DashboardTask[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarStatus, setCalendarStatus] = useState('불러오는 중');
  const [writeStatus, setWriteStatus] = useState({ writable: false, canCreateProject: false, editableProjectIds: [] as string[], message: '새 드라이브 쓰기 권한을 확인하는 중입니다.', creationMessage: '새 프로젝트 생성 연결을 확인하는 중입니다.' });
  const [inboxMessages, setInboxMessages] = useState<수신메시지[]>([]);
  const [inboxStatus, setInboxStatus] = useState('불러오는 중');
  const [inboxNotice, setInboxNotice] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [openedProject, setOpenedProject] = useState<Project | null>(null);
  const operatingTasks = useMemo(() => {
    const 공식프로젝트명 = new Set(operatingProjects.filter((project) => project.lifecycle === '현재 진행' || project.lifecycle === '고객대기').map((project) => project.name));
    return ledgerTasks
      .filter((task, index, all) => 공식프로젝트명.has(task.project) && all.findIndex((candidate) => (task.id && candidate.id ? candidate.id === task.id && candidate.ledgerProjectId === task.ledgerProjectId : candidate.title === task.title && candidate.project === task.project)) === index);
  }, [ledgerTasks, operatingProjects]);
  const projectItems = operatingProjects.filter((project) => !자체브랜드(project));
  const brandItems = operatingProjects.filter(자체브랜드);
  const shownProjects = useMemo(() => operatingProjects.filter((p) => !자체브랜드(p) && `${p.name} ${p.client}`.includes(query)), [operatingProjects, query]);
  const openProject = (project: Project) => { setSelectedProject(project); setOpenedProject(project); };
  const openProjectByName = (name: string) => { const project = operatingProjects.find((item) => item.name === name); if (project) openProject(project); };
  const updateProject = (updated: 운영프로젝트) => {
    const applyUpdate = (project: Project): Project => ({ ...project, ...updated, lifecycle: updated.lifecycle ?? project.lifecycle });
    setOperatingProjects((current) => current.map((item) => item.id === updated.id ? applyUpdate(item) : item));
    setSelectedProject((current) => current && current.id === updated.id ? applyUpdate(current) : current);
    setOpenedProject((current) => current && current.id === updated.id ? applyUpdate(current) : current);
  };

  useEffect(() => {
    let active = true;
    let retry: ReturnType<typeof setTimeout>;
    const load = () => fetch('/api/operating/projects').then(async (response) => {
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || '프로젝트 원장 연결 실패');
      const updated = (data.items || []).filter((item: { name?: string }) => item.name).map((item: {
        category?: string; readable?: boolean; reason?: string; dataWarnings?: string[]; id?: string; spreadsheetId?: string; name: string; client: string; status: string; owner: string; due?: string; lifecycle?: Project['lifecycle']; driveUrl?: string; overview?: Record<string, string>; workstreams?: Workstream[]; tasks?: { title?: string; due?: string }[]; links?: ProjectLink[]; decisions?: ProjectActivity[]; schedules?: ProjectActivity[]; histories?: ProjectActivity[]; progress?: number;
      }) => ({
        category: item.category,
        readable: item.readable, reason: item.reason, dataWarnings: item.dataWarnings,
        id: item.id,
        spreadsheetId: item.spreadsheetId,
        name: item.name,
        client: item.client || '거래상대 확인 필요',
        progress: item.progress || 0,
        next: item.overview?.['다음 행동'] || item.workstreams?.[0]?.next || item.tasks?.[0]?.title || '다음 행동 확인 필요',
        status: item.overview?.['상태'] || item.status,
        owner: item.owner,
        summary: item.overview?.['목표'] || item.overview?.['프로젝트 설명'],
        blocker: item.overview?.['막힘'],
        due: item.due || item.overview?.['확인 시점'] || item.workstreams?.[0]?.due || item.tasks?.[0]?.due,
        workstreams: item.workstreams,
        links: item.links,
        decisions: item.decisions,
        schedules: item.schedules,
        histories: item.histories,
        lifecycle: item.lifecycle,
        driveUrl: item.driveUrl || item.links?.find((link) => link.purpose === '파일 원본 보관소')?.url,
      }));
      setLedgerTasks((data.items || []).flatMap((item: { id?: string; name?: string; tasks?: { id?: string; title?: string; due?: string; owner?: string; status?: string; source?: string }[] }) => (item.tasks || []).filter((task) => task.id && task.title && !['완료', '완수', '전달 완료', '폐기', '종료'].includes(task.status || '')).map((task) => ({ id: task.id, ledgerProjectId: item.id, title: task.title || '', project: item.name || '', due: task.due || '기한 미정', owner: task.owner || '담당 확인 필요', state: task.status || '확인 필요', source: task.source || '프로젝트 운영원장' }))));
      if (!active) return;
      setOperatingProjects(updated);
      setSelectedProject((current) => updated.find((item: Project) => item.id === current?.id) || updated[0] || null);
      const unreadable = (data.items || []).filter((item: { readable?: boolean; lifecycle?: string }) => item.readable === false && item.lifecycle !== '완료·과거').length;
      setProjectStatus(data.cached ? '이전 조회 자료 · 재연결 필요' : unreadable ? `원장 연결 확인 ${unreadable}건` : '연결됨');
    }).catch(() => {
      if (!active) return;
      setProjectStatus('잠시 후 다시 연결 중');
      retry = setTimeout(load, 5_000);
    });
    load();
    return () => { active = false; clearTimeout(retry); };
  }, []);

  useEffect(() => {
    fetch('/api/operating/inbox').then(async (response) => {
      const data = await response.json();
      setInboxMessages(data.items || []);
      setInboxStatus(data.status || (response.ok ? '연결됨' : '오류'));
      setInboxNotice(data.message || '');
    }).catch(() => {
      setInboxStatus('오류');
      setInboxNotice('통합 수신 원장 연결을 확인하지 못했습니다.');
    });
  }, []);

  useEffect(() => {
    fetch('/api/operating/calendar').then(async (response) => {
      const data = await response.json();
      setCalendarEvents(data.items || []);
      setCalendarStatus(data.message || data.status || (response.ok ? '연결됨' : '오류'));
    }).catch(() => setCalendarStatus('구글 캘린더 연결을 확인하지 못했습니다.'));
  }, []);

  useEffect(() => {
    fetch('/api/operating/write-status').then(async (response) => {
      const data = await response.json();
      setWriteStatus({ writable: Boolean(data.writable), canCreateProject: Boolean(data.canCreateProject), editableProjectIds: Array.isArray(data.editableProjectIds) ? data.editableProjectIds : [], message: data.message || '새 드라이브 쓰기 권한을 확인하지 못했습니다.', creationMessage: data.creationMessage || '새 프로젝트 생성 연결을 확인하지 못했습니다.' });
    }).catch(() => setWriteStatus({ writable: false, canCreateProject: false, editableProjectIds: [], message: '새 드라이브 쓰기 권한을 확인하지 못했습니다.', creationMessage: '새 프로젝트 생성 연결을 확인하지 못했습니다.' }));
  }, []);

  const content = () => {
    if (view === '수신함') return <OperatingInbox items={inboxMessages} status={inboxStatus} message={inboxNotice} projects={operatingProjects} onTaskCreated={(task) => setLedgerTasks((current) => [...current, task])} />;
    if (view === '할 일') return <><ScreenIntro crumb="할 일" title="할 일" description="할 일은 프로젝트 운영원장에 한 번만 기록하고, 프로젝트·캘린더에서 같은 상태를 봅니다."/><TaskList projects={operatingProjects} tasks={operatingTasks} editableProjectIds={writeStatus.editableProjectIds} writeMessage={writeStatus.message} onOpenProject={openProjectByName} onCompleted={(task) => setLedgerTasks((current) => current.filter((item) => item.id !== task.id))} /></>;
    if (view === '캘린더') return <Calendar tasks={operatingTasks} calendarEvents={calendarEvents} status={calendarStatus} />;
    if (view === '고객 관리') return <PartnersWithCardCapture query={query} />;
    if (view === '프로젝트') return <><ScreenIntro crumb="프로젝트" title="프로젝트" description="진행 중인 업무를 ‘다음 행동’과 함께 목록으로 이어갑니다."/><div className={styles.projectSearch}><input placeholder="프로젝트명, 고객사, 담당자로 검색" value={query} onChange={(event) => setQuery(event.target.value)} /></div><Projects projects={shownProjects} status={projectStatus} selected={selectedProject} creationReady={writeStatus.canCreateProject} creationMessage={writeStatus.creationMessage} onSelect={setSelectedProject} onOpenProject={openProject} onRegistered={(project) => { setOperatingProjects((current) => [...current, project]); setSelectedProject(project); }} /></>;
    if (view === '자체브랜드') return <><ScreenIntro crumb="자체브랜드" title="자체브랜드" description="반복 운영하는 브랜드와 채널의 다음 행동을 확인합니다."/><section className={styles.panel}><div className={styles.panelLead}><h2>자체브랜드 {brandItems.length}개</h2></div>{brandItems.map((brand) => <button key={brand.id} className={styles.projectRow} onClick={() => openProject(brand)}><span><b>{brand.name}</b><small>담당 {brand.owner}</small></span><StatusBadge lifecycle={brand.lifecycle} status={brand.status}/><small>{brand.next}</small></button>)}{!brandItems.length && <p className={styles.empty}>{projectStatus === '불러오는 중' ? '브랜드 원장을 불러오고 있습니다.' : '등록된 자체브랜드가 없습니다.'}</p>}</section></>;
    if (view === '재무·정산') return <Finance />;
    return <Home onView={setView} projects={projectItems} tasks={operatingTasks} onOpenProject={openProject} messages={inboxMessages} inboxStatus={inboxStatus} />;
  };

  return <div className={styles.shell}>
    <aside className={styles.side}>
      <Link className={styles.brand} href="/operating">QNB <span>운영OS</span></Link>
      <nav>{menuGroups.map((group) => <section className={styles.navGroup} key={group.label}><span>{group.label}</span>{group.items.map((item) => <button key={item} className={view === item ? styles.active : ''} onClick={() => setView(item)}>{item}</button>)}</section>)}</nav>
      <div className={styles.sync}><strong>큐앤뱅 업무 공간</strong><p>기준: 큐앤뱅 뉴 대시보드</p></div>
    </aside>
    <main className={styles.main}>
      {!(['홈', '수신함', '할 일', '프로젝트', '자체브랜드'] as View[]).includes(view) && <header className={styles.top}><div><p className={styles.crumb}>큐앤뱅 운영 허브</p><h1>{view}</h1></div><div className={styles.actions}><input aria-label="프로젝트와 고객 검색" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="프로젝트·고객 검색"/><button className={styles.primary} onClick={() => setView('프로젝트')}>프로젝트 보기</button></div></header>}
      {content()}
      {openedProject && <ProjectWorkspaceModal project={openedProject} projects={operatingProjects} tasks={operatingTasks} editableProjectIds={writeStatus.editableProjectIds} writeMessage={writeStatus.message} onProjectUpdated={updateProject} onTaskCreated={(task) => setLedgerTasks((current) => [...current, task])} onTaskCompleted={(task) => setLedgerTasks((current) => current.filter((item) => item.id !== task.id))} onClose={() => setOpenedProject(null)} />}
    </main>
  </div>;
}

function Home({ onView, projects: homeProjects, tasks: homeTasks, onOpenProject, messages: homeMessages, inboxStatus }: { onView: (view: View) => void; projects: Project[]; tasks: DashboardTask[]; onOpenProject: (project: Project) => void; messages: 수신메시지[]; inboxStatus: string }) { const currentProjects = homeProjects.filter((project) => !project.lifecycle || project.lifecycle === '현재 진행'); const waitingProjects = homeProjects.filter((project) => project.lifecycle === '고객대기'); return <>
  <section className={styles.homeIntro}><div><p className={styles.crumb}>운영 대시보드</p><h2>오늘, 팀이 이어서 일할 수 있게</h2><p>수신함과 원장을 확인해 다음 행동을 정리합니다.</p></div><button className={styles.primary} onClick={() => onView('프로젝트')}>프로젝트 보기</button></section>
  <section className={styles.todayCheck}><b>오늘 확인할 것</b><span>수신 원문 {homeMessages.length}건 · 금액 확정은 재무 원장에서 확인</span><button onClick={() => onView('수신함')}>수신함 보기</button></section>
  <section className={styles.metrics}><Metric label="새 수신" value={`${homeMessages.length}건`} detail={inboxStatus}/><Metric label="현재 할 일" value={`${homeTasks.length}건`} detail="프로젝트·자체브랜드 원장 기준"/><Metric label="진행 중" value={`${currentProjects.length}건`} detail="지금 실행 중인 프로젝트"/><Metric label="고객대기" value={`${waitingProjects.length}건`} detail="회신·확인을 기다리는 프로젝트"/></section>
  <section className={styles.columns}><div className={styles.panel}><div className={styles.panelLead}><div><h2>통합 수신함</h2><p>원문과 출처를 유지한 채, 필요한 것만 할 일로 전환합니다.</p></div><button onClick={() => onView('수신함')}>전체 보기</button></div>{homeMessages.length ? homeMessages.slice(0, 3).map((m) => <button key={m.id} className={styles.messageRow} onClick={() => onView('수신함')}><Badge>{m.channel}</Badge><span><b>{m.sender}</b><small>{m.body}</small></span><time>{m.receivedAt || '시각 미상'}</time></button>) : <p className={styles.empty}>원장에 수신 기록이 없습니다. 채널별 원문 수집 연결을 확인해 주세요.</p>}</div><div className={styles.panel}><div className={styles.panelLead}><div><h2>오늘 팀의 실행</h2><p>프로젝트 운영원장과 연결된 현재 진행 항목입니다.</p></div></div>{homeTasks.slice(0,3).map((t, index) => <button className={styles.executionRow} key={`${t.ledgerProjectId || t.project}-${t.id || t.title}`} onClick={() => onView('할 일')}><b>{t.due || ['우선', '다음', '확인'][index]}</b><span><strong>{t.title}</strong><small>{t.project}</small></span></button>)}<div className={styles.panelActions}><button onClick={() => onView('할 일')}>할 일·일정 보기</button></div></div></section>
  <section className={styles.columns}><div className={styles.panel}><div className={styles.panelLead}><div><h2>진행 프로젝트</h2><p>실제로 움직이고 있는 프로젝트만 먼저 보여줍니다.</p></div><button onClick={() => onView('프로젝트')}>프로젝트 전체</button></div>{currentProjects.slice(0, 6).map((p) => <button className={styles.projectRow} key={p.name} onClick={() => onOpenProject(p)}><span><b>{p.name}</b><small>{p.client}</small></span><StatusBadge lifecycle={p.lifecycle} status={p.status}/><small>{p.next}</small></button>)}</div><div className={styles.panel}><div className={styles.panelLead}><div><h2>정산 확인</h2><p>재무 원장의 매출·지출과 기준일이 표시된 잔고를 확인합니다.</p></div></div><p className={styles.empty}>통장 거래를 올리면 자동분류하고, 불확실한 거래만 사람이 확인합니다.</p><div className={styles.panelActions}><button className={styles.primary} onClick={() => onView('재무·정산')}>재무 원장 보기</button></div></div></section>
</> }

function ScreenIntro({ crumb, title, description, action, onAction }: { crumb:string; title:string; description:string; action?:string; onAction?:() => void }) { return <section className={styles.screenIntro}><div><p className={styles.crumb}>{crumb}</p><h1>{title}</h1><p>{description}</p></div>{action && onAction && <button className={styles.primary} onClick={onAction}>{action}</button>}</section> }

function TaskList({ projects: taskProjects, tasks: taskItems, editableProjectIds, writeMessage, onOpenProject, onCompleted }: { projects: Project[]; tasks: DashboardTask[]; editableProjectIds: string[]; writeMessage: string; onOpenProject: (name: string) => void; onCompleted: (task: DashboardTask) => void }) {
  const [projectFilter, setProjectFilter] = useState('현재 활성 프로젝트');
  const [ownerFilter, setOwnerFilter] = useState('전체 담당');
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState<'기한 빠른 순' | '기한 늦은 순'>('기한 빠른 순');
  const [selectedTitle, setSelectedTitle] = useState(taskItems[0]?.title || '');
  const [completingId, setCompletingId] = useState('');
  const [notice, setNotice] = useState('');
  const activeProjects = taskProjects.filter((project) => project.lifecycle === '현재 진행' || project.lifecycle === '고객대기');
  const activeNames = new Set(activeProjects.map((project) => project.name));
  const projectOptions = projectFilter === '현재 활성 프로젝트' ? activeProjects : taskProjects;
  const dueValue = (value: string) => {
    const matched = value.match(/(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
    if (!matched) return Number.POSITIVE_INFINITY;
    return new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3])).getTime();
  };
  const visible = taskItems
    .filter((task) => projectFilter !== '현재 활성 프로젝트' || activeNames.has(task.project))
    .filter((task) => projectFilter === '현재 활성 프로젝트' || projectFilter === '전체 프로젝트' || task.project === projectFilter)
    .filter((task) => ownerFilter === '전체 담당' || task.owner === ownerFilter || (ownerFilter === '공통' && (!task.owner || task.owner === '담당 확인 필요' || task.owner === '공통')))
    .filter((task) => `${task.title} ${task.project} ${task.owner}`.toLowerCase().includes(keyword.trim().toLowerCase()))
    .sort((a, b) => {
      const aDue = dueValue(a.due);
      const bDue = dueValue(b.due);
      if (!Number.isFinite(aDue)) return 1;
      if (!Number.isFinite(bDue)) return -1;
      return sort === '기한 빠른 순' ? aDue - bDue : bDue - aDue;
    });
  const selected = visible.find((task) => task.title === selectedTitle) || visible[0];
  const complete = async (task: DashboardTask) => {
    if (!task.id || completingId) { setNotice('이 할 일은 아직 운영원장 ID가 연결되지 않았습니다.'); return; }
    if (task.ledgerProjectId && !editableProjectIds.includes(task.ledgerProjectId)) { setNotice(writeMessage); return; }
    setCompletingId(task.id); setNotice('');
    try {
      const response = await fetch(task.ledgerProjectId ? '/api/operating/project-tasks' : '/api/office/complete', { method: task.ledgerProjectId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(task.ledgerProjectId ? { projectId: task.ledgerProjectId, taskId: task.id } : { id: task.id }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || '완료 처리에 실패했습니다.');
      onCompleted(task);
      setNotice(task.ledgerProjectId ? '프로젝트 운영원장에 완료로 기록했습니다.' : '기존 과업 원장에 완료로 기록했습니다.');
    } catch (error) { setNotice(error instanceof Error ? error.message : '완료 처리에 실패했습니다.'); }
    finally { setCompletingId(''); }
  };
  return <><div className={styles.filterBar}><div><Badge>{`현재 ${visible.length}`}</Badge><Badge>{`전체 ${taskItems.length}`}</Badge></div><input aria-label="할 일·프로젝트 검색" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="할 일·프로젝트 검색"/><select aria-label="활성 프로젝트 필터" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="현재 활성 프로젝트">현재 활성 프로젝트</option><option value="전체 프로젝트">전체 프로젝트</option>{projectOptions.map((project) => <option key={project.name} value={project.name}>{project.name}</option>)}</select><select aria-label="담당 필터" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}><option value="전체 담당">전체 담당</option><option value="신종호">신종호</option><option value="김지영">김지영</option><option value="공통">공통</option></select><select aria-label="기한 정렬" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="기한 빠른 순">기한 빠른 순</option><option value="기한 늦은 순">기한 늦은 순</option></select></div><section className={styles.taskLayout}><div className={styles.panel}><div className={styles.panelLead}><div><h2>모든 할 일</h2><p>프로젝트 운영원장을 우선으로 읽습니다. 완료 처리는 원장에 바로 기록합니다.</p></div></div>{visible.map((t) => { const canComplete = Boolean(t.id) && (!t.ledgerProjectId || editableProjectIds.includes(t.ledgerProjectId)); return <article className={`${styles.taskListRow} ${selected?.title === t.title ? styles.taskSelected : ''}`} key={`${t.ledgerProjectId || t.project}-${t.id || t.title}`}><button className={styles.checkButton} aria-label={`${t.title} 완료 처리`} title={!canComplete ? '원장 편집 권한 연결 필요' : undefined} disabled={!canComplete || Boolean(completingId)} onClick={() => void complete(t)}>{completingId === t.id ? '…' : ''}</button><button className={styles.taskTextButton} onClick={() => setSelectedTitle(t.title)}><span><b>{t.title}</b><small>{t.owner} · {t.state}</small></span><span className={styles.taskProjectButton}>{t.project}</span><time>{t.due}</time></button></article>})}{!visible.length && <p className={styles.empty}>선택한 조건에 맞는 할 일이 없습니다.</p>}<div className={styles.waiting}><b>대기 항목은 프로젝트 상태에서 분리</b><span>고객대기·보류는 프로젝트 화면에서 원래 상태 그대로 확인합니다.</span></div></div><aside className={`${styles.panel} ${styles.taskDetail}`}><div className={styles.panelLead}><div><h2>선택한 할 일</h2></div></div>{selected ? <><h3>{selected.title}</h3><Badge>{selected.due}</Badge><div className={styles.taskConnection}><p><b>연결 프로젝트</b>{selected.project}</p><p><b>담당</b>{selected.owner}</p><p><b>원문·메모</b>{selected.project}에서 이어진 할 일입니다.</p></div><button className={styles.secondary} onClick={() => onOpenProject(selected.project)}>프로젝트 열기</button><button className={styles.primary} disabled={!selected.id || Boolean(completingId) || Boolean(selected.ledgerProjectId && !editableProjectIds.includes(selected.ledgerProjectId))} onClick={() => void complete(selected)}>{completingId === selected.id ? '기록 중' : '완료 처리'}</button><small>{notice || (selected.ledgerProjectId && !editableProjectIds.includes(selected.ledgerProjectId) ? writeMessage : selected.id ? '완료 처리하면 프로젝트 운영원장에 기록되고 이 목록에서 사라집니다.' : '이 항목은 원장 ID 연결 뒤 완료 처리할 수 있습니다.')}</small></> : <p className={styles.empty}>왼쪽에서 할 일을 선택하세요.</p>}</aside></section></>;
}

function 일정으로읽기(value: string) {
  const full = value.match(/(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
  if (full) return new Date(Number(full[1]), Number(full[2]) - 1, Number(full[3]));
  const short = value.match(/(\d{1,2})[.\-/월\s]+(\d{1,2})/);
  if (short) return new Date(new Date().getFullYear(), Number(short[1]) - 1, Number(short[2]));
  return null;
}

function Calendar({ tasks: taskItems, calendarEvents, status }: { tasks: DashboardTask[]; calendarEvents: CalendarEvent[]; status: string }) {
  const [mode, setMode] = useState<'오늘' | '이번 주' | '이번 달'>('이번 주');
  const today = new Date();
  const taskEvents = taskItems.flatMap((task) => { const date = 일정으로읽기(task.due); return date ? [{ id: `task-${task.id || task.title}`, day: date.getDate(), month: date.getMonth(), year: date.getFullYear(), time: '종일', title: task.title, project: task.project, source: '할 일' }] : []; });
  const meetingEvents = calendarEvents.flatMap((event) => { const date = new Date(event.start); return Number.isNaN(date.getTime()) ? [] : [{ id: `calendar-${event.id}`, day: date.getDate(), month: date.getMonth(), year: date.getFullYear(), time: event.allDay ? '종일' : date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }), title: event.title, project: event.location || '구글 캘린더', source: '미팅' }]; });
  const events = [...meetingEvents, ...taskEvents];
  const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 5 }, (_, index) => { const date = new Date(monday); date.setDate(monday.getDate() + index); return { day: date.getDate(), month: date.getMonth(), year: date.getFullYear(), label: `${['일', '월', '화', '수', '목', '금', '토'][date.getDay()]} ${date.getDate()}` }; });
  const todayEvents = events.filter((event) => event.day === today.getDate() && event.month === today.getMonth() && event.year === today.getFullYear());
  const monthDays = Array.from({ length: new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() }, (_, index) => index + 1);
  const firstBlankDays = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
  const eventFor = (day: number, time?: string) => events.filter((event) => event.day === day && event.month === today.getMonth() && event.year === today.getFullYear() && (!time || event.time === time));
  return <section className={styles.panel}>
    <div className={styles.calendarHead}><div><Header title={mode === '오늘' ? today.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : mode === '이번 주' ? `${monday.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 주간` : today.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })} action="미팅 + 프로젝트 할 일"/></div><div className={styles.calendarModes}>{(['오늘', '이번 주', '이번 달'] as const).map((item) => <button key={item} className={mode === item ? styles.calendarModeActive : ''} onClick={() => setMode(item)}>{item}</button>)}</div></div>
    {mode === '오늘' && <div className={styles.dayAgenda}>{todayEvents.length ? todayEvents.map((event) => <article className={styles.dayAgendaRow} key={event.id}><time>{event.time}</time><div><b>{event.title}</b><small>{event.source} · {event.project}</small></div></article>) : <p className={styles.empty}>오늘 미팅이나 마감이 없습니다.</p>}</div>}
    {mode === '이번 주' && <div className={styles.week}><div className={styles.timeCol}>일정</div>{weekDays.map((day) => <b key={`${day.month}-${day.day}`}>{day.label}</b>)}<div>전체</div>{weekDays.map((day) => <div key={`all-${day.month}-${day.day}`}>{events.filter((event) => event.day === day.day && event.month === day.month && event.year === day.year).map((event) => <Event key={event.id} title={event.title} project={`${event.source} · ${event.project}`} />)}</div>)}</div>}
    {mode === '이번 달' && <div className={styles.monthCalendar}><div className={styles.monthWeekdays}>{['일', '월', '화', '수', '목', '금', '토'].map((day) => <b key={day}>{day}</b>)}</div><div className={styles.monthDays}>{Array.from({ length: firstBlankDays }, (_, index) => <span key={`blank-${index}`} className={styles.monthBlank} />)}{monthDays.map((day) => <article className={day === today.getDate() ? styles.monthToday : ''} key={day}><b>{day}</b>{eventFor(day).map((event) => <span key={event.title}>{event.title}</span>)}</article>)}</div></div>}
    <p className={styles.calendarNote}>미팅은 기존 구글 캘린더에서 읽고, 할 일은 프로젝트 운영원장의 마감일을 함께 표시합니다. {status}</p>
  </section>;
}

type Partner = { id: string; name: string; kind: '회사' | '개인'; status: '고객' | '계약 전' | '외주·파트너'; projects: string[]; last: string; next: string; contacts: { name: string; role: string; phone?: string; email?: string; card?: string }[]; note: string };

function Projects({ projects: rows, status, selected, creationReady, creationMessage, onSelect, onOpenProject, onRegistered }: { projects: Project[]; status: string; selected: Project | null; creationReady: boolean; creationMessage: string; onSelect: (p: Project) => void; onOpenProject: (p: Project) => void; onRegistered: (p: Project) => void }) {
  type 프로젝트범위 = '전체' | '진행 중' | '고객대기' | '보류' | '완료·과거' | '착수 전' | '확인 필요';
  const [scope, setScope] = useState<프로젝트범위>('전체');
  const emptyForm = { name: '', client: '', owner: '신종호', goal: '', evidenceType: '', evidenceUrl: '' };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const scopes: 프로젝트범위[] = ['전체', '진행 중', '고객대기', '보류', '확인 필요', '착수 전', '완료·과거'];
  const matchesScope = (project: Project, target: 프로젝트범위) => target === '전체' || (target === '진행 중' ? (project.lifecycle || '현재 진행') === '현재 진행' : (project.lifecycle || '현재 진행') === target);
  const visible = rows.filter((project) => matchesScope(project, scope));
  const register = async () => {
    if (!form.name.trim() || !form.client.trim() || !form.evidenceType || !form.evidenceUrl.trim() || !creationReady) return;
    setSaving(true);
    setNotice('');
    try {
      const response = await fetch('/api/operating/project-register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '프로젝트를 만들지 못했습니다.');
      onRegistered(data.project);
      setForm(emptyForm);
      setNotice('프로젝트 폴더·운영원장·중앙 인덱스를 만들었습니다.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '프로젝트를 만들지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };
  const canCreate = creationReady && !saving && Boolean(form.name.trim() && form.client.trim() && form.evidenceType && form.evidenceUrl.trim());
  return <section className={styles.projectsScreen}>
    <div className={styles.panel}>
      <div className={styles.panelLead}><div><h2>{scope === '전체' ? '전체 프로젝트' : scope}</h2><p>전체 프로젝트를 먼저 보여주며, 상태 필터로 필요한 목록만 좁혀볼 수 있습니다.</p></div><span>{status === '연결됨' ? `${visible.length}건` : status}</span></div>
      <div className={styles.filterBar}>{scopes.map((item) => <button key={item} aria-pressed={scope === item} className={scope === item ? styles.filterActive : ''} onClick={() => setScope(item)}>{item} {status === '불러오는 중' ? '—' : rows.filter((project) => matchesScope(project, item)).length}</button>)}</div>
      <div className={styles.projectTableHead}><span>프로젝트</span><span>거래상대</span><span>현재 상태</span><span>다음 행동</span><span>확인 시점</span></div>
      {visible.map((p) => <button className={`${styles.projectTableRow} ${selected?.name === p.name ? styles.selected : ''}`} onClick={() => { onSelect(p); onOpenProject(p); }} key={p.name}><span><b>{p.name}</b><small>담당 {p.owner}</small>{p.readable === false && <small>{p.reason || '원장 연결 확인 필요'}</small>}{p.dataWarnings?.map((warning) => <small key={warning}>{warning}</small>)}</span><span>{p.client}</span><span className={styles.progressCell}><StatusBadge lifecycle={p.lifecycle} status={p.status}/></span><span>{p.next}</span><time>{p.due || '미정'}</time></button>)}
      {!visible.length && <p className={styles.empty}>{status === '연결됨' ? '이 상태에 해당하는 프로젝트가 없습니다.' : '프로젝트 원장을 다시 연결하고 있습니다.'}</p>}
    </div>
    <aside className={`${styles.panel} ${styles.projectRegister}`}>
      <div className={styles.panelLead}><div><h2>새 프로젝트 등록</h2><p>계약·발주·착수 근거가 확인된 고객 업무만 프로젝트로 만듭니다.</p></div></div>
      <label className={styles.field}><span>프로젝트명</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="예: 여름 캠페인" /></label>
      <label className={styles.field}><span>거래상대</span><input value={form.client} onChange={(event) => setForm((current) => ({ ...current, client: event.target.value }))} placeholder="회사 또는 개인 이름" /></label>
      <label className={styles.field}><span>담당</span><input value={form.owner} onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))} /></label>
      <label className={styles.field}><span>목표</span><input value={form.goal} onChange={(event) => setForm((current) => ({ ...current, goal: event.target.value }))} placeholder="이번 프로젝트에서 만들 결과" /></label>
      <label className={styles.field}><span>착수 근거</span><select value={form.evidenceType} onChange={(event) => setForm((current) => ({ ...current, evidenceType: event.target.value }))}><option value="">선택</option><option value="서명 계약서">서명 계약서</option><option value="발주서">발주서</option><option value="착수금 입금">착수금 입금</option><option value="명시적 착수 승인">명시적 착수 승인</option></select></label>
      <label className={styles.field}><span>근거 링크</span><input value={form.evidenceUrl} onChange={(event) => setForm((current) => ({ ...current, evidenceUrl: event.target.value }))} placeholder="계약·발주·입금·승인 메시지 링크" /></label>
      <button className={styles.primary} disabled={!canCreate} onClick={() => void register()}>{saving ? '생성 중' : '프로젝트 만들기'}</button>
      <p className={styles.registerNotice}>{notice || (creationReady ? '계약 전 상담·견적 건은 고객관리의 영업기회로 남겨 주세요.' : creationMessage)}</p>
    </aside>
  </section>
}

type 재무화면데이터 = {
  source: string; sourceMode: string; updatedAt: string;
  summary: { month: string; income: number; expense: number; receivable: number; pendingLabor: number };
  recentExpenses: { _row: number; dateLabel: string; category: string; content: string; cost: number; note: string }[];
  bankTransactions: { id: string; date: string; counterparty: string; income: number; expense: number; category: string; confidence: string; customerId: string; projectId: string; status: string; source: string }[];
  contracts: { _row: number; 입금일full: string; 계약명: string; 클라이언트: string; 입금액: number; 미수금: number; 입금상태: string; 입금예정일: string }[];
  labor: { _row: number; 월: string; 구분: string; 이름: string; 실지급: number; 지급상태: string; 지급일: string }[];
  monthlyExpenses: { month: string; total: number }[];
  fixedCosts: { 항목: string; 금액: number; 납부일: string; 종류: string }[];
  balances: { 통장잔고: number; 세이프박스: number; 보유현금: number; 업데이트: string };
  budget: { 기준월: string; 등급: string; 남은한도: number; 써도되는돈: number; 이미쓴돈: number } | null;
  reviewQueue: { id: string; date: string; counterparty: string; income: number; expense: number; category: string; confidence: string; customerId: string; projectId: string; status: string; source: string }[];
};

const 금액 = (value: number) => `${Math.round(value || 0).toLocaleString('ko-KR')}원`;

function Finance() {
  const [data, setData] = useState<재무화면데이터 | null>(null);
  const [status, setStatus] = useState('기존 재무 원장을 읽는 중');
  const [reviewNotice, setReviewNotice] = useState('');
  const [detail, setDetail] = useState<'입금' | '지출' | '인건비' | '미수금'>('지출');
  const [uploading, setUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState('');
  const bankFileRef = useRef<HTMLInputElement>(null);

  const loadFinance = () => fetch('/api/operating/finance').then(async (response) => {
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || '재무 원장을 읽지 못했습니다.');
      setData(result);
      setStatus(`${result.source} · ${result.updatedAt} 기준`);
    }).catch((error) => setStatus(error instanceof Error ? error.message : '재무 원장을 읽지 못했습니다.'));

  useEffect(() => { void loadFinance(); }, []);

  if (!data) return <section className={styles.panel}><Header title="재무·정산" action="읽기 전용"/><p>{status}</p></section>;

  const recentMonths = data.monthlyExpenses.filter((item) => item.total > 0).slice(-4).reverse();
  const budgetDetail = data.budget
    ? `${data.budget.기준월} · ${data.budget.등급} · 남은 한도 ${금액(data.budget.남은한도)}`
    : '예산 탭을 확인해 주세요';
  const bankIncome = data.bankTransactions.filter((item) => item.income > 0);
  const bankExpense = data.bankTransactions.filter((item) => item.expense > 0);
  const detailRows = detail === '입금' ? bankIncome : detail === '지출' ? bankExpense : [];
  const uploadBank = async (file: File) => {
    setUploading(true);
    setUploadNotice('통장 거래내역을 읽고 대조하는 중입니다.');
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/company/bank', { method: 'POST', body });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || '통장 파일을 처리하지 못했습니다.');
      setUploadNotice(`거래 ${result.건수}건을 읽었습니다. 기존 원장 자동 정산 ${result.자동정산건수 || 0}건 · 이번 달 입금 ${금액(result.이번달입금)}, 출금 ${금액(result.이번달출금)} · 확인 대기 ${result.확인대기건수}건`);
      await loadFinance();
    } catch (error) {
      setUploadNotice(error instanceof Error ? error.message : '통장 파일을 처리하지 못했습니다.');
    } finally {
      setUploading(false);
      if (bankFileRef.current) bankFileRef.current.value = '';
    }
  };
  const decideReview = async (id: string, decision: '확정' | '보류') => {
    setReviewNotice('기록 중');
    try {
      const response = await fetch('/api/operating/finance', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: decision, reviewer: '신종호' }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || '처리 상태를 기록하지 못했습니다.');
      setData((current) => current ? { ...current, reviewQueue: current.reviewQueue.filter((item) => item.id !== id) } : current);
      setReviewNotice(decision === '확정' ? '확인 완료로 기록했습니다.' : '보류로 기록했습니다.');
    } catch (error) { setReviewNotice(error instanceof Error ? error.message : '처리 상태를 기록하지 못했습니다.'); }
  };

  return <>
    <section className={styles.bankUpload}>
      <div><b>카카오뱅크 거래내역 올리기</b><p>카카오뱅크 앱에서 내보낸 암호화된 `.xlsx` 파일을 그대로 선택합니다. 파일 자체는 서버나 드라이브에 보관하지 않고, 거래만 읽어 문자 알림과 대조합니다.</p></div>
      <label className={uploading ? styles.uploadDisabled : ''}><input ref={bankFileRef} type="file" accept=".xlsx" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadBank(file); }}/><span>{uploading ? '읽는 중' : '통장 파일 선택'}</span></label>
      {uploadNotice && <small>{uploadNotice}</small>}
    </section>
    <section className={styles.metrics}>
      <button className={`${styles.metric} ${styles.metricButton} ${detail === '입금' ? styles.metricSelected : ''}`} onClick={() => setDetail('입금')}><span>이번 달 입금</span><b>{금액(data.summary.income)}</b><small>{data.sourceMode}</small></button>
      <button className={`${styles.metric} ${styles.metricButton} ${detail === '지출' ? styles.metricSelected : ''}`} onClick={() => setDetail('지출')}><span>이번 달 지출</span><b>{금액(data.summary.expense)}</b><small>{data.sourceMode}</small></button>
      <button className={`${styles.metric} ${styles.metricButton} ${detail === '인건비' ? styles.metricSelected : ''}`} onClick={() => setDetail('인건비')}><span>지급 대기 인건비</span><b>{금액(data.summary.pendingLabor)}</b><small>지급 전 예정액</small></button>
      <button className={`${styles.metric} ${styles.metricButton} ${detail === '미수금' ? styles.metricSelected : ''}`} onClick={() => setDetail('미수금')}><span>미수금</span><b>{금액(data.summary.receivable)}</b><small>아직 입금되지 않은 계약</small></button>
    </section>
    <section className={styles.panel}>
      <Header title={`${detail} 상세`} action={`${data.source} · ${data.updatedAt}`}/>
      {(detail === '입금' || detail === '지출') && (detailRows.length ? <table><thead><tr><th>거래시각</th><th>상대·내용</th><th>분류</th><th>금액</th><th>확인</th></tr></thead><tbody>{detailRows.map((item) => <tr key={item.id}><td>{item.date || '시각 미상'}</td><td><b>{item.counterparty || '상대 미상'}</b><small>{item.source || '통장 거래'}</small></td><td>{item.category || '미분류'}</td><td>{금액(detail === '입금' ? item.income : item.expense)}</td><td>{item.status || '확인 필요'}</td></tr>)}</tbody></table> : detail === '지출' && data.recentExpenses.length ? <><p className={styles.logGuide}>아직 이번 달 통장 거래 파일이 없어 기존 지출 원장을 임시로 보여줍니다. 다음 통장 자료를 올리면 거래 원본 기준으로 전환됩니다.</p><table><thead><tr><th>날짜</th><th>내용</th><th>분류</th><th>금액</th></tr></thead><tbody>{data.recentExpenses.map((item) => <tr key={item._row}><td>{item.dateLabel || '날짜 미상'}</td><td><b>{item.content || '내용 미상'}</b>{item.note && <small>{item.note}</small>}</td><td>{item.category || '미분류'}</td><td>{금액(item.cost)}</td></tr>)}</tbody></table></> : <p className={styles.empty}>아직 통장 거래 원본에서 확인된 {detail} 내역이 없습니다.</p>)}
      {detail === '인건비' && (data.labor.filter((item) => item.지급상태 !== '지급완료').length ? <table><thead><tr><th>귀속월</th><th>이름</th><th>구분</th><th>실지급액</th><th>상태</th></tr></thead><tbody>{data.labor.filter((item) => item.지급상태 !== '지급완료').map((item) => <tr key={item._row}><td>{item.월 || '미정'}</td><td><b>{item.이름}</b></td><td>{item.구분 || '미기록'}</td><td>{금액(item.실지급)}</td><td>{item.지급상태 || '대기'}</td></tr>)}</tbody></table> : <p className={styles.empty}>지급을 기다리는 인건비가 없습니다.</p>)}
      {detail === '미수금' && (data.contracts.filter((item) => item.미수금 > 0).length ? <table><thead><tr><th>계약</th><th>거래상대</th><th>입금 상태</th><th>입금 예정</th><th>미수금</th></tr></thead><tbody>{data.contracts.filter((item) => item.미수금 > 0).map((item) => <tr key={item._row}><td><b>{item.계약명}</b></td><td>{item.클라이언트 || '미기록'}</td><td>{item.입금상태 || '미입금'}</td><td>{item.입금예정일 || '미정'}</td><td>{금액(item.미수금)}</td></tr>)}</tbody></table> : <p className={styles.empty}>현재 미수금이 없습니다.</p>)}
    </section>
    <section className={styles.columns}>
      <section className={styles.panel}>
        <Header title="최근 지출 기록" action={status}/>
        <table><thead><tr><th>날짜</th><th>내용</th><th>분류</th><th>금액</th></tr></thead><tbody>
          {data.recentExpenses.map((item) => <tr key={item._row}><td>{item.dateLabel || '날짜 미상'}</td><td><b>{item.content || '내용 미상'}</b>{item.note && <small>{item.note}</small>}</td><td>{item.category || '미분류'}</td><td>{금액(item.cost)}</td></tr>)}
        </tbody></table>
      </section>
      <aside className={styles.panel}>
        <Header title="재무 원장 요약" action="기존 원장 읽기 전용"/>
        <div className={styles.settings}>
          <p className={styles.empty}>잔고는 아래 기준일의 기록입니다. 현재 은행 잔고와 다를 수 있습니다.</p><p><b>통장 잔고</b><span>{금액(data.balances.통장잔고)} · {data.balances.업데이트 || '기준일 미상'}</span></p>
          <p><b>세이프박스</b><span>{금액(data.balances.세이프박스)}</span></p>
          <p><b>보유 현금</b><span>{금액(data.balances.보유현금)}</span></p>
          <p><b>이번 달 예산</b><span>{budgetDetail}</span></p>
        </div>
      </aside>
    </section>
    <section className={styles.columns}>
      <section className={styles.panel}>
        <Header title="월별 지출" action="월별 지출 탭 기준"/>
        <table><thead><tr><th>월</th><th>지출 합계</th></tr></thead><tbody>{recentMonths.map((item) => <tr key={item.month}><td>{item.month}</td><td><b>{금액(item.total)}</b></td></tr>)}</tbody></table>
      </section>
      <section className={styles.panel}>
        <Header title="고정비" action="고정비 탭 기준"/>
        <table><thead><tr><th>항목</th><th>납부일</th><th>금액</th></tr></thead><tbody>{data.fixedCosts.map((item) => <tr key={`${item.항목}-${item.납부일}`}><td><b>{item.항목}</b><small>{item.종류}</small></td><td>{item.납부일 || '미정'}</td><td>{금액(item.금액)}</td></tr>)}</tbody></table>
      </section>
    </section>
    <section className={styles.panel}>
      <Header title="자동분류 확인 대기" action={`${data.reviewQueue.length}건`}/>
      <p className={styles.logGuide}>통장 거래 중 자동분류가 불확실한 항목만 표시합니다. 확인 결과는 보조 원장에 남고, 실제 매출·지출 금액 원장은 자동으로 바꾸지 않습니다.</p>
      {reviewNotice && <p className={styles.registerNotice}>{reviewNotice}</p>}
      {data.reviewQueue.length ? <div className={styles.reviewQueue}>{data.reviewQueue.map((item) => <article className={styles.reviewRow} key={item.id}><div><b>{item.counterparty || '상대 미상'}</b><small>{item.date || '시각 미상'} · {item.income ? `입금 ${금액(item.income)}` : `출금 ${금액(item.expense)}`}</small></div><div><Badge>{item.category || '미분류'}</Badge><small>확신도 {item.confidence || '미기록'} · 프로젝트 {item.projectId || '미연결'}</small></div><div><button className={styles.secondary} onClick={() => void decideReview(item.id, '보류')}>보류</button><button className={styles.primary} onClick={() => void decideReview(item.id, '확정')}>분류 확인</button></div></article>)}</div> : <p className={styles.empty}>지금 확인이 필요한 불확실한 거래가 없습니다.</p>}
    </section>
    <section className={styles.notice}><div><b>통장 거래가 확정 원본이고, 문자 알림은 빠른 임시 기록입니다.</b><p>문자로 먼저 들어온 거래는 확인 대기에 올리고, 다음 통장 거래 파일에서 같은 금액·시각을 대조해 중복 없이 확정합니다. 고정비·인건비·예산은 실제 출금 전까지 예정액으로만 표시합니다.</p></div></section>
  </>;
}

function Header({ title, action, onClick }: { title:string; action:string; onClick?: () => void }) { return <div className={styles.panelHead}><h2>{title}</h2>{onClick ? <button onClick={onClick}>{action}</button> : <span>{action}</span>}</div> }
function Metric({ label, value, detail }: { label:string; value:string; detail:string }) { return <div className={styles.metric}><span>{label}</span><b>{value}</b><small>{detail}</small></div> }
function Event({ title, project }: { title:string; project:string }) { return <div className={styles.event}><b>{title}</b><small>{project}</small></div> }


function PartnersWithCardCapture({ query }: { query: string }) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [filter, setFilter] = useState<'전체' | Partner['kind']>('전체');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerNotice, setRegisterNotice] = useState('');
  useEffect(() => {
    fetch('/api/operating/partners').then(async (response) => {
      const data = await response.json();
      if (!response.ok || !data.ok || !data.items?.length) return;
      setPartners(data.items);
      setSelectedId(data.items[0].id);
    }).catch(() => undefined);
  }, []);
  const rows = partners.filter((partner) => (filter === '전체' || partner.kind === filter) && `${partner.name} ${partner.contacts.map((contact) => contact.name).join(' ')}`.includes(query));
  const selected = partners.find((partner) => partner.id === selectedId) || rows[0] || partners[0] || { id: '', name: '등록된 고객·개인이 없습니다', kind: '개인' as const, status: '계약 전' as const, projects: [], last: '기록 없음', next: '명함 등록으로 첫 기록을 만드세요', contacts: [], note: '중앙 거래상대 원장에 저장된 고객과 개인만 이 목록에 표시합니다.' };
  const register = async (card: 명함등록값) => {
    setRegisterNotice('');
    const form = new FormData();
    Object.entries(card).forEach(([key, value]) => {
      if (key !== '이미지' && typeof value === 'string') form.append(key, value);
    });
    if (card.이미지) form.append('이미지', card.이미지);
    const response = await fetch('/api/operating/partners', { method: 'POST', body: form });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setRegisterNotice(data.error || '거래상대 원장에 등록하지 못했습니다.');
      return;
    }
    setPartners(data.items || []);
    setSelectedId(data.partnerId);
    setRegisterNotice('중앙 거래상대 원장에 등록했습니다.');
    setIsRegistering(false);
  };
  return <>
    <section className={styles.partnerToolbar}><div><h2>고객 관리</h2><p>회사·개인·담당자를 한 번만 등록하고, 명함과 프로젝트를 연결합니다.</p></div><button className={styles.primary} onClick={() => setIsRegistering(true)}>명함 등록</button></section>{registerNotice && <p className={styles.empty}>{registerNotice}</p>}
    <section className={styles.partnerFilters}>{(['전체', '회사', '개인'] as const).map((item) => <button key={item} className={filter === item ? styles.filterActive : ''} onClick={() => setFilter(item)}>{item}</button>)}</section>
    <section className={styles.partnerLayout}><div className={styles.panel}><Header title="고객·개인 목록" action={`${rows.length}건`} />{rows.length ? <div className={styles.partnerList}>{rows.map((partner) => <button className={`${styles.partnerRow} ${selected.id === partner.id ? styles.selected : ''}`} key={partner.id} onClick={() => setSelectedId(partner.id)}><div><b>{partner.name}</b><small>{partner.kind} · {partner.status} · 담당자 {partner.contacts.length}명</small></div><span><Badge>{partner.projects.length ? `${partner.projects.length}개 프로젝트` : '프로젝트 미연결'}</Badge><small>{partner.last}</small></span></button>)}</div> : <p className={styles.empty}>조건에 맞는 고객이나 개인이 없습니다.</p>}</div>
      <div className={`${styles.panel} ${styles.partnerDetail}`}><Header title={selected.name} action={`${selected.kind} · ${selected.status}`} /><p className={styles.meta}>{selected.note}</p><div className={styles.partnerSection}><h3>담당자와 명함</h3>{selected.contacts.map((contact) => <div className={styles.contactRow} key={`${contact.name}-${contact.card || ''}`}><div><b>{contact.name}</b><small>{contact.role}{contact.phone ? ` · ${contact.phone}` : ''}{contact.email ? ` · ${contact.email}` : ''}</small></div>{contact.card ? <Badge>{contact.card === '명함 등록됨' ? '명함 있음' : '등록됨'}</Badge> : <span className={styles.noCard}>명함 없음</span>}</div>)}</div><div className={styles.partnerSection}><h3>연결 프로젝트</h3>{selected.projects.length ? selected.projects.map((project) => <div className={styles.linkRow} key={project}><b>{project}</b><span>프로젝트 원장에서 진행 상황 확인</span></div>) : <p className={styles.empty}>아직 연결한 프로젝트가 없습니다.</p>}</div><div className={styles.partnerSection}><h3>최근 기록</h3><div className={styles.timeline}><p><b>최근 접점</b>{selected.last}</p><p><b>다음 행동</b>{selected.next}</p></div></div></div>
    </section>
    {isRegistering && <div className={styles.modalBackdrop} role="presentation"><section className={`${styles.modal} ${styles.cardCaptureModal}`} role="dialog" aria-modal="true" aria-label="명함 등록" onMouseDown={(event) => event.stopPropagation()}><BusinessCardCapture onCancel={() => setIsRegistering(false)} onSubmit={register} /></section></div>}
  </>;
}
