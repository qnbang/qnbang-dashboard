'use client';

import { useMemo, useState } from 'react';
import styles from '../operating.module.css';

type 진행묶음 = { name: string; outcome?: string; status?: string; owner?: string; next?: string; links?: string };
export type 운영프로젝트 = { name: string; client: string; next: string; status: string; owner: string; summary?: string; due?: string; workstreams?: 진행묶음[]; driveUrl?: string };
export type 운영할일 = { title: string; project: string; due: string; owner: string; state: string };

const Badge = ({ children }: { children: string }) => <span className={styles.badge}>{children}</span>;

export default function ProjectWorkspaceModal({ project, projects, tasks, onClose }: { project: 운영프로젝트; projects: 운영프로젝트[]; tasks: 운영할일[]; onClose: () => void }) {
  const [active, setActive] = useState(project);
  const [tab, setTab] = useState<'개요' | '할 일' | '문서·링크' | '활동'>('개요');
  const [done, setDone] = useState<string[]>([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [addedTasks, setAddedTasks] = useState<운영할일[]>([]);
  const linkedTasks = useMemo(() => [...tasks, ...addedTasks].filter((item) => item.project === active.name), [active.name, addedTasks, tasks]);
  const streams = active.workstreams || [];

  const addTask = async () => {
    if (!taskTitle.trim()) return;
    setIsSaving(true);
    setNotice('');
    try {
      const response = await fetch('/api/office/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project: active.name, task: taskTitle.trim(), customer: active.client, owner: active.owner, ball: '받은일', 출처: '운영OS 프로젝트' }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '기록하지 못했습니다.');
      setAddedTasks((current) => [...current, { title: taskTitle.trim(), project: active.name, due: '날짜 미정', owner: active.owner, state: '받은일' }]);
      setTaskTitle('');
      setIsAddingTask(false);
      setNotice('기존 과업 원장에 할 일을 등록했습니다.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '할 일을 기록하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return <div className={styles.modalBackdrop} role="presentation" onMouseDown={onClose}><section className={styles.projectBrowse} role="dialog" aria-modal="true" aria-label={`${active.name} 프로젝트 열람`} onMouseDown={(event) => event.stopPropagation()}>
    <aside className={styles.projectExplorer}><div><h2>프로젝트</h2><input placeholder="프로젝트 검색" /><p>열람 필터</p><div className={styles.explorerChips}><Badge>진행 중</Badge><Badge>내 담당</Badge><Badge>마감 임박</Badge></div></div><div className={styles.explorerList}>{projects.map((item) => <button type="button" className={item.name === active.name ? styles.explorerActive : ''} key={item.name} onClick={() => { setActive(item); setTab('개요'); setNotice(''); }}><b>{item.name}</b><small>{item.due || '확인 시점 미정'} · {item.next}</small></button>)}</div><button className={styles.primary} onClick={onClose}>목록으로 돌아가기</button></aside>
    <main className={styles.projectRead}><div className={styles.projectReadHead}><div><p>프로젝트 / {active.name}</p><h2>{active.name}</h2><span><Badge>{active.status}</Badge>{active.client} · 담당 {active.owner} · 확인 시점 {active.due || '미정'}</span></div><div>{active.driveUrl && <a className={styles.secondary} href={active.driveUrl} target="_blank" rel="noreferrer">Drive 폴더 열기</a>}<button className={styles.closeButton} onClick={onClose}>닫기</button></div></div>
      <nav className={styles.projectTabs}>{(['개요', '할 일', '문서·링크', '활동'] as const).map((item) => <button key={item} className={tab === item ? styles.tabActive : ''} onClick={() => setTab(item)}>{item}{item === '할 일' ? ` ${linkedTasks.length}` : ''}</button>)}</nav>
      {tab === '개요' && <><section className={styles.readSummary}><article><h3>프로젝트 설명</h3><p>{active.summary || '프로젝트 목표와 합의한 범위를 운영원장에서 확인합니다.'}</p><small>목표 · 합의된 결과를 만들기 / 완료 기준 · 고객 또는 내부 승인</small></article><article><h3>다음 행동</h3><b>{active.next}</b><small>할 일 {linkedTasks.length}개와 연결됨</small></article></section><section className={styles.readSection}><h3>진행 묶음</h3>{streams.length ? streams.map((stream) => <article className={styles.readWorkstream} key={stream.name}><div><b>{stream.name}</b><p>만들 결과 · {stream.outcome || '결과 정의 필요'}</p></div><Badge>{stream.status || '확인 필요'}</Badge><span>담당 {stream.owner || '미정'} · 다음 행동 {stream.next || '등록 필요'}</span></article>) : <p>연결된 진행 묶음이 없습니다.</p>}</section></>}
      {tab === '할 일' && <section className={styles.readSection}><div className={styles.workstreamHead}><div><h3>할 일</h3><span>등록하면 기존 과업 원장에 기록됩니다.</span></div><button className={styles.secondary} onClick={() => setIsAddingTask((value) => !value)}>할 일 추가</button></div>{isAddingTask && <div className={styles.inlineTaskForm}><input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="새 할 일" /><button className={styles.primary} disabled={isSaving || !taskTitle.trim()} onClick={addTask}>{isSaving ? '기록 중' : '기록하기'}</button></div>}{notice && <p className={styles.empty}>{notice}</p>}{linkedTasks.length ? linkedTasks.map((task) => <article className={styles.readWorkstream} key={task.title}><button className={`${styles.checkButton} ${done.includes(task.title) ? styles.checked : ''}`} aria-label={`${task.title} 완료 처리`} onClick={() => setDone((current) => current.includes(task.title) ? current.filter((item) => item !== task.title) : [...current, task.title])}>{done.includes(task.title) ? '✓' : ''}</button><div><b>{task.title}</b><p>{task.owner} · {done.includes(task.title) ? '완료 표시' : task.state}</p></div><Badge>{task.due}</Badge></article>) : <p>연결된 할 일이 없습니다.</p>}</section>}
      {tab === '문서·링크' && <section className={styles.readSection}><h3>문서 · 링크</h3>{streams.some((stream) => stream.links) ? streams.filter((stream) => stream.links).map((stream) => <p key={stream.name}><a href={stream.links} target="_blank" rel="noreferrer">{stream.name} 연결 자료 열기</a></p>) : <p>이 프로젝트는 아직 확인된 공유 링크가 없습니다. 링크와 파일 등록은 프로젝트별 운영원장 연결을 마친 뒤에만 활성화합니다.</p>}</section>}
      {tab === '활동' && <section className={styles.readSection}><h3>최근 활동</h3><p>현재 프로젝트 원장에서 확인된 다음 행동과 진행 묶음을 표시합니다.</p></section>}
    </main>
  </section></div>;
}
