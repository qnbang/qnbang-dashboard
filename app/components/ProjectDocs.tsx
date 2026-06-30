'use client';
// 프로젝트 문서 뷰(읽기 전용) 모달 — 프로젝트명으로 GitHub 저장소를 찾아 작업로그·현황판·문서를 보여준다.
// CRM(고객 관리)·프로젝트 아카이브 양쪽에서 같은 모달을 재사용한다.

import { useEffect, useState } from 'react';
import { renderMarkdown } from '@/lib/markdown';
import { Loading } from './ui';

type ProjectRepo = { repo: string; title: string; manager?: string };
type DocItem = { path: string; title: string; group: string };
type ItemState = 'done' | 'waiting' | 'todo';
type StatusSection = { name: string; items: { text: string; state: ItemState }[]; done: number; total: number };

// 작업로그.md → ## 날짜 단위 엔트리(요약 = 첫 **굵게** 줄)
function parseWorkLog(md: string): { date: string; summary: string; body: string }[] {
  const lines = md.split('\n');
  const entries: { date: string; summary: string; body: string }[] = [];
  let cur: { date: string; summary: string; body: string } | null = null;
  for (const line of lines) {
    if (/^##\s/.test(line)) {
      if (cur) entries.push(cur);
      cur = { date: line.replace(/^##\s/, '').trim(), summary: '', body: '' };
    } else if (cur) {
      const b = line.match(/^\*\*(.+?)\*\*$/);
      if (b && !cur.summary) cur.summary = b[1];
      cur.body += line + '\n';
    }
  }
  if (cur) entries.push(cur);
  return entries;
}

// 현황판.md 의 ## 단계 + 체크박스(- [x]완료 / - [~]대기 / - [ ]할일)를 진행률로 분해
function parseStatusBoard(md: string): { sections: StatusSection[]; done: number; total: number } {
  const lines = md.split('\n');
  const sections: StatusSection[] = [];
  let cur: StatusSection | null = null;
  for (const line of lines) {
    if (/^##\s/.test(line)) {
      if (cur) sections.push(cur);
      cur = { name: line.replace(/^##\s/, '').trim(), items: [], done: 0, total: 0 };
    } else {
      const m = line.match(/^\s*[-*]\s*\[([ xX~\-])\]\s*(.+)$/);
      if (m && cur) {
        const mark = m[1].toLowerCase();
        const state: ItemState = mark === 'x' ? 'done' : (mark === '~' || mark === '-') ? 'waiting' : 'todo';
        cur.items.push({ text: m[2].trim(), state });
        cur.total++; if (state === 'done') cur.done++;
      }
    }
  }
  if (cur) sections.push(cur);
  const done = sections.reduce((s, x) => s + x.done, 0);
  const total = sections.reduce((s, x) => s + x.total, 0);
  return { sections, done, total };
}

// 현황판.md의 "## 한 줄"(요약/개요) 섹션 = 사람한테 보여줄 "어떤 프로젝트인지" 한 줄.
function projectOneLiner(md: string): string {
  const m = md.match(/\n##\s*(?:한 ?줄|요약|개요)[^\n]*\n([\s\S]*?)(?:\n##\s|\n---|$)/);
  if (!m) return '';
  return m[1]
    .replace(/^>\s?/gm, '').replace(/\*+/g, '')    // 블록쿼트·굵게/이탤릭 마커 제거
    .replace(/\s*→\s*https?:\/\/\S+/g, '')          // 끝에 붙은 "→ 링크" 제거
    .replace(/\s+/g, ' ').trim().slice(0, 280);
}

// 프로젝트명 → 저장소 매칭. 공백 제거 부분문자열 우선, 안 잡히면 의미 단어 겹침으로.
// (우산 브랜드: "반보 북적북적 1기" ↔ 저장소 "큐앤뱅 반보" → 공통 단어 '반보'로 연결)
const BRAND_STOP = new Set(['큐앤뱅', '프로젝트', '대행', '자체', '홈페이지', '웹사이트', '리뉴얼']);
const sq = (s: string) => (s || '').replace(/\s+/g, '');
const toks = (s: string) => (String(s).match(/[가-힣]{2,}|[A-Za-z]{3,}/g) || []).filter((w) => !BRAND_STOP.has(w));
function matchRepo(name: string, projects: ProjectRepo[]): ProjectRepo | undefined {
  const n = sq(name);
  const hit = projects.find((p) => { const q = sq(p.title); return !!q && (q.includes(n) || n.includes(q)); });
  if (hit) return hit;
  const T = toks(name);
  return projects.find((p) => { const P = toks(p.title); return P.some((x) => T.includes(x)); });
}

export default function ProjectDocs({ name, onClose }: { name: string; onClose: () => void }) {
  const [repo, setRepo] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'notfound' | 'ok'>('loading');
  const [workLog, setWorkLog] = useState<string | null>(null);
  const [statusBoard, setStatusBoard] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [openLog, setOpenLog] = useState<number | null>(null);
  const [openD, setOpenD] = useState<{ title: string; content: string } | null>(null);
  const [outsrc, setOutsrc] = useState(false); // 외주(담당자가 내부팀 아님) — 작업로그 대신 메모 관리
  useEffect(() => {
    (async () => {
      const j = await fetch('/api/git-projects').then((r) => r.json()).catch(() => null);
      const m = j?.ok ? matchRepo(name, j.projects as ProjectRepo[]) : undefined;
      if (!m) { setState('notfound'); return; }
      const mgr = String(m.manager || '');
      setOutsrc(!!mgr && !['신종호', '김지영'].some((x) => mgr.includes(x))); // 내부팀 아니면 외주
      setRepo(m.repo);
      const d = await fetch(`/api/git-projects/${m.repo}`).then((r) => r.json()).catch(() => null);
      if (d?.ok) { setWorkLog(d.workLog); setStatusBoard(d.statusBoard || null); setDocs(d.docs || []); }
      setState('ok');
    })();
  }, [name]);
  const readDoc = async (doc: DocItem) => {
    if (!repo) return;
    setOpenD({ title: doc.title, content: '불러오는 중…' });
    const j = await fetch(`/api/git-projects/${repo}/doc?path=${encodeURIComponent(doc.path)}`).then((r) => r.json()).catch(() => null);
    setOpenD({ title: doc.title, content: j?.content || '내용을 불러오지 못했어요.' });
  };
  const entries = workLog ? parseWorkLog(workLog) : [];
  const intro = statusBoard ? projectOneLiner(statusBoard) : '';
  const status = statusBoard ? parseStatusBoard(statusBoard) : null;
  const grouped: Record<string, DocItem[]> = {};
  for (const d of docs) (grouped[d.group] ||= []).push(d);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl mx-auto my-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="text-sm font-bold text-slate-800">📁 {name}</h3>
          <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">닫기 ✕</button>
        </div>
        <div className="p-5 space-y-4">
          {state === 'loading' && <Loading text="문서 불러오는 중" pad="py-8" />}
          {state === 'notfound' && <p className="text-slate-400 text-sm text-center py-8">연결된 GitHub 저장소를 못 찾았어요.<br /><span className="text-xs">(프로젝트.json·qnbang-project 토픽 확인)</span></p>}
          {state === 'ok' && (<>
            {intro && (
              <div className="text-[12.5px] text-slate-600 leading-relaxed bg-slate-50 border-l-[3px] border-slate-300 rounded-r-md px-3 py-2">{intro}</div>
            )}
            {status && status.total > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">진행률 {Math.round((status.done / status.total) * 100)}% ({status.done}/{status.total})</div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-400" style={{ width: `${(status.done / status.total) * 100}%` }} /></div>
              </div>
            )}
            {entries.length === 0 && (
              outsrc
                ? <div className="rounded-lg bg-teal-50 border border-teal-200 px-3 py-2 text-[12.5px] text-teal-700">🤝 외주 프로젝트 — 작업로그 대신 <b>메모·할일</b>로 관리해요. 보고 받은 건 보드 카드에 한 줄씩 쌓으면 돼요.</div>
                : <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12.5px] text-amber-700 font-medium">⚠️ 작업로그 누락 — <code className="text-[11px] bg-amber-100 px-1 rounded">0_작업로그.md</code>가 없어요. 이 프로젝트는 작업 기록이 안 쌓이고 있어요.</div>
            )}
            {entries.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-2">🕘 작업로그</div>
                <div className="space-y-1.5">
                  {entries.map((e, i) => (
                    <div key={i} className="border border-slate-100 rounded-lg">
                      <button onClick={() => setOpenLog(openLog === i ? null : i)} className="w-full text-left px-3 py-2 flex items-baseline gap-2">
                        <span className="text-[11px] text-slate-400 shrink-0">{e.date}</span>
                        <span className="text-[12.5px] text-slate-700 font-medium flex-1">{e.summary}</span>
                        <span className="text-[10px] text-slate-300">{openLog === i ? '▲' : '▾'}</span>
                      </button>
                      {openLog === i && e.body && <div className="px-3 pb-2 border-t border-slate-50 pt-2">{renderMarkdown(e.body)}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {docs.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-2">📄 문서</div>
                {Object.entries(grouped).map(([g, items]) => (
                  <div key={g} className="mb-2">
                    <div className="text-[11px] text-slate-400 mb-1">{g}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((d) => <button key={d.path} onClick={() => readDoc(d)} className="text-[12px] px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50">{d.title}</button>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>)}
        </div>
      </div>
      {openD && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setOpenD(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 sticky top-0 bg-white">
              <h3 className="text-sm font-bold text-slate-800">{openD.title}</h3>
              <button onClick={() => setOpenD(null)} className="text-slate-400 hover:text-slate-600 text-sm">닫기 ✕</button>
            </div>
            <div className="p-5">{renderMarkdown(openD.content)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
