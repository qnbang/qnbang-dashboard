'use client';
// 자체사업 모달의 운영 슬롯 — 브랜드별(반보·읽는다·자동화청년) + 시트 도구 메모.
// ProjectDocs의 slot prop으로 들어가 진행률 아래에 렌더된다. 데이터: /api/biz/*, /api/office.

import { useEffect, useState } from 'react';
import { renderMarkdown } from '@/lib/markdown';

type WorkToolLite = { name: string; bizKey?: string; sheetId?: string; memo?: string; links?: { label: string; href: string }[] };

export default function BizOps({ t }: { t: WorkToolLite }) {
  if (t.bizKey === 'banbo') return <BanboOps />;
  if (t.bizKey === 'ikneunda') return <IkneundaOps />;
  if (t.bizKey === 'autoboy') return <AutoBoyOps />;
  if (t.sheetId) return <ToolMemoPanel id={t.sheetId} memo={t.memo || ''} />;
  return null;
}

const SEC = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <div>
    <div className="text-xs font-semibold text-slate-500 mb-2">{title} {hint && <span className="font-normal text-slate-400">{hint}</span>}</div>
    {children}
  </div>
);

/* ── 반보: 프로그램(회차) 목록 + 신청자 표 + 입금 체크 (모집상태 변경은 어드민에서) ── */
type BanboProgram = { id: string; hook?: string; pslogan?: string; badge?: [string, string]; cap?: number; price?: string; term?: string; recruit?: string; start?: string; sheetTab?: string };
type BanboApplicant = { _rowNum: number; 접수시각?: string; 이름?: string; 연락처?: string; 입금?: string; 상태?: string; [k: string]: unknown };

function BanboOps() {
  const [programs, setPrograms] = useState<BanboProgram[] | null>(null);
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [apps, setApps] = useState<Record<string, BanboApplicant[] | 'loading' | 'error'>>({});
  const [busyRow, setBusyRow] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/biz/banbo?view=programs').then((r) => r.json()).then((j) => {
      if (j.ok) setPrograms(j.programs || []); else setErr(j.error || '프로그램을 못 불러왔어요');
    }).catch((e) => setErr(String(e)));
  }, []);

  const openProgram = async (p: BanboProgram) => {
    if (openId === p.id) { setOpenId(null); return; }
    setOpenId(p.id);
    if (apps[p.id]) return;
    setApps((a) => ({ ...a, [p.id]: 'loading' }));
    const q = new URLSearchParams({ view: 'applicants', id: p.id, ...(p.sheetTab ? { tab: p.sheetTab } : {}) });
    const j = await fetch(`/api/biz/banbo?${q}`).then((r) => r.json()).catch(() => null);
    setApps((a) => ({ ...a, [p.id]: j?.ok ? (j.applicants || []) : 'error' }));
  };

  // 입금 판정 = 반보 admin.html과 동일 규칙(TRUE/ㅇ/o)
  const isPaid = (r: BanboApplicant) => /true|ㅇ|^o$/i.test(String(r.입금 || '').trim());

  const togglePaid = async (p: BanboProgram, row: BanboApplicant) => {
    const next = !isPaid(row);
    if (!confirm(`${row.이름 || '신청자'} 입금을 ${next ? '✓ 입금됨' : '미입금'}으로 바꿀까요? (반보 시트에 바로 기록)`)) return;
    setBusyRow(row._rowNum);
    try {
      const j = await fetch('/api/biz/banbo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'paid', id: p.id, rowNum: row._rowNum, paid: next, sheetTab: p.sheetTab }),
      }).then((r) => r.json());
      if (!j.ok) { alert(j.error || '입금 기록 실패'); return; }
      setApps((a) => {
        const list = a[p.id];
        if (!Array.isArray(list)) return a;
        return { ...a, [p.id]: list.map((x) => x._rowNum === row._rowNum ? { ...x, 입금: next ? 'TRUE' : 'FALSE' } : x) };
      });
    } finally { setBusyRow(null); }
  };

  if (err) return <p className="text-xs text-rose-500">⚠️ 반보 연결 실패 — {err}</p>;
  if (!programs) return <p className="text-xs text-slate-400 py-2">반보 프로그램 불러오는 중…</p>;

  return (
    <SEC title="🧡 반보 운영" hint="— 회차·신청자·입금 체크. 모집상태 변경·카드 편집은 어드민에서.">
      <div className="space-y-1.5">
        {programs.length === 0 && <p className="text-xs text-slate-400">등록된 프로그램이 없어요.</p>}
        {programs.map((p) => {
          const list = apps[p.id];
          const isOpen = openId === p.id;
          return (
            <div key={p.id} className="border border-slate-100 rounded-lg">
              <button onClick={() => openProgram(p)} className="w-full text-left px-3 py-2 flex items-center gap-2">
                {p.badge?.[0] && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 shrink-0">{p.badge[0]}</span>}
                <span className="text-[12.5px] font-semibold text-slate-700 flex-1 truncate">{p.hook || p.id} <span className="font-normal text-slate-400">{p.pslogan || ''}</span></span>
                <span className="text-[11px] text-slate-400 shrink-0">{p.term || ''}{p.cap ? ` · 정원 ${p.cap}` : ''}</span>
                <span className="text-[10px] text-slate-300">{isOpen ? '▲' : '▾'}</span>
              </button>
              {isOpen && (
                <div className="border-t border-slate-50 px-3 py-2">
                  {list === 'loading' && <p className="text-xs text-slate-400 py-1">신청자 불러오는 중…</p>}
                  {list === 'error' && <p className="text-xs text-rose-500 py-1">신청자를 못 불러왔어요.</p>}
                  {Array.isArray(list) && (list.length === 0
                    ? <p className="text-xs text-slate-400 py-1">아직 신청자가 없어요.</p>
                    : (
                      <table className="w-full text-[12px]">
                        <thead><tr className="text-left text-slate-400">
                          <th className="py-1 pr-2 font-medium">이름</th>
                          <th className="py-1 pr-2 font-medium">연락처</th>
                          <th className="py-1 pr-2 font-medium">상태</th>
                          <th className="py-1 font-medium text-right">입금</th>
                        </tr></thead>
                        <tbody>
                          {list.map((r) => (
                            <tr key={r._rowNum} className="border-t border-slate-50">
                              <td className="py-1.5 pr-2 text-slate-700 font-medium whitespace-nowrap">{r.이름 || '—'}</td>
                              <td className="py-1.5 pr-2 text-slate-500 whitespace-nowrap">{r.연락처 || ''}</td>
                              <td className="py-1.5 pr-2 text-slate-500">{r.상태 || ''}</td>
                              <td className="py-1.5 text-right">
                                <button onClick={() => togglePaid(p, r)} disabled={busyRow === r._rowNum}
                                  className={`text-[11px] font-bold px-2 py-0.5 rounded ${isPaid(r) ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'} disabled:opacity-40`}>
                                  {busyRow === r._rowNum ? '…' : isPaid(r) ? '✓ 입금됨' : '미입금'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SEC>
  );
}

/* ── 읽는다: 회차 운영 (dashboard-data biz/ikneunda.json — 아직 신청폼 없어 수기 관리) ── */
type ReadsSession = { id: string; date: string; topic: string; place: string; cap: number; participants: string[]; status: string; memo: string };
const READS_STATUS = ['모집중', '마감', '완료', '취소'];

function IkneundaOps() {
  const [sessions, setSessions] = useState<ReadsSession[] | null>(null);
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [add, setAdd] = useState({ date: '', topic: '', place: '충무로', cap: '8' });

  useEffect(() => {
    fetch('/api/biz/data?key=ikneunda').then((r) => r.json()).then((j) => {
      if (j.ok) setSessions(j.data?.sessions || []); else setErr(j.error || '불러오기 실패');
    }).catch((e) => setErr(String(e)));
  }, []);

  const save = async (next: ReadsSession[]) => {
    setBusy(true);
    const prev = sessions;
    setSessions(next);
    try {
      const j = await fetch('/api/biz/data', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'ikneunda', data: { sessions: next } }),
      }).then((r) => r.json());
      if (!j.ok) { alert(j.error || '저장 실패'); setSessions(prev); }
    } catch (e) { alert(String(e)); setSessions(prev); } finally { setBusy(false); }
  };

  const addSession = () => {
    if (!add.date || busy) return;
    const s: ReadsSession = { id: `s${Date.now()}`, date: add.date, topic: add.topic.trim(), place: add.place.trim(), cap: Number(add.cap) || 8, participants: [], status: '모집중', memo: '' };
    save([...(sessions || []), s].sort((a, b) => a.date.localeCompare(b.date)));
    setAdd({ date: '', topic: '', place: add.place, cap: add.cap });
  };
  const patch = (id: string, p: Partial<ReadsSession>) => save((sessions || []).map((s) => s.id === id ? { ...s, ...p } : s));
  const del = (s: ReadsSession) => { if (confirm(`"${s.date} ${s.topic || '회차'}"를 삭제할까요?`)) save((sessions || []).filter((x) => x.id !== s.id)); };

  if (err) return <p className="text-xs text-rose-500">⚠️ {err}</p>;
  if (!sessions) return <p className="text-xs text-slate-400 py-2">회차 불러오는 중…</p>;

  return (
    <SEC title="📖 읽는다 회차 운영" hint="— 신청폼 전이라 참가자는 줄 단위 수기 입력">
      <div className="space-y-1.5">
        {sessions.map((s) => {
          const isOpen = openId === s.id;
          return (
            <div key={s.id} className="border border-slate-100 rounded-lg">
              <button onClick={() => setOpenId(isOpen ? null : s.id)} className="w-full text-left px-3 py-2 flex items-center gap-2">
                <span className="text-[12px] text-slate-400 shrink-0">{s.date}</span>
                <span className="text-[12.5px] font-semibold text-slate-700 flex-1 truncate">{s.topic || '(주제 미정)'}</span>
                <span className="text-[11px] text-slate-400 shrink-0">{s.participants.length}/{s.cap}명</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${s.status === '모집중' ? 'bg-emerald-50 text-emerald-600' : s.status === '마감' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>{s.status}</span>
                <span className="text-[10px] text-slate-300">{isOpen ? '▲' : '▾'}</span>
              </button>
              {isOpen && (
                <div className="border-t border-slate-50 px-3 py-2 space-y-2">
                  <div className="flex gap-2 items-center flex-wrap text-[12px]">
                    <label className="text-slate-400">장소</label>
                    <input defaultValue={s.place} onBlur={(e) => e.target.value !== s.place && patch(s.id, { place: e.target.value })}
                      className="border border-slate-200 rounded px-2 py-1 text-[12px] w-40" />
                    <label className="text-slate-400">상태</label>
                    <select value={s.status} onChange={(e) => patch(s.id, { status: e.target.value })}
                      className="border border-slate-200 rounded px-2 py-1 text-[12px]">
                      {READS_STATUS.map((x) => <option key={x}>{x}</option>)}
                    </select>
                    <button onClick={() => del(s)} className="ml-auto text-[11px] text-slate-300 hover:text-rose-500">삭제</button>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 mb-1">참가자 (한 줄에 한 명)</div>
                    <textarea defaultValue={s.participants.join('\n')} rows={Math.max(2, s.participants.length)}
                      onBlur={(e) => { const v = e.target.value.split('\n').map((x) => x.trim()).filter(Boolean); if (v.join('|') !== s.participants.join('|')) patch(s.id, { participants: v }); }}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-[12px] resize-y" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div className="flex gap-1.5 items-center flex-wrap pt-1">
          <input type="date" value={add.date} onChange={(e) => setAdd({ ...add, date: e.target.value })}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-[12px]" />
          <input placeholder="주제 (책·글감)" value={add.topic} onChange={(e) => setAdd({ ...add, topic: e.target.value })}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-[12px] flex-1 min-w-[120px]" />
          <input placeholder="정원" value={add.cap} onChange={(e) => setAdd({ ...add, cap: e.target.value })}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-[12px] w-14" />
          <button onClick={addSession} disabled={busy || !add.date}
            className="text-[12px] font-bold rounded-lg bg-slate-800 text-white px-3 py-1.5 disabled:opacity-40">+ 회차</button>
        </div>
      </div>
    </SEC>
  );
}

/* ── 자동화청년: 주간 지표 수동 입력 + 관련 과업 현황 ── */
type Weekly = { date: string; followers: number; views: number; posts: number; memo: string };

function AutoBoyOps() {
  const [weekly, setWeekly] = useState<Weekly[] | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [add, setAdd] = useState({ date: '', followers: '', views: '', posts: '', memo: '' });
  const [tasks, setTasks] = useState<{ id: string; task: string; status: string; owner: string }[]>([]);

  useEffect(() => {
    fetch('/api/biz/data?key=autoboy').then((r) => r.json()).then((j) => {
      if (j.ok) setWeekly(j.data?.weekly || []); else setErr(j.error || '불러오기 실패');
    }).catch((e) => setErr(String(e)));
    // 관련 과업 — 프로젝트·과업명에 '자동화청년' 들어간 활성 행 (읽기전용 칩)
    fetch('/api/office').then((r) => r.json()).then((j) => {
      if (!j.ok) return;
      type T = { id: string; project?: string; task?: string; status?: string; owner?: string; ball?: string };
      const o = j.office as { rooms?: { tasks: T[] }[]; 자체?: T[]; 언젠가?: T[] };
      const all: T[] = [...(o.rooms || []).flatMap((r) => r.tasks), ...(o.자체 || []), ...(o.언젠가 || [])];
      setTasks(all
        .filter((t) => `${t.project || ''}${t.task || ''}`.replace(/\s/g, '').includes('자동화청년'))
        .map((t) => ({ id: t.id, task: t.task || t.project || '', status: t.status || '', owner: t.owner || '' })));
    }).catch(() => {});
  }, []);

  const save = async (next: Weekly[]) => {
    setBusy(true);
    const prev = weekly;
    setWeekly(next);
    try {
      const j = await fetch('/api/biz/data', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'autoboy', data: { weekly: next } }),
      }).then((r) => r.json());
      if (!j.ok) { alert(j.error || '저장 실패'); setWeekly(prev); }
    } catch (e) { alert(String(e)); setWeekly(prev); } finally { setBusy(false); }
  };

  const addRow = () => {
    if (!add.date || busy) return;
    const w: Weekly = { date: add.date, followers: Number(add.followers) || 0, views: Number(add.views) || 0, posts: Number(add.posts) || 0, memo: add.memo.trim() };
    save([...(weekly || []).filter((x) => x.date !== w.date), w].sort((a, b) => a.date.localeCompare(b.date)));
    setAdd({ date: '', followers: '', views: '', posts: '', memo: '' });
  };
  const delRow = (w: Weekly) => { if (confirm(`${w.date} 기록을 삭제할까요?`)) save((weekly || []).filter((x) => x.date !== w.date)); };
  const diff = (cur: number, prev?: number) => prev == null ? '' : cur - prev === 0 ? '·' : cur > prev ? `▲${(cur - prev).toLocaleString()}` : `▼${(prev - cur).toLocaleString()}`;

  if (err) return <p className="text-xs text-rose-500">⚠️ {err}</p>;
  if (!weekly) return <p className="text-xs text-slate-400 py-2">지표 불러오는 중…</p>;

  return (
    <div className="space-y-4">
      <SEC title="📣 채널 지표 (주간 수동 기록)" hint="— 인스타·스레드 API 연동 전까지 손으로 적기">
        {weekly.length > 0 && (
          <table className="w-full text-[12px] mb-2">
            <thead><tr className="text-left text-slate-400">
              <th className="py-1 pr-2 font-medium">주</th>
              <th className="py-1 pr-2 font-medium text-right">팔로워</th>
              <th className="py-1 pr-2 font-medium text-right">조회수</th>
              <th className="py-1 pr-2 font-medium text-right">발행</th>
              <th className="py-1 font-medium">메모</th>
              <th className="py-1" />
            </tr></thead>
            <tbody>
              {weekly.map((w, i) => {
                const prev = weekly[i - 1];
                return (
                  <tr key={w.date} className="border-t border-slate-50">
                    <td className="py-1.5 pr-2 text-slate-500 whitespace-nowrap">{w.date}</td>
                    <td className="py-1.5 pr-2 text-right text-slate-700 whitespace-nowrap">{w.followers.toLocaleString()} <span className="text-[10px] text-slate-400">{diff(w.followers, prev?.followers)}</span></td>
                    <td className="py-1.5 pr-2 text-right text-slate-700 whitespace-nowrap">{w.views.toLocaleString()} <span className="text-[10px] text-slate-400">{diff(w.views, prev?.views)}</span></td>
                    <td className="py-1.5 pr-2 text-right text-slate-700">{w.posts}</td>
                    <td className="py-1.5 text-slate-400 truncate max-w-[120px]">{w.memo}</td>
                    <td className="py-1.5 text-right"><button onClick={() => delRow(w)} className="text-[11px] text-slate-300 hover:text-rose-500">✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="flex gap-1.5 items-center flex-wrap">
          <input type="date" value={add.date} onChange={(e) => setAdd({ ...add, date: e.target.value })}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-[12px]" />
          {([['followers', '팔로워'], ['views', '조회수'], ['posts', '발행수']] as const).map(([k, ph]) => (
            <input key={k} type="number" placeholder={ph} value={add[k]} onChange={(e) => setAdd({ ...add, [k]: e.target.value })}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-[12px] w-20" />
          ))}
          <input placeholder="메모" value={add.memo} onChange={(e) => setAdd({ ...add, memo: e.target.value })}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-[12px] flex-1 min-w-[80px]" />
          <button onClick={addRow} disabled={busy || !add.date}
            className="text-[12px] font-bold rounded-lg bg-slate-800 text-white px-3 py-1.5 disabled:opacity-40">+ 기록</button>
        </div>
      </SEC>
      {tasks.length > 0 && (
        <SEC title="🔗 관련 과업" hint="— 과업 시트에서 자동 (수정은 사무실뷰에서)">
          <div className="flex flex-wrap gap-1.5">
            {tasks.map((t) => (
              <span key={t.id} className="text-[11.5px] px-2 py-1 rounded-lg bg-slate-50 border border-slate-100 text-slate-600">
                {t.task}{t.status ? ` · ${t.status}` : ''}{t.owner && t.owner !== '신종호' ? ` · ${t.owner}` : ''}
              </span>
            ))}
          </div>
        </SEC>
      )}
    </div>
  );
}

/* ── 시트 도구 카드: 메모 문서 보기·편집 (사무실뷰 saveMemo와 같은 백엔드) ── */
function ToolMemoPanel({ id, memo }: { id: string; memo: string }) {
  const [val, setVal] = useState(memo);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/office/update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, patch: { 메모: draft } }),
      });
      const j = await r.json().catch(() => ({ ok: r.ok }));
      if (!r.ok || j.ok === false) { alert('저장 실패: ' + (j.error || r.status)); return; }
      setVal(draft); setEditing(false);
    } finally { setBusy(false); }
  };

  return (
    <SEC title="📄 도구 문서" hint="— 첫 줄이 카드 설명이 됩니다 (과업 시트 메모)">
      {editing ? (
        <div className="space-y-2">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={8}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[12.5px] resize-y font-mono" />
          <div className="flex gap-2 justify-end">
            <button onClick={save} disabled={busy} className="text-[12px] font-bold rounded-lg bg-slate-800 text-white px-3 py-1.5 disabled:opacity-40">{busy ? '저장 중…' : '저장'}</button>
            <button onClick={() => setEditing(false)} disabled={busy} className="text-[12px] rounded-lg border border-slate-200 text-slate-500 px-3 py-1.5">취소</button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
          <button onClick={() => { setDraft(val); setEditing(true); }} className="float-right text-[11px] font-bold text-slate-400 hover:text-indigo-600">✏️ 편집</button>
          {val.trim()
            ? <div className="text-[12.5px]">{renderMarkdown(val)}</div>
            : <p className="text-xs text-slate-400 py-1">아직 문서가 비어 있어요 — 어떤 도구인지·어디까지 됐는지·사용법을 적어두면 카드 설명에도 표시됩니다.</p>}
        </div>
      )}
    </SEC>
  );
}
