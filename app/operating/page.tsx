'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import BusinessCardCapture, { type 명함등록값 } from './components/BusinessCardCapture';
import OperatingInbox, { type 수신메시지 } from './components/OperatingInbox';
import ProjectWorkspaceModal, { type 운영프로젝트 } from './components/ProjectWorkspaceModal';
import styles from './operating.module.css';

type View = '홈' | '수신함' | '할 일' | '캘린더' | '고객 관리' | '프로젝트' | '재무·정산' | '실험' | '공용 도구' | '사이트 관리' | '이관 현황' | '통합 운영 로그' | '운영 설정';
type Workstream = { name: string; outcome?: string; status?: string; owner?: string; next?: string; due?: string; links?: string };
type ProjectActivity = { id?: string; title: string; detail?: string; actor?: string; at?: string; end?: string; kind: '결정' | '일정' | '이력' };
type ProjectLink = { name: string; purpose?: string; url: string; stream?: string };
type Project = { id?: string; spreadsheetId?: string; name: string; client: string; progress: number; next: string; status: string; owner: string; summary?: string; blocker?: string; due?: string; workstreams?: Workstream[]; links?: ProjectLink[]; decisions?: ProjectActivity[]; schedules?: ProjectActivity[]; histories?: ProjectActivity[]; hubUrl?: string; driveUrl?: string; lifecycle?: '현재 진행' | '고객대기' | '보류' | '완료·과거'; updatedAt?: string; taskCount?: number };
type DashboardTask = { id?: string; ledgerProjectId?: string; title: string; project: string; due: string; owner: string; state: string; source?: string };
type CalendarEvent = { id: string; title: string; start: string; end?: string; allDay: boolean; location?: string; link?: string; source: string };
type Experiment = { id: string; name: string; updatedAt: string; driveUrl: string };
type 이관대기프로젝트 = { name: string; client?: string; position?: string; status?: string; owner?: string; next?: string; due?: string; updatedAt?: string; taskCount?: string };
type 공용도구 = { id?: string; name: string; kind: string; platform: string; purpose?: string; url?: string; note?: string; updatedAt?: string };
type 동기화기록 = { id: string; date: string; area: string; direction: string; status: string; count: string; error: string; actor: string };

const menuGroups: { label: string; items: View[] }[] = [
  { label: '운영', items: ['홈', '수신함', '할 일', '캘린더', '프로젝트', '고객 관리', '재무·정산'] },
  { label: '자산', items: ['실험', '공용 도구', '사이트 관리'] },
  { label: '전환', items: ['이관 현황', '통합 운영 로그', '운영 설정'] },
];
const tasks: DashboardTask[] = [];
const projects: Project[] = [];
const messages: 수신메시지[] = [];

const managedSites = [
  { name: '큐앤뱅 공식 홈페이지', kind: '회사 사이트', status: '운영 중', site: 'https://qnbang-website.vercel.app', detail: '공개 사이트는 Vercel에서 정상 응답합니다. 현재 로컬 관리자 서버는 꺼져 있어 작동하지 않는 관리 버튼은 표시하지 않습니다.' },
  { name: '큐앤뱅 기존 운영 대시보드', kind: '내부 운영', status: '비교 운영', site: 'https://qnbang-dashboard.vercel.app', detail: '새 운영OS 안정화 전까지 기존 업무 기록을 대조하는 운영 화면입니다.' },
];

const Badge = ({ children }: { children: string }) => <span className={styles.badge}>{children}</span>;

export default function OperatingPage() {
  const [view, setView] = useState<View>('홈');
  const [query, setQuery] = useState('');
  const [operatingProjects, setOperatingProjects] = useState<Project[]>(projects);
  const [projectStatus, setProjectStatus] = useState('불러오는 중');
  const [ledgerTasks, setLedgerTasks] = useState<DashboardTask[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarStatus, setCalendarStatus] = useState('불러오는 중');
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [driveTools, setDriveTools] = useState<공용도구[]>([]);
  const [migrationPending, setMigrationPending] = useState<이관대기프로젝트[]>([]);
  const [syncLogs, setSyncLogs] = useState<동기화기록[]>([]);
  const [writeStatus, setWriteStatus] = useState({ writable: false, canCreateProject: false, editableProjectIds: [] as string[], message: '새 드라이브 쓰기 권한을 확인하는 중입니다.', creationMessage: '새 프로젝트 생성 연결을 확인하는 중입니다.' });
  const [inboxMessages, setInboxMessages] = useState<수신메시지[]>(messages);
  const [inboxStatus, setInboxStatus] = useState('불러오는 중');
  const [inboxNotice, setInboxNotice] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [openedProject, setOpenedProject] = useState<Project | null>(null);
  const operatingTasks = useMemo(() => {
    const 공식프로젝트명 = new Set(operatingProjects.filter((project) => project.lifecycle === '현재 진행' || project.lifecycle === '고객대기').map((project) => project.name));
    return ledgerTasks
      .filter((task, index, all) => 공식프로젝트명.has(task.project) && all.findIndex((candidate) => candidate.title === task.title && candidate.project === task.project) === index);
  }, [ledgerTasks, operatingProjects]);
  const shownProjects = useMemo(() => operatingProjects.filter((p) => `${p.name} ${p.client}`.includes(query)), [operatingProjects, query]);
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
        id?: string; spreadsheetId?: string; name: string; client: string; status: string; owner: string; due?: string; lifecycle?: Project['lifecycle']; driveUrl?: string; overview?: Record<string, string>; workstreams?: Workstream[]; tasks?: { title?: string; due?: string }[]; links?: ProjectLink[]; decisions?: ProjectActivity[]; schedules?: ProjectActivity[]; histories?: ProjectActivity[]; progress?: number;
      }) => ({
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
      setMigrationPending(data.pending || []);
      setLedgerTasks((data.items || []).flatMap((item: { id?: string; name?: string; tasks?: { id?: string; title?: string; due?: string; owner?: string; status?: string; source?: string }[] }) => (item.tasks || []).filter((task) => task.id && task.title && !['완료', '완수', '전달 완료', '폐기', '종료'].includes(task.status || '')).map((task) => ({ id: task.id, ledgerProjectId: item.id, title: task.title || '', project: item.name || '', due: task.due || '기한 미정', owner: task.owner || '담당 확인 필요', state: task.status || '확인 필요', source: task.source || '프로젝트 운영원장' }))));
      if (!updated.length) return;
      setOperatingProjects((current) => [...current.filter((project) => !updated.some((item: Project) => item.name === project.name)), ...updated]);
      setSelectedProject(updated[0]);
      setProjectStatus('연결됨');
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
    fetch('/api/operating/experiments').then(async (response) => {
      const data = await response.json();
      if (response.ok && data.ok) setExperiments(data.items || []);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch('/api/operating/tools').then(async (response) => {
      const data = await response.json();
      if (response.ok && data.ok) setDriveTools(data.items || []);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch('/api/operating/sync-log').then(async (response) => {
      const data = await response.json();
      if (response.ok && data.ok) setSyncLogs(data.items || []);
    }).catch(() => undefined);
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
    if (view === '재무·정산') return <Finance />;
    if (view === '실험') return <Experiments items={experiments} />;
    if (view === '공용 도구') return <Tools items={driveTools} />;
    if (view === '사이트 관리') return <Sites />;
    if (view === '이관 현황') return <Migration pending={migrationPending} projectCount={operatingProjects.length} />;
    if (view === '통합 운영 로그') return <OperatingLog items={syncLogs} />;
    if (view === '운영 설정') return <Settings projectCount={operatingProjects.length} toolCount={driveTools.length} inboxCount={inboxMessages.length} inboxStatus={inboxStatus} calendarStatus={calendarStatus} syncLogCount={syncLogs.length} />;
    return <Home onView={setView} projects={operatingProjects} tasks={operatingTasks} onOpenProject={openProject} messages={inboxMessages} inboxStatus={inboxStatus} />;
  };

  return <div className={styles.shell}>
    <aside className={styles.side}>
      <Link className={styles.brand} href="/">QNB <span>운영OS</span></Link>
      <nav>{menuGroups.map((group) => <section className={styles.navGroup} key={group.label}><span>{group.label}</span>{group.items.map((item) => <button key={item} className={view === item ? styles.active : ''} onClick={() => setView(item)}>{item}</button>)}</section>)}</nav>
      <div className={styles.sync}><strong>실무 테스트 가동</strong><p>기준: 큐앤뱅 뉴 대시보드</p><p>기존 시스템은 원본 보존</p></div>
    </aside>
    <main className={styles.main}>
      {!(['홈', '수신함', '할 일', '프로젝트'] as View[]).includes(view) && <header className={styles.top}><div><p className={styles.crumb}>큐앤뱅 운영 허브</p><h1>{view}</h1></div><div className={styles.actions}><input aria-label="프로젝트와 고객 검색" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="프로젝트·고객 검색"/><button className={styles.primary} onClick={() => setView('프로젝트')}>프로젝트 보기</button></div></header>}
      {content()}
      {openedProject && <ProjectWorkspaceModal project={openedProject} projects={operatingProjects} tasks={operatingTasks} editableProjectIds={writeStatus.editableProjectIds} writeMessage={writeStatus.message} onProjectUpdated={updateProject} onTaskCreated={(task) => setLedgerTasks((current) => [...current, task])} onTaskCompleted={(task) => setLedgerTasks((current) => current.filter((item) => item.id !== task.id))} onClose={() => setOpenedProject(null)} />}
    </main>
  </div>;
}

function Home({ onView, projects: homeProjects, tasks: homeTasks, onOpenProject, messages: homeMessages, inboxStatus }: { onView: (view: View) => void; projects: Project[]; tasks: DashboardTask[]; onOpenProject: (project: Project) => void; messages: 수신메시지[]; inboxStatus: string }) { const currentProjects = homeProjects.filter((project) => !project.lifecycle || project.lifecycle === '현재 진행' || project.lifecycle === '고객대기'); return <>
  <section className={styles.homeIntro}><div><p className={styles.crumb}>운영 대시보드</p><h2>오늘, 팀이 이어서 일할 수 있게</h2><p>수신함과 원장을 확인해 다음 행동을 정리합니다.</p></div><button className={styles.primary} onClick={() => onView('프로젝트')}>프로젝트 보기</button></section>
  <section className={styles.todayCheck}><b>오늘 확인할 것</b><span>수신 원문 {homeMessages.length}건 · 금액 확정은 재무 원장에서 확인</span><button onClick={() => onView('수신함')}>수신함 보기</button></section>
  <section className={styles.metrics}><Metric label="새 수신" value={`${homeMessages.length}건`} detail={inboxStatus}/><Metric label="현재 할 일" value={`${homeTasks.length}건`} detail="프로젝트 운영원장 우선"/><Metric label="진행·고객대기" value={`${currentProjects.length}건`} detail="보류·완료는 분리 표시"/><Metric label="보류" value={`${homeProjects.filter((project) => project.lifecycle === '보류').length}건`} detail="기록은 유지하고 기본 목록에서 제외"/></section>
  <section className={styles.columns}><div className={styles.panel}><div className={styles.panelLead}><div><h2>통합 수신함</h2><p>원문과 출처를 유지한 채, 필요한 것만 할 일로 전환합니다.</p></div><button onClick={() => onView('수신함')}>전체 보기</button></div>{homeMessages.length ? homeMessages.slice(0, 3).map((m) => <button key={m.id} className={styles.messageRow} onClick={() => onView('수신함')}><Badge>{m.channel}</Badge><span><b>{m.sender}</b><small>{m.body}</small></span><time>{m.receivedAt || '시각 미상'}</time></button>) : <p className={styles.empty}>통합 수신 원장 연결 뒤 라크·카카오톡·메일 원문이 여기에 표시됩니다.</p>}</div><div className={styles.panel}><div className={styles.panelLead}><div><h2>오늘 팀의 실행</h2><p>프로젝트 운영원장과 연결된 현재 진행 항목입니다.</p></div></div>{homeTasks.slice(0,3).map((t, index) => <button className={styles.executionRow} key={`${t.project}-${t.title}`} onClick={() => onView('할 일')}><b>{t.due || ['우선', '다음', '확인'][index]}</b><span><strong>{t.title}</strong><small>{t.project}</small></span></button>)}<div className={styles.panelActions}><button onClick={() => onView('할 일')}>할 일·일정 보기</button></div></div></section>
  <section className={styles.columns}><div className={styles.panel}><div className={styles.panelLead}><div><h2>진행 프로젝트</h2><p>중앙 운영원장에서 보류와 완료를 제외한 목록입니다.</p></div><button onClick={() => onView('프로젝트')}>프로젝트 전체</button></div>{currentProjects.slice(0, 6).map((p) => <button className={styles.projectRow} key={p.name} onClick={() => onOpenProject(p)}><span><b>{p.name}</b><small>{p.client}</small></span><strong>{p.lifecycle || p.status}</strong><small>{p.next}</small></button>)}</div><div className={styles.panel}><div className={styles.panelLead}><div><h2>정산 확인</h2><p>기존 재무 원장을 읽어 최신 매출·지출·잔고를 확인합니다.</p></div></div><p className={styles.empty}>통장 거래를 올리면 자동분류하고, 불확실한 거래만 사람이 확인합니다.</p><div className={styles.panelActions}><button className={styles.primary} onClick={() => onView('재무·정산')}>재무 원장 보기</button></div></div></section>
</> }

function ScreenIntro({ crumb, title, description, action, onAction }: { crumb:string; title:string; description:string; action?:string; onAction?:() => void }) { return <section className={styles.screenIntro}><div><p className={styles.crumb}>{crumb}</p><h1>{title}</h1><p>{description}</p></div>{action && onAction && <button className={styles.primary} onClick={onAction}>{action}</button>}</section> }

function TaskList({ projects: taskProjects, tasks: taskItems, editableProjectIds, writeMessage, onOpenProject, onCompleted }: { projects: Project[]; tasks: DashboardTask[]; editableProjectIds: string[]; writeMessage: string; onOpenProject: (name: string) => void; onCompleted: (task: DashboardTask) => void }) {
  const [projectFilter, setProjectFilter] = useState('전체');
  const [selectedTitle, setSelectedTitle] = useState(taskItems[0]?.title || '');
  const [completingId, setCompletingId] = useState('');
  const [notice, setNotice] = useState('');
  const visible = taskItems.filter((task) => projectFilter === '전체' || task.project === projectFilter);
  const selected = taskItems.find((task) => task.title === selectedTitle) || visible[0];
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
  return <><div className={styles.filterBar}><div><Badge>{`현재 ${visible.length}`}</Badge><Badge>{`전체 ${taskItems.length}`}</Badge></div><select aria-label="프로젝트 필터" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="전체">프로젝트 전체</option>{taskProjects.map((project) => <option key={project.name} value={project.name}>{project.name}</option>)}</select></div><section className={styles.taskLayout}><div className={styles.panel}><div className={styles.panelLead}><div><h2>모든 할 일</h2><p>프로젝트 운영원장을 우선으로 읽습니다. 완료 처리는 원장에 바로 기록합니다.</p></div></div>{visible.map((t) => <button className={`${styles.taskListRow} ${selected?.title === t.title ? styles.taskSelected : ''}`} key={`${t.ledgerProjectId || t.project}-${t.id || t.title}`} onClick={() => setSelectedTitle(t.title)}><span className={styles.checkButton} role="checkbox" aria-checked="false" onClick={(event) => { event.stopPropagation(); void complete(t); }}>{completingId === t.id ? '…' : ''}</span><span><b>{t.title}</b><small>{t.owner} · {t.state}</small></span><span className={styles.taskProjectButton}>{t.project}</span><time>{t.due}</time></button>)}{!visible.length && <p className={styles.empty}>선택한 프로젝트에 표시할 현재 할 일이 없습니다.</p>}<div className={styles.waiting}><b>대기 항목은 프로젝트 상태에서 분리</b><span>고객대기·보류는 프로젝트 화면에서 원래 상태 그대로 확인합니다.</span></div></div><aside className={`${styles.panel} ${styles.taskDetail}`}><div className={styles.panelLead}><div><h2>선택한 할 일</h2></div></div>{selected ? <><h3>{selected.title}</h3><Badge>{selected.due}</Badge><div className={styles.taskConnection}><p><b>연결 프로젝트</b>{selected.project}</p><p><b>담당</b>{selected.owner}</p><p><b>원문·메모</b>{selected.project}에서 이어진 할 일입니다.</p></div><button className={styles.secondary} onClick={() => onOpenProject(selected.project)}>프로젝트 열기</button><button className={styles.primary} disabled={!selected.id || Boolean(completingId) || Boolean(selected.ledgerProjectId && !editableProjectIds.includes(selected.ledgerProjectId))} onClick={() => void complete(selected)}>{completingId === selected.id ? '기록 중' : '완료 처리'}</button><small>{notice || (selected.ledgerProjectId && !editableProjectIds.includes(selected.ledgerProjectId) ? writeMessage : selected.id ? '완료 처리하면 프로젝트 운영원장에 기록되고 이 목록에서 사라집니다.' : '이 항목은 원장 ID 연결 뒤 완료 처리할 수 있습니다.')}</small></> : <p className={styles.empty}>왼쪽에서 할 일을 선택하세요.</p>}</aside></section></>;
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
const initialPartners: Partner[] = [];

function Partners({ query }: { query: string }) {
  const [partners, setPartners] = useState<Partner[]>(initialPartners);
  const [selectedId, setSelectedId] = useState(initialPartners[0]?.id || '');
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

function Projects({ projects: rows, status, selected, creationReady, creationMessage, onSelect, onOpenProject, onRegistered }: { projects: Project[]; status: string; selected: Project | null; creationReady: boolean; creationMessage: string; onSelect: (p: Project) => void; onOpenProject: (p: Project) => void; onRegistered: (p: Project) => void }) {
  const [scope, setScope] = useState<'현재 진행' | '고객대기' | '보류' | '완료·과거'>('현재 진행');
  const emptyForm = { name: '', client: '', owner: '신종호', goal: '', evidenceType: '', evidenceUrl: '' };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const scopes: Array<'현재 진행' | '고객대기' | '보류' | '완료·과거'> = ['현재 진행', '고객대기', '보류', '완료·과거'];
  const visible = rows.filter((project) => (project.lifecycle || '현재 진행') === scope);
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
      <div className={styles.panelLead}><div><h2>{scope}</h2><p>중앙 운영원장의 상태를 읽습니다. 보류와 완료는 진행 목록에 섞지 않습니다.</p></div><span>{status === '연결됨' ? `${visible.length}건` : status}</span></div>
      <div className={styles.filterBar}>{scopes.map((item) => <button key={item} className={scope === item ? styles.filterActive : ''} onClick={() => setScope(item)}>{item} {status === '연결됨' ? rows.filter((project) => (project.lifecycle || '현재 진행') === item).length : '—'}</button>)}</div>
      <div className={styles.projectTableHead}><span>프로젝트</span><span>거래상대</span><span>현재 상태</span><span>다음 행동</span><span>마지막 기록</span></div>
      {visible.map((p) => <button className={`${styles.projectTableRow} ${selected?.name === p.name ? styles.selected : ''}`} onClick={() => { onSelect(p); onOpenProject(p); }} key={p.name}><span><b>{p.name}</b><small>담당 {p.owner}</small></span><span>{p.client}</span><span className={styles.progressCell}><strong>{p.status}</strong></span><span>{p.next}</span><time>{p.updatedAt || p.due || '기록 없음'}</time></button>)}
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
      setUploadNotice(`거래 ${result.건수}건을 읽었습니다. 이번 달 입금 ${금액(result.이번달입금)}, 출금 ${금액(result.이번달출금)} · 확인 대기 ${result.확인대기건수}건`);
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
          <p><b>통장 잔고</b><span>{금액(data.balances.통장잔고)} · {data.balances.업데이트 || '기준일 미상'}</span></p>
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

function Experiments({ items }: { items: Experiment[] }) { return <><ScreenIntro crumb="실험" title="실험" description="정식 프로젝트나 브랜드가 되기 전, 리서치·AI 시도·아이디어를 실제 드라이브 폴더 기준으로 확인합니다."/><section className={styles.toolGrid}>{items.map((item) => <article className={styles.tool} key={item.id}><Badge>실험</Badge><h3>{item.name}</h3><p>{item.updatedAt ? `마지막 변경 ${new Date(item.updatedAt).toLocaleDateString('ko-KR')}` : '변경 시각 확인 필요'}</p><a className={styles.secondary} href={item.driveUrl} target="_blank" rel="noreferrer">Drive 폴더 열기</a><small>고객·담당·마감·만들 결과가 확정되면 정식 프로젝트로 전환합니다.</small></article>)}{!items.length && <p className={styles.empty}>실험 폴더를 읽는 중이거나 아직 등록된 실험이 없습니다.</p>}</section></> }

function Tools({ items }: { items: 공용도구[] }) { const unique = Array.from(items.reduce((map, tool) => { const key = tool.name.replace(/[\s_-]/g, '').toLowerCase(); const previous = map.get(key); map.set(key, previous ? { ...tool, ...previous, url: previous.url || tool.url, updatedAt: previous.updatedAt || tool.updatedAt } : tool); return map; }, new Map<string, 공용도구>()).values()); return <>
  <section className={styles.assetIntro}><div><h2>팀 공용 도구</h2><p>웹에서 바로 쓰는 도구와 새 드라이브에 실제 보관된 로컬 도구를 구분합니다. 개인 설정·결과물·실험 파일은 넣지 않습니다.</p></div><Badge>07_공용도구 기준</Badge></section>
  <section className={styles.toolGrid}>{unique.map((tool) => <article className={styles.tool} key={tool.id || tool.name}><div className={styles.assetMeta}><Badge>{tool.kind}</Badge><Badge>{tool.platform}</Badge></div><h3>{tool.name}</h3><p>{tool.purpose || (tool.updatedAt ? `드라이브 마지막 변경 ${new Date(tool.updatedAt).toLocaleDateString('ko-KR')}` : '도구 설명을 확인 중입니다.')}</p>{tool.url ? <a className={styles.assetLink} href={tool.url} target="_blank" rel="noreferrer">{tool.kind === '웹 도구' ? '도구 열기' : 'Drive 폴더 열기'}</a> : <small className={styles.pendingLink}>{tool.note || '실행 경로 확인 중'}</small>}{tool.note && tool.url && <small className={styles.pendingLink}>{tool.note}</small>}</article>)}</section>
</> }

function Sites() { return <>
  <section className={styles.assetIntro}><div><h2>사이트 관리</h2><p>공개 사이트·관리 화면·배포된 서비스를 따로 모읍니다. 프로젝트 화면은 만드는 일을 관리하고, 이 화면은 이미 운영하는 사이트를 엽니다.</p></div><Badge>운영 자산</Badge></section>
  <section className={styles.siteGrid}>{managedSites.map((site) => <article className={styles.siteCard} key={site.name}><div className={styles.siteHeading}><div><h3>{site.name}</h3><p>{site.kind}</p></div><Badge>{site.status}</Badge></div><p className={styles.siteDetail}>{site.detail}</p><div className={styles.siteActions}>{site.site && <a className={styles.secondaryLink} href={site.site} target="_blank" rel="noreferrer">사이트 열기</a>}</div></article>)}</section>
</> }

function OperatingLog({ items }: { items: 동기화기록[] }) { return <section className={styles.logLayout}><div className={styles.panel}><Header title="통합 운영 로그" action="중앙 운영원장 기준"/><p className={styles.logGuide}>홈페이지·대시보드·도구·연동·저장 규칙처럼 여러 프로젝트에 영향을 주는 변경만 한 줄로 남깁니다.</p><div className={styles.logList}>{items.map((log) => <article className={styles.logRow} key={log.id || `${log.date}-${log.area}`}><time>{log.date || '시각 미기록'}</time><Badge>{log.area || '대상 미기록'}</Badge><p>{[log.direction, log.status, log.count && `${log.count}건`, log.error].filter(Boolean).join(' · ') || '기록 내용 없음'}</p></article>)}{!items.length && <p className={styles.empty}>중앙 운영원장에 아직 기록된 시스템 변경이 없습니다.</p>}</div></div><aside className={`${styles.panel} ${styles.logRule}`}><Header title="기록 기준" action="원장 연결됨"/><p><b>여기에 기록</b>사이트 수정, 배포 방식 변경, 도구 추가·폐기, 라크·카카오톡·캘린더 연결 변경</p><p><b>여기에 기록하지 않음</b>고객별 회의, 제작 피드백, 개별 프로젝트 진행 상황</p><p><b>저장 원칙</b>확정 후에는 중앙 운영원장 `동기화기록`에 한 줄로 저장하고 이 화면에서 읽습니다.</p></aside></section> }
function Migration({ pending, projectCount }: { pending: 이관대기프로젝트[]; projectCount: number }) { return <><section className={styles.hero}><div><p className={styles.eyebrow}>실제 원장 전환 결과</p><h2>새 운영원장을 기준으로<br/>실무 테스트를 시작합니다.</h2><p>이 화면은 중앙 운영원장에서 현재 등록된 프로젝트와 귀속 대기 항목만 읽습니다. 기존 시스템은 복구용 원본으로 보존합니다.</p></div><Badge>{pending.length ? '확인 필요' : '이관대기 없음'}</Badge></section><section className={styles.metrics}><Metric label="중앙 프로젝트" value={`${projectCount}건`} detail="프로젝트·자체브랜드 운영원장"/><Metric label="귀속 대기" value={`${pending.length}건`} detail="중앙 이관대기 원장 기준"/></section><section className={styles.panel}><Header title="귀속 확인할 항목" action={`${pending.length}건`}/>{pending.length ? <div className={styles.projectList}>{pending.map((item) => <article className={styles.projectRow} key={item.name}><span><b>{item.name}</b><small>{item.client || '거래상대 미기록'} · 담당 {item.owner || '미기록'}</small></span><strong>{item.position || item.status || '상태 확인 필요'}</strong><small>{item.next || '다음 행동 미기록'}{item.due ? ` · ${item.due}` : ''}</small></article>)}</div> : <p className={styles.empty}>중앙 운영원장에 남은 이관대기 항목이 없습니다.</p>}</section><section className={styles.notice}><div><b>외부 수신 연결은 별도 검증</b><p>카카오톡봇이 돌아가는 맥북에서 중앙 수신 주소로 원문이 들어오면 통합 수신함에서 실제 메시지로 확인합니다.</p></div></section></> }
function Settings({ projectCount, toolCount, inboxCount, inboxStatus, calendarStatus, syncLogCount }: { projectCount: number; toolCount: number; inboxCount: number; inboxStatus: string; calendarStatus: string; syncLogCount: number }) { return <section className={styles.panel}><Header title="운영OS 연결 상태" action="현재 응답 기준"/><div className={styles.settings}><p><b>프로젝트 운영원장</b><span>중앙 인덱스에서 {projectCount}건을 읽음</span></p><p><b>공용 도구</b><span>새 드라이브에서 {toolCount}건을 읽음</span></p><p><b>통합 수신 원장</b><span>{inboxStatus} · 현재 원문 {inboxCount}건</span></p><p><b>구글 캘린더</b><span>{calendarStatus}</span></p><p><b>통합 운영 로그</b><span>중앙 원장에서 {syncLogCount}건을 읽음</span></p><p><b>재무·통장</b><span>기존 금액 원장과 정산 확인 대기를 재무 화면에서 직접 조회</span></p><p><b>메일</b><span>기존 브리핑은 별도 운영 · 중앙 수신 원문 연결 범위 확인 필요</span></p><p><b>카카오톡봇</b><span>별도 맥북에서 중앙 수신 주소로 보내는 연결 작업 필요</span></p><p><b>GitHub</b><span>배포 코드만 유지하고 운영 지식·자료는 드라이브 중심으로 관리</span></p></div></section> }
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
