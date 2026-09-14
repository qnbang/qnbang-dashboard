'use client';

import { useMemo, useRef, useState } from 'react';
import styles from '../operating.module.css';

export type 수신메시지 = {
  id: string;
  channel: string;
  messageId: string;
  sender: string;
  body: string;
  receivedAt: string;
  customer: string;
  project: string;
  projectId?: string;
  room?: string;
  attachments?: string;
  taskId: string;
  status: string;
  originalLink: string;
  time: string;
  action: string;
};

function 시간표시(value: string) {
  if (!value) return '시각 미상';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
}

type 수신프로젝트 = { id?: string; name: string; owner: string };
type 생성할일 = { id?: string; ledgerProjectId?: string; title: string; project: string; due: string; owner: string; state: string };

export default function OperatingInbox({ items, status, message, projects, onTaskCreated }: { items: 수신메시지[]; status: string; message?: string; projects: 수신프로젝트[]; onTaskCreated: (task: 생성할일) => void }) {
  const [channel, setChannel] = useState('전체');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(items[0]?.id || '');
  const [drafts, setDrafts] = useState<Record<string, { title: string; projectId: string; owner: string; due: string }>>({});
  const [updates, setUpdates] = useState<Record<string, Partial<수신메시지>>>({});
  const busy = useRef(false);
  const [pendingLinks, setPendingLinks] = useState<Record<string, { projectId: string; task: { id: string; title: string; owner: string; due?: string; state: string } }>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const channels = ['전체', ...Array.from(new Set(items.map((item) => item.channel)))];
  const visible = useMemo(() => items.map((item) => ({ ...item, ...updates[item.id] })).filter((item) => {
    const matchesChannel = channel === '전체' || item.channel === channel;
    const search = `${item.sender} ${item.body} ${item.customer} ${item.project}`.toLowerCase();
    return matchesChannel && search.includes(query.toLowerCase());
  }), [channel, items, query, updates]);
  const selected = visible.find((item) => item.id === selectedId) || visible[0];
  const pending = selected ? pendingLinks[selected.id] : undefined;
  const draft = selected ? drafts[selected.id] : undefined;
  const taskTitle = pending?.task.title ?? draft?.title ?? (selected?.action && !selected.action.includes('원문을 확인') ? selected.action : selected?.body.slice(0, 60) || '');
  const projectId = pending?.projectId ?? draft?.projectId ?? selected?.projectId ?? '';
  const linkedProject = projects.find((project) => project.id === projectId);
  const owner = pending?.task.owner ?? draft?.owner ?? linkedProject?.owner ?? '';
  const due = pending?.task.due ?? draft?.due ?? '';
  const updateDraft = (patch: Partial<{ title: string; projectId: string; owner: string; due: string }>) => {
    if (selected) setDrafts((previous) => ({ ...previous, [selected.id]: { title: taskTitle, projectId, owner, due, ...patch } }));
  };

  const updateStatus = async (nextStatus: string) => {
    if (!selected || busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      const response = await fetch('/api/operating/inbox', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inboxId: selected.id, status: nextStatus }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '처리 상태를 저장하지 못했습니다.');
      setUpdates((previous) => ({ ...previous, [selected.id]: { ...previous[selected.id], status: nextStatus } }));
      setNotice('처리 상태를 저장했습니다.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '처리 상태를 저장하지 못했습니다.');
    } finally { busy.current = false; setSaving(false); }
  };

  const createTask = async () => {
    if (!selected || !linkedProject?.id || !taskTitle.trim() || !owner.trim() || selected.taskId || busy.current) return;
    busy.current = true;
    setSaving(true);
    setNotice('');
    try {
      let pending = pendingLinks[selected.id];
      if (!pending) {
        const taskResponse = await fetch('/api/operating/project-tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: linkedProject.id, title: taskTitle.trim(), owner: owner.trim(), due, inboxId: selected.id }) });
        const taskData = await taskResponse.json();
        if (!taskResponse.ok || !taskData.ok) throw new Error(taskData.error || '프로젝트 할 일을 만들지 못했습니다.');
        pending = { projectId: linkedProject.id, task: taskData.task };
        setPendingLinks((previous) => ({ ...previous, [selected.id]: pending }));
      }
      const taskData = pending;
      const linkResponse = await fetch('/api/operating/inbox', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inboxId: selected.id, taskId: taskData.task.id, projectId: pending.projectId, status: '확정 반영' }) });
      const linkData = await linkResponse.json();
      if (!linkResponse.ok || !linkData.ok) throw new Error(linkData.error || '수신 기록과 할 일을 연결하지 못했습니다.');
      onTaskCreated({ id: taskData.task.id, ledgerProjectId: pending.projectId, title: taskData.task.title, project: projects.find((project) => project.id === pending.projectId)?.name || pending.projectId, due: taskData.task.due || '기한 미정', owner: taskData.task.owner, state: taskData.task.state });
      setUpdates((previous) => ({ ...previous, [selected.id]: { taskId: taskData.task.id, projectId: pending.projectId, project: projects.find((project) => project.id === pending.projectId)?.name || pending.projectId, status: '확정 반영' } }));
      setPendingLinks((previous) => { const next = { ...previous }; delete next[selected.id]; return next; });
      setNotice('프로젝트 할 일로 등록하고 수신 원문과 연결했습니다.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '할 일로 등록하지 못했습니다.');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return <>
    <section className={styles.screenIntro}><div><p className={styles.crumb}>수신함</p><h1>통합 수신함</h1><p>출처와 원문을 함께 보관하고, 확인한 뒤에만 기존 OS의 할 일로 연결합니다.</p></div><span className={styles.badge}>{status}</span></section>
    <div className={styles.inboxSearch}><input value={query} disabled={saving} onChange={(event) => { setQuery(event.target.value); setNotice(''); }} placeholder="보낸 사람, 내용, 고객사로 검색" /><div>{channels.map((item) => <button key={item} className={channel === item ? styles.filterActive : ''} disabled={saving} onClick={() => { setChannel(item); setNotice(''); }}>{item === '전체' ? `전체 ${items.length}` : item}</button>)}</div></div>
    <div className={styles.inboxFigma}>
      <section className={`${styles.panel} ${styles.inboxList}`}><p className={styles.listOrder}>새로 들어온 순 · 원문은 변경하지 않습니다.</p>{visible.length ? visible.map((item) => <button className={`${styles.inboxRow} ${selected?.id === item.id ? styles.selected : ''}`} key={item.id} disabled={saving} onClick={() => { setSelectedId(item.id); setNotice(''); }}><span className={styles.badge}>{item.channel}</span><div><b>{item.sender}</b><p>{item.body}</p><small>{item.customer} · {item.project} · {item.status}</small></div><time>{시간표시(item.receivedAt)}</time></button>) : <p className={styles.empty}>{message || '아직 수신 원문이 없습니다. 라크·카카오톡·메일 연결 뒤 여기에 표시됩니다.'}</p>}<p className={styles.inboxFoot}>원문 보관 · 연결 기록 {items.length}건</p></section>
      <section className={`${styles.panel} ${styles.inboxDetail}`}>
        <div className={styles.panelHead}><h2>원문 대화</h2><span>{selected?.channel || '수신 원문'}</span></div>
        {selected ? <><p className={styles.meta}>{selected.sender} · {시간표시(selected.receivedAt)} · 메시지 ID {selected.messageId || '없음'}</p><div className={styles.bubble}>{selected.body}</div><div className={styles.detailInfo}><p><b>대화방</b>{selected.room || '정보 없음'}</p><p><b>첨부 정보</b>{selected.attachments || '없음'}</p><p><b>연결 고객</b>{selected.customer}</p><p><b>연결 프로젝트</b>{selected.project}</p><p><b>처리 상태</b>{selected.status}</p><p><b>연결된 할 일</b>{selected.taskId || '아직 없음'}</p></div>{selected.originalLink ? <a className={styles.secondary} href={/^https?:\/\//i.test(selected.originalLink) ? selected.originalLink : undefined} target="_blank" rel="noreferrer">원문 위치 열기</a> : <p className={styles.empty}>원문 링크는 수신 경로가 제공할 때만 표시됩니다.</p>} {!selected.taskId && <>
          <div className={styles.inlineTaskForm} style={{ flexWrap: 'wrap' }}>
            <label style={{ display: 'grid', gap: 6, flex: '1 1 180px', minWidth: 0 }}>프로젝트<select style={{ width: '100%', minHeight: 40, font: 'inherit' }} aria-label="프로젝트" disabled={saving || !!pendingLinks[selected.id]} value={projectId} onChange={(event) => { updateDraft({ projectId: event.target.value, owner: projects.find((project) => project.id === event.target.value)?.owner || '' }); }}><option value="">프로젝트 선택</option>{projects.filter((project) => project.id).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
            <label style={{ display: 'grid', gap: 6, flex: '1 1 140px', minWidth: 0 }}>담당<input aria-label="담당" disabled={saving || !!pendingLinks[selected.id]} value={owner} onChange={(event) => updateDraft({ owner: event.target.value })} placeholder="담당자" /></label>
            <label style={{ display: 'grid', gap: 6, flex: '1 1 140px', minWidth: 0 }}>기한<input aria-label="기한" disabled={saving || !!pendingLinks[selected.id]} type="date" value={due} onChange={(event) => updateDraft({ due: event.target.value })} /></label>
            <label style={{ display: 'grid', gap: 6, flex: '1 1 100%', minWidth: 0 }}>할 일<input aria-label="등록할 할 일" disabled={saving || !!pendingLinks[selected.id]} value={taskTitle} onChange={(event) => updateDraft({ title: event.target.value })} placeholder="등록할 할 일" /></label>
            <button className={styles.primary} disabled={saving || !taskTitle.trim() || !owner.trim() || !linkedProject?.id} onClick={() => void createTask()}>{saving ? '저장 중' : pendingLinks[selected.id] ? '원문 연결 재시도' : '할 일로 등록'}</button>
          </div>
          <div><button className={styles.secondary} disabled={saving || !!pendingLinks[selected.id]} onClick={() => void updateStatus('검토중')}>검토중</button> <button className={styles.secondary} disabled={saving || !!pendingLinks[selected.id]} onClick={() => void updateStatus('무시')}>무시</button></div>
          {!linkedProject?.id && <p className={styles.empty}>확인한 프로젝트를 선택하고 담당과 기한을 지정해 주세요. 기한은 비워 둘 수 있습니다.</p>}
        </>}{notice && <p className={styles.empty}>{notice}</p>}</> : <p className={styles.empty}>왼쪽에서 원문을 선택하면 고객·프로젝트·처리 상태를 함께 확인할 수 있습니다.</p>}
      </section>
    </div>
  </>;
}
