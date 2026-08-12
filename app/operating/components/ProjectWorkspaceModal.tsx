'use client';

import { useMemo, useState } from 'react';
import styles from '../operating.module.css';

type 진행묶음 = { name: string; outcome?: string; status?: string; owner?: string; next?: string; links?: string };
type 프로젝트링크 = { name: string; purpose?: string; url: string; stream?: string };
type 프로젝트활동 = { id?: string; title: string; detail?: string; actor?: string; at?: string; end?: string; kind: '결정' | '일정' | '이력' };
export type 운영프로젝트 = { id?: string; spreadsheetId?: string; name: string; client: string; next: string; status: string; owner: string; summary?: string; blocker?: string; due?: string; workstreams?: 진행묶음[]; links?: 프로젝트링크[]; decisions?: 프로젝트활동[]; schedules?: 프로젝트활동[]; histories?: 프로젝트활동[]; driveUrl?: string; lifecycle?: '현재 진행' | '고객대기' | '보류' | '완료·과거' };
export type 운영할일 = { id?: string; ledgerProjectId?: string; title: string; project: string; due: string; owner: string; state: string };

const Badge = ({ children }: { children: string }) => <span className={styles.badge}>{children}</span>;

const 프로젝트상태 = ['진행 중', '고객대기', '보류', '완료'] as const;
function 편집상태(project: 운영프로젝트) {
  if (프로젝트상태.includes(project.status as typeof 프로젝트상태[number])) return project.status;
  if (project.lifecycle === '고객대기') return '고객대기';
  if (project.lifecycle === '보류') return '보류';
  if (project.lifecycle === '완료·과거') return '완료';
  return '진행 중';
}
function 상태변경문구(status: string) {
  if (status === '진행 중') return '진행 중으로';
  if (status === '고객대기') return '고객 대기로';
  return `${status}로`;
}

export default function ProjectWorkspaceModal({ project, projects = [], tasks = [], editableProjectIds = [], writeMessage, onProjectUpdated, onTaskCreated, onTaskCompleted, onClose }: { project: 운영프로젝트; projects?: 운영프로젝트[]; tasks?: 운영할일[]; editableProjectIds?: string[]; writeMessage: string; onProjectUpdated: (project: 운영프로젝트) => void; onTaskCreated: (task: 운영할일) => void; onTaskCompleted: (task: 운영할일) => void; onClose: () => void }) {
  const [active, setActive] = useState(project);
  const [tab, setTab] = useState<'개요' | '할 일' | '문서·링크' | '활동'>('개요');
  const [done, setDone] = useState<string[]>([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [completingId, setCompletingId] = useState('');
  const [notice, setNotice] = useState('');
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [projectForm, setProjectForm] = useState({ status: 편집상태(project), owner: project.owner, goal: project.summary || '', next: project.next || '', blocker: project.blocker || '', due: project.due || '' });
  const [statusSaving, setStatusSaving] = useState(false);
  const [addedTasks, setAddedTasks] = useState<운영할일[]>([]);
  const [addedLinks, setAddedLinks] = useState<Array<프로젝트링크 & { project: string }>>([]);
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [isAddingFile, setIsAddingFile] = useState(false);
  const [linkForm, setLinkForm] = useState({ name: '', purpose: '참고 링크', url: '' });
  const [fileForm, setFileForm] = useState<{ file?: File; target: '01_자료' | '02_제작' | '03_결과물' }>({ target: '01_자료' });
  const [assetSaving, setAssetSaving] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const linkedTasks = useMemo(() => [...tasks, ...addedTasks].filter((item) => item.project === active.name).filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index), [active.name, addedTasks, tasks]);
  const streams = active.workstreams || [];
  const projectLinks = [...(active.links || []), ...addedLinks.filter((item) => item.project === active.name)];
  const activities = useMemo(() => [...(active.decisions || []), ...(active.schedules || []), ...(active.histories || [])].sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))), [active]);
  const visibleProjects = useMemo(() => projects.filter((item) => item.lifecycle === '현재 진행' || item.lifecycle === '고객대기').filter((item) => item.name.includes(projectSearch) || item.client.includes(projectSearch)), [projectSearch, projects]);
  const writable = Boolean(active.id && editableProjectIds.includes(active.id));

  const selectProject = (item: 운영프로젝트) => {
    setActive(item);
    setProjectForm({ status: 편집상태(item), owner: item.owner, goal: item.summary || '', next: item.next || '', blocker: item.blocker || '', due: item.due || '' });
    setIsEditingProject(false);
    setTab('개요');
    setNotice('');
  };

  const saveProject = async () => {
    if (!active.id || !프로젝트상태.includes(projectForm.status as typeof 프로젝트상태[number]) || !writable || !projectForm.owner.trim() || !projectForm.next.trim()) return;
    setStatusSaving(true);
    setNotice('');
    try {
      const response = await fetch('/api/operating/projects', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: active.id, ...projectForm }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '프로젝트 상태를 바꾸지 못했습니다.');
      const updated = { ...active, ...data.project };
      setActive(updated);
      onProjectUpdated(updated);
      setProjectForm({ status: 편집상태(updated), owner: updated.owner, goal: updated.summary || '', next: updated.next || '', blocker: updated.blocker || '', due: updated.due || '' });
      setIsEditingProject(false);
      setNotice(`프로젝트 정보를 저장하고 상태를 ${상태변경문구(data.project.status)} 반영했습니다.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '프로젝트 정보를 바꾸지 못했습니다.');
    } finally {
      setStatusSaving(false);
    }
  };

  const addTask = async () => {
    if (!taskTitle.trim()) return;
    if (!writable) { setNotice(writeMessage); return; }
    setIsSaving(true);
    setNotice('');
    try {
      if (!active.id) throw new Error('이 프로젝트의 운영원장 연결을 확인하지 못했습니다.');
      const response = await fetch('/api/operating/project-tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: active.id, title: taskTitle.trim(), owner: active.owner }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '기록하지 못했습니다.');
      const added = { id: data.task.id, ledgerProjectId: active.id, title: data.task.title, project: active.name, due: '기한 미정', owner: data.task.owner, state: data.task.state };
      setAddedTasks((current) => [...current, added]);
      onTaskCreated(added);
      setTaskTitle('');
      setIsAddingTask(false);
      setNotice('프로젝트 운영원장에 할 일을 등록했습니다.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '할 일을 기록하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const completeTask = async (task: 운영할일) => {
    if (!task.id) {
      setNotice('이 할 일은 원장 ID 연결을 확인한 뒤 완료 처리할 수 있습니다.');
      return;
    }
    if (task.ledgerProjectId && !writable) { setNotice(writeMessage); return; }
    setCompletingId(task.id);
    setNotice('');
    try {
      const response = await fetch(task.ledgerProjectId ? '/api/operating/project-tasks' : '/api/office/complete', { method: task.ledgerProjectId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(task.ledgerProjectId ? { projectId: task.ledgerProjectId, taskId: task.id } : { id: task.id }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '완료 처리하지 못했습니다.');
      setDone((current) => [...current, task.title]);
      onTaskCompleted(task);
      setNotice(task.ledgerProjectId ? '프로젝트 운영원장에 완료로 기록했습니다.' : '기존 과업 원장에 완료로 기록했습니다.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '완료 처리하지 못했습니다.');
    } finally {
      setCompletingId('');
    }
  };

  const addLink = async () => {
    if (!active.id || !linkForm.name.trim() || !linkForm.url.trim() || !writable) return;
    setAssetSaving(true);
    setNotice('');
    try {
      const response = await fetch('/api/operating/project-assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: active.id, ...linkForm }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '링크를 연결하지 못했습니다.');
      setAddedLinks((current) => [...current, { ...data.link, project: active.name }]);
      setLinkForm({ name: '', purpose: '참고 링크', url: '' });
      setIsAddingLink(false);
      setNotice(data.link.reused ? '이미 연결된 링크입니다.' : '프로젝트 운영원장에 링크를 기록했습니다.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '링크를 연결하지 못했습니다.');
    } finally {
      setAssetSaving(false);
    }
  };

  const addFile = async () => {
    if (!active.id || !fileForm.file || !writable) return;
    setAssetSaving(true);
    setNotice('');
    try {
      const form = new FormData();
      form.append('projectId', active.id);
      form.append('target', fileForm.target);
      form.append('file', fileForm.file);
      const response = await fetch('/api/operating/project-assets', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '파일을 연결하지 못했습니다.');
      setAddedLinks((current) => [...current, { ...data.link, project: active.name }]);
      setFileForm({ target: '01_자료' });
      setIsAddingFile(false);
      setNotice('Drive에 파일을 저장하고 프로젝트 운영원장에 연결했습니다.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '파일을 연결하지 못했습니다.');
    } finally {
      setAssetSaving(false);
    }
  };

  const 할일영역 = <section className={styles.readSection}>
    <div className={styles.workstreamHead}>
      <div><h3>할 일</h3><span>이 프로젝트의 할 일을 여기서 바로 확인하고 완료할 수 있습니다.</span></div>
      <button className={styles.secondary} disabled={!writable} onClick={() => setIsAddingTask((value) => !value)}>할 일 추가</button>
    </div>
    {!writable && <p className={styles.empty}>{writeMessage}</p>}
    {isAddingTask && <div className={styles.inlineTaskForm}><input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="새 할 일" /><button className={styles.primary} disabled={isSaving || !taskTitle.trim() || !active.id || !writable} onClick={addTask}>{isSaving ? '기록 중' : '기록하기'}</button></div>}
    {notice && <p className={styles.empty}>{notice}</p>}
    {linkedTasks.length ? <div className={styles.overviewTaskList}>{linkedTasks.map((task) => <article className={styles.readWorkstream} key={`${task.ledgerProjectId || active.id || active.name}-${task.id || task.title}`}><button className={`${styles.checkButton} ${done.includes(task.title) ? styles.checked : ''}`} aria-label={`${task.title} 완료 처리`} disabled={!task.id || Boolean(completingId) || (Boolean(task.ledgerProjectId) && !writable)} onClick={() => void completeTask(task)}>{completingId === task.id ? '…' : done.includes(task.title) ? '✓' : ''}</button><div><b>{task.title}</b><p>{task.owner} · {done.includes(task.title) ? '완료 기록됨' : task.state}</p></div><Badge>{task.due}</Badge></article>)}</div> : <p className={styles.empty}>연결된 할 일이 없습니다.</p>}
  </section>;

  return <div className={styles.modalBackdrop} role="presentation" onMouseDown={onClose}><section className={styles.projectBrowse} role="dialog" aria-modal="true" aria-label={`${active.name} 프로젝트 열람`} onMouseDown={(event) => event.stopPropagation()}>
    <aside className={styles.projectExplorer}><div><h2>프로젝트</h2><input placeholder="프로젝트 검색" value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} /><p>현재 진행·고객대기 프로젝트</p></div><div className={styles.explorerList}>{visibleProjects.map((item) => <button type="button" className={item.name === active.name ? styles.explorerActive : ''} key={item.name} onClick={() => selectProject(item)}><b>{item.name}</b><small>{item.due || '확인 시점 미정'} · {item.next}</small></button>)}{!visibleProjects.length && <p className={styles.empty}>조건에 맞는 현재 프로젝트가 없습니다.</p>}</div><button className={styles.primary} onClick={onClose}>목록으로 돌아가기</button></aside>
    <main className={styles.projectRead}><div className={styles.projectReadHead}><div><p>프로젝트 / {active.name}</p><h2>{active.name}</h2><div className={styles.projectStatusRow}><Badge>{편집상태(active) === '고객대기' ? '고객 대기' : 편집상태(active)}</Badge><span>{active.client} · 담당 {active.owner} · 확인 시점 {active.due || '미정'}</span></div></div><div><button className={styles.secondary} disabled={!writable} onClick={() => setIsEditingProject((value) => !value)}>{isEditingProject ? '수정 닫기' : '프로젝트 정보 수정'}</button>{active.driveUrl && <a className={styles.secondary} href={active.driveUrl} target="_blank" rel="noreferrer">Drive 폴더 열기</a>}<button className={styles.closeButton} onClick={onClose}>닫기</button></div></div>
      {isEditingProject && <section className={styles.projectEditPanel}><label><span>상태</span><select value={projectForm.status} disabled={statusSaving} onChange={(event) => setProjectForm((current) => ({ ...current, status: event.target.value }))}>{프로젝트상태.map((status) => <option key={status} value={status}>{status === '고객대기' ? '고객 대기' : status}</option>)}</select></label><label><span>담당</span><input value={projectForm.owner} onChange={(event) => setProjectForm((current) => ({ ...current, owner: event.target.value }))} /></label><label className={styles.projectEditWide}><span>목표</span><input value={projectForm.goal} onChange={(event) => setProjectForm((current) => ({ ...current, goal: event.target.value }))} placeholder="완료할 결과" /></label><label className={styles.projectEditWide}><span>다음 행동</span><input value={projectForm.next} onChange={(event) => setProjectForm((current) => ({ ...current, next: event.target.value }))} placeholder="지금 바로 이어갈 한 가지" /></label><label className={styles.projectEditWide}><span>막힘</span><input value={projectForm.blocker} onChange={(event) => setProjectForm((current) => ({ ...current, blocker: event.target.value }))} placeholder="없으면 비워두기" /></label><label><span>확인 시점</span><input value={projectForm.due} onChange={(event) => setProjectForm((current) => ({ ...current, due: event.target.value }))} placeholder="예: 2026-08-18" /></label><button className={styles.primary} disabled={statusSaving || !projectForm.owner.trim() || !projectForm.next.trim()} onClick={() => void saveProject()}>{statusSaving ? '저장 중' : '원장에 저장'}</button></section>}
      <nav className={styles.projectTabs}>{(['개요', '할 일', '문서·링크', '활동'] as const).map((item) => <button key={item} className={tab === item ? styles.tabActive : ''} onClick={() => setTab(item)}>{item}{item === '할 일' ? ` ${linkedTasks.length}` : ''}</button>)}</nav>
      {tab === '개요' && <><section className={styles.readSummary}><article><h3>프로젝트 설명</h3><p>{active.summary || '프로젝트 목표와 합의한 범위를 운영원장에서 확인합니다.'}</p><small>목표 · 합의된 결과를 만들기 / 완료 기준 · 고객 또는 내부 승인</small></article><article><h3>다음 행동</h3><b>{active.next || '다음 행동 등록 필요'}</b><small>할 일 {linkedTasks.length}개와 연결됨</small></article></section>{할일영역}<section className={styles.readSection}><h3>진행 묶음</h3>{streams.length ? streams.map((stream) => <article className={styles.readWorkstream} key={stream.name}><div><b>{stream.name}</b><p>만들 결과 · {stream.outcome || '결과 정의 필요'}</p></div><Badge>{stream.status || '확인 필요'}</Badge><span>담당 {stream.owner || '미정'} · 다음 행동 {stream.next || '등록 필요'}</span></article>) : <p className={styles.empty}>연결된 진행 묶음이 없습니다.</p>}</section><section className={styles.readSection}><div className={styles.workstreamHead}><div><h3>문서 · 링크</h3><span>원본은 Drive에 두고 운영원장에는 연결 위치만 남깁니다.</span></div><button className={styles.secondary} onClick={() => setTab('문서·링크')}>문서 관리</button></div>{projectLinks.length ? projectLinks.map((link) => <p className={styles.overviewLink} key={`${link.name}-${link.url}`}><a href={link.url} target="_blank" rel="noreferrer">{link.name || '연결 자료'}</a><span>{link.purpose || '용도 미기록'}</span></p>) : <p className={styles.empty}>아직 연결한 공유 링크가 없습니다.</p>}</section><section className={styles.readSection}><div className={styles.workstreamHead}><div><h3>최근 활동</h3><span>결정·일정·작업 이력을 최근 순서로 봅니다.</span></div><button className={styles.secondary} onClick={() => setTab('활동')}>활동 전체</button></div>{activities.length ? activities.slice(0, 6).map((item, index) => <article className={styles.readWorkstream} key={`${item.kind}-${item.id || index}`}><div><b>{item.title}</b><p>{[item.detail, item.actor].filter(Boolean).join(' · ') || '추가 설명 없음'}</p></div><Badge>{item.kind}</Badge><span>{item.at || '시각 미기록'}</span></article>) : <p className={styles.empty}>프로젝트 운영원장에 아직 등록된 활동이 없습니다.</p>}</section></>}
      {tab === '할 일' && 할일영역}
      {tab === '문서·링크' && <section className={styles.readSection}><div className={styles.workstreamHead}><div><h3>문서 · 링크</h3><span>실제 파일은 Drive에 한 번만 저장하고 운영원장에는 링크를 남깁니다.</span></div><div><button className={styles.secondary} disabled={!writable || assetSaving} onClick={() => { setIsAddingLink((value) => !value); setIsAddingFile(false); }}>링크 추가</button><button className={styles.primary} disabled={!writable || assetSaving || !active.driveUrl} onClick={() => { setIsAddingFile((value) => !value); setIsAddingLink(false); }}>파일 넣기</button></div></div>{!writable && <p className={styles.empty}>{writeMessage}</p>}{isAddingLink && <div className={styles.inlineAssetForm}><input value={linkForm.name} onChange={(event) => setLinkForm((current) => ({ ...current, name: event.target.value }))} placeholder="링크 이름" /><input value={linkForm.purpose} onChange={(event) => setLinkForm((current) => ({ ...current, purpose: event.target.value }))} placeholder="용도" /><input value={linkForm.url} onChange={(event) => setLinkForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://" /><button className={styles.primary} disabled={assetSaving || !linkForm.name.trim() || !/^https?:\/\//i.test(linkForm.url)} onClick={() => void addLink()}>{assetSaving ? '기록 중' : '링크 기록'}</button></div>}{isAddingFile && <div className={styles.inlineAssetForm}><select value={fileForm.target} onChange={(event) => setFileForm((current) => ({ ...current, target: event.target.value as typeof current.target }))}><option>01_자료</option><option>02_제작</option><option>03_결과물</option></select><input type="file" onChange={(event) => setFileForm((current) => ({ ...current, file: event.target.files?.[0] }))} /><button className={styles.primary} disabled={assetSaving || !fileForm.file} onClick={() => void addFile()}>{assetSaving ? '업로드 중' : 'Drive에 넣기'}</button><small>50MB가 넘는 파일은 Drive 폴더에 직접 넣고 링크만 연결합니다.</small></div>}{notice && <p className={styles.empty}>{notice}</p>}{projectLinks.map((link) => <p key={`${link.name}-${link.url}`}><a href={link.url} target="_blank" rel="noreferrer">{link.name || '연결 자료'} 열기</a>{link.purpose ? ` · ${link.purpose}` : ''}</p>)}{streams.filter((stream) => stream.links).map((stream) => <p key={stream.name}><a href={stream.links} target="_blank" rel="noreferrer">{stream.name} 연결 자료 열기</a></p>)}{!projectLinks.length && !streams.some((stream) => stream.links) && <p>아직 연결한 공유 링크가 없습니다.</p>}</section>}
      {tab === '활동' && <section className={styles.readSection}><h3>결정 · 일정 · 이력</h3>{activities.length ? activities.map((item, index) => <article className={styles.readWorkstream} key={`${item.kind}-${item.id || index}`}><div><b>{item.title}</b><p>{[item.detail, item.actor].filter(Boolean).join(' · ') || '추가 설명 없음'}</p></div><Badge>{item.kind}</Badge><span>{item.at || '시각 미기록'}{item.end ? ` ~ ${item.end}` : ''}</span></article>) : <p>프로젝트 운영원장에 아직 등록된 결정·일정·이력이 없습니다.</p>}</section>}
    </main>
  </section></div>;
}
