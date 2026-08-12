'use client';

import { useEffect, useMemo, useState } from 'react';
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
  const [taskTitle, setTaskTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const channels = ['전체', ...Array.from(new Set(items.map((item) => item.channel)))];
  const visible = useMemo(() => items.filter((item) => {
    const matchesChannel = channel === '전체' || item.channel === channel;
    const search = `${item.sender} ${item.body} ${item.customer} ${item.project}`.toLowerCase();
    return matchesChannel && search.includes(query.toLowerCase());
  }), [channel, items, query]);
  const selected = visible.find((item) => item.id === selectedId) || items.find((item) => item.id === selectedId) || visible[0];
  const linkedProject = selected ? projects.find((project) => project.id === selected.project || project.name === selected.project || project.name.includes(selected.project) || selected.project.includes(project.name)) : undefined;
  useEffect(() => { setTaskTitle(selected?.action && !selected.action.includes('원문을 확인') ? selected.action : selected?.body.slice(0, 60) || ''); setNotice(''); }, [selected?.action, selected?.body, selected?.id]);

  const createTask = async () => {
    if (!selected || !linkedProject?.id || !taskTitle.trim() || selected.taskId) return;
    setSaving(true);
    setNotice('');
    try {
      const taskResponse = await fetch('/api/operating/project-tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: linkedProject.id, title: taskTitle.trim(), owner: linkedProject.owner, source: `${selected.channel} 수신함 · ${selected.id}` }) });
      const taskData = await taskResponse.json();
      if (!taskResponse.ok || !taskData.ok) throw new Error(taskData.error || '프로젝트 할 일을 만들지 못했습니다.');
      const linkResponse = await fetch('/api/operating/inbox', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inboxId: selected.id, taskId: taskData.task.id }) });
      const linkData = await linkResponse.json();
      if (!linkResponse.ok || !linkData.ok) throw new Error(linkData.error || '수신 기록과 할 일을 연결하지 못했습니다.');
      onTaskCreated({ id: taskData.task.id, ledgerProjectId: linkedProject.id, title: taskData.task.title, project: linkedProject.name, due: '기한 미정', owner: taskData.task.owner, state: taskData.task.state });
      setNotice('프로젝트 할 일로 등록하고 수신 원문과 연결했습니다.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '할 일로 등록하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return <>
    <section className={styles.screenIntro}><div><p className={styles.crumb}>수신함</p><h1>통합 수신함</h1><p>출처와 원문을 함께 보관하고, 확인한 뒤에만 기존 OS의 할 일로 연결합니다.</p></div><span className={styles.badge}>{status}</span></section>
    <div className={styles.inboxSearch}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="보낸 사람, 내용, 고객사로 검색" /><div>{channels.map((item) => <button key={item} className={channel === item ? styles.filterActive : ''} onClick={() => setChannel(item)}>{item === '전체' ? `전체 ${items.length}` : item}</button>)}</div></div>
    <div className={styles.inboxFigma}>
      <section className={`${styles.panel} ${styles.inboxList}`}><p className={styles.listOrder}>새로 들어온 순 · 원문은 변경하지 않습니다.</p>{visible.length ? visible.map((item) => <button className={`${styles.inboxRow} ${selected?.id === item.id ? styles.selected : ''}`} key={item.id} onClick={() => setSelectedId(item.id)}><span className={styles.badge}>{item.channel}</span><div><b>{item.sender}</b><p>{item.body}</p><small>{item.customer} · {item.project} · {item.status}</small></div><time>{시간표시(item.receivedAt)}</time></button>) : <p className={styles.empty}>{message || '아직 수신 원문이 없습니다. 라크·카카오톡·메일 연결 뒤 여기에 표시됩니다.'}</p>}<p className={styles.inboxFoot}>원문 보관 · 연결 기록 {items.length}건</p></section>
      <section className={`${styles.panel} ${styles.inboxDetail}`}>
        <div className={styles.panelHead}><h2>원문 대화</h2><span>{selected?.channel || '수신 원문'}</span></div>
        {selected ? <><p className={styles.meta}>{selected.sender} · {시간표시(selected.receivedAt)} · 메시지 ID {selected.messageId || '없음'}</p><div className={styles.bubble}>{selected.body}</div><div className={styles.detailInfo}><p><b>연결 고객</b>{selected.customer}</p><p><b>연결 프로젝트</b>{selected.project}</p><p><b>처리 상태</b>{selected.status}</p><p><b>연결된 할 일</b>{selected.taskId || '아직 없음'}</p></div>{selected.originalLink ? <a className={styles.secondary} href={selected.originalLink} target="_blank" rel="noreferrer">원문 위치 열기</a> : <p className={styles.empty}>원문 링크는 수신 경로가 제공할 때만 표시됩니다.</p>} {!selected.taskId && <div className={styles.inlineTaskForm}><input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="등록할 할 일" /><button className={styles.primary} disabled={saving || !taskTitle.trim() || !linkedProject?.id} onClick={() => void createTask()}>{saving ? '등록 중' : '할 일로 등록'}</button></div>}{!linkedProject?.id && !selected.taskId && <p className={styles.empty}>프로젝트가 중앙 원장과 연결된 뒤 할 일로 등록할 수 있습니다.</p>}{notice && <p className={styles.empty}>{notice}</p>}</> : <p className={styles.empty}>왼쪽에서 원문을 선택하면 고객·프로젝트·처리 상태를 함께 확인할 수 있습니다.</p>}
      </section>
    </div>
  </>;
}
