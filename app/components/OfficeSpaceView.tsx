'use client';

// 공간형 사무실 뷰 — "방 = 공이 누구 차례냐". 대행은 방(사장실·작업·로비·아이디어),
// 자체(투자)는 따로. 캐릭터 클릭 → 공위치 변경/완료. 상세는 칸반 토글이 보완.
import { useEffect, useState, useCallback } from 'react';

type Task = {
  id: string; project: string; task: string; owner: string;
  money: string; ball: string; due: string; dday: number | null;
  urgent: boolean; client?: string; status?: string; nextStep?: string;
  staleDays?: number | null; stale?: boolean;
};
type Room = { key: string; name: string; hint: string; tasks: Task[] };
type Office = { rooms: Room[]; 자체?: Task[]; 언젠가?: Task[]; source?: string; syncedAt?: string };

const POS_LABELS = ['시작전', '내작업', '내회신', '고객대기', '보류', '완수'];
const BALL2KO: Record<string, string> = {
  start: '시작전', mywork: '내작업', myreply: '내회신', client: '고객대기', hold: '보류', done: '완수', unset: '',
};
// 방 → 공위치(드롭하면 이 공위치로). 끌어다 놓는 게 곧 "공 차례 넘기기".
const ROOM2POS: Record<string, string> = { boss: '내회신', work: '내작업', lobby: '고객대기', idea: '시작전' };
function charIdx(id: string) { let s = 0; for (const c of id) s += c.charCodeAt(0); return s % 5; }
function marker(t: Task): [string, string] {
  if (t.urgent) return ['urgent', '‼️ 급함'];
  switch (t.ball) {
    case 'myreply': return ['mine', '🙋 내 차례'];
    case 'client': return ['client', '⏳ 고객답'];
    case 'start': return ['seed', '🌱 씨앗'];
    case 'unset': return ['run', '· 미정'];
    default: return ['run', '⚙️ 작업중'];
  }
}
function ddText(d: number | null) { if (d == null) return ''; return d < 0 ? `D+${-d}` : `D-${d}`; }

const CSS = `
.ospace{--mine:#f59e0b;--client:#8b5cf6;--urgent:#ef4444}
.ospace .sech{font-size:12.5px;color:#64748b;margin:0 0 8px;font-weight:700}
.ospace .grid{display:grid;grid-template-columns:0.8fr 1.7fr;grid-template-rows:auto auto;gap:14px}
.ospace .room{position:relative;border:1.5px solid #d8e0ec;border-radius:16px;padding:12px 14px 16px;min-height:160px;background:#fbfcfe;box-shadow:0 1px 3px #0000000a}
.ospace .room.boss{grid-row:1/3;background:#fffbf2;border-color:#f1dcae}
.ospace .room.lobby{background:#faf8ff;border-color:#e6def9}
.ospace .room.work{background:#f6fafe;border-color:#cfe2f3}
.ospace .rh{font-size:13.5px;margin-bottom:10px}.ospace .rh b{font-size:14.5px}
.ospace .cnt{background:#eef2f8;border:1px solid #d3dcea;border-radius:999px;padding:1px 8px;font-size:11.5px;color:#475569}
.ospace .hint{color:#94a3b8;font-size:11.5px}
.ospace .floorpeople{display:grid;grid-template-columns:repeat(auto-fill,98px);gap:10px 4px;align-items:end}
.ospace .ch{width:98px;height:160px;text-align:center;cursor:grab;user-select:none;position:relative;padding-top:24px;display:flex;flex-direction:column;align-items:center;transition:transform .12s}
.ospace .ch:active{cursor:grabbing}
.ospace .ch:hover{transform:translateY(-4px)}
.ospace .chimg{height:82px;display:flex;align-items:flex-end;justify-content:center}
.ospace .chimg img{max-height:82px;max-width:90px;width:auto;filter:drop-shadow(0 4px 4px #0003)}
.ospace .ch .nm{font-size:12.5px;font-weight:700;margin-top:2px;height:17px;line-height:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:98px;color:#1e293b}
.ospace .ch .role{font-size:10.5px;color:#64748b;line-height:1.2;height:26px;overflow:hidden;width:98px}
.ospace .ch .ow{font-size:10px;color:#db2777;font-weight:700;height:13px}
.ospace .ch.glow .chimg img{filter:drop-shadow(0 0 8px #ef4444) drop-shadow(0 0 3px #ef4444)}
.ospace .mk{position:absolute;top:0;left:50%;transform:translateX(-50%);font-size:9.5px;font-weight:800;padding:2px 7px;border-radius:7px;white-space:nowrap;z-index:6;border:1px solid #0002}
.ospace .mk.mine{background:var(--mine);color:#fff}.ospace .mk.client{background:var(--client);color:#fff}
.ospace .mk.urgent{background:var(--urgent);color:#fff;animation:ofl 1s infinite}
.ospace .mk.run{background:#dbeafe;color:#1d4ed8;border-color:#bfdbfe}.ospace .mk.seed{background:#d1fae5;color:#047857}.ospace .mk.self{background:#e0f2fe;color:#0369a1;border-color:#bae6fd}
@keyframes ofl{50%{transform:translateX(-50%) translateY(-3px)}}
.ospace .empty{color:#94a3b8;font-size:12.5px;padding:24px 10px;text-align:center;width:100%}
.ospace .selfbox{margin-top:18px;border:1.5px solid #d8e0ec;border-radius:16px;padding:12px 14px 16px;background:#f4f7fb}
.ospace .later{margin-top:12px;font-size:12px;color:#64748b}
.ospace .file{display:inline-block;background:#fff;border:1px solid #d8e0ec;border-radius:7px;padding:4px 9px;margin:3px 3px 0 0;color:#475569}
.ospace .legend{display:flex;gap:12px;flex-wrap:wrap;margin-top:14px;font-size:11.5px;color:#64748b}
.ospace .legend i{padding:2px 8px;border-radius:6px;font-weight:800;color:#fff}
`;

export default function OfficeSpaceView() {
  const [office, setOffice] = useState<Office | null>(null);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState<Task | null>(null);   // 끌고 있는 과업
  const [over, setOver] = useState('');                   // 드롭 후보 방(하이라이트)

  const load = useCallback(() => {
    fetch('/api/office').then((r) => r.json()).then((j) => {
      if (j.ok) setOffice(j.office); else setErr(j.error || '불러오기 실패');
    }).catch((e) => setErr(String(e)));
  }, []);
  useEffect(() => { load(); }, [load]);

  const changeBall = async (label: string) => {
    if (!sel) return; setBusy(true);
    await fetch('/api/office/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sel.id, patch: { 공위치: label } }) });
    setBusy(false); setSel(null); load();
  };
  const done = async () => {
    if (!sel) return; setBusy(true);
    await fetch('/api/office/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sel.id }) });
    setBusy(false); setSel(null); load();
  };
  // 드래그 드롭: 캐릭터를 방/자체구역에 놓으면 공위치(또는 대행/자체)가 자동 변경.
  const patchTask = async (id: string, patch: Record<string, string>) => {
    setBusy(true);
    await fetch('/api/office/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, patch }) });
    setBusy(false); load();
  };
  const findById = (id: string): Task | null => {
    if (!office || !id) return null;
    for (const r of office.rooms) { const f = r.tasks.find((t) => t.id === id); if (f) return f; }
    return (office.자체 || []).find((t) => t.id === id) || (office.언젠가 || []).find((t) => t.id === id) || null;
  };
  const dropTo = (roomKey: string, dragId: string) => {
    const t = drag || findById(dragId); setOver(''); setDrag(null);
    if (!t) return;
    const patch: Record<string, string> = { 공위치: ROOM2POS[roomKey] };
    if (t.money === '투자') patch.돈종류 = '매출';   // 자체 → 대행 방으로 끌면 대행으로 전환
    patchTask(t.id, patch);
  };
  const dropToSelf = (dragId: string) => {
    const t = drag || findById(dragId); setOver(''); setDrag(null);
    if (!t || t.money === '투자') return;             // 대행 → 자체로 전환
    patchTask(t.id, { 돈종류: '투자' });
  };

  if (err) return <p className="text-rose-500 text-center py-10">⚠️ {err}</p>;
  if (!office) return <p className="text-slate-400 text-center py-10">사무실 불러오는 중…</p>;

  const Char = ({ t, self }: { t: Task; self?: boolean }) => {
    const [cls, lab] = self ? ['self', '🏗️ 자체'] : marker(t);
    const dt = ddText(t.dday);
    return (
      <div className={`ch ${t.stale ? 'glow' : ''}`} onClick={() => setSel(t)}
        draggable
        onDragStart={(e) => { setDrag(t); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.id); }}
        onDragEnd={() => { setDrag(null); setOver(''); }}>
        <div className={`mk ${cls}`}>{lab}</div>
        <div className="chimg"><img src={`/office/char${charIdx(t.id)}.png`} alt="" draggable={false} /></div>
        <div className="nm">{t.client || t.project || ''}</div>
        <div className="role">{t.task}{dt ? ` · ${dt}` : ''}</div>
        <div className="ow">{t.owner && t.owner !== '신종호' ? t.owner : ''}</div>
      </div>
    );
  };

  const 언젠가 = office.언젠가 || [];
  const 자체 = office.자체 || [];

  return (
    <div className="ospace">
      <style>{CSS}</style>
      <div className="sech">대행(고객 일) — 방 = 공이 누구 차례냐</div>
      <div className="grid">
        {office.rooms.map((r) => (
          <section key={r.key} className={`room ${r.key}`}
            onDragEnter={(e) => e.preventDefault()}
            onDragOver={(e) => { e.preventDefault(); setOver((o) => (o === r.key ? o : r.key)); }}
            onDragLeave={() => setOver((o) => (o === r.key ? '' : o))}
            onDrop={(e) => { e.preventDefault(); dropTo(r.key, e.dataTransfer.getData('text/plain')); }}
            style={over === r.key ? { outline: '2px dashed #3b82f6', outlineOffset: '-5px' } : undefined}>
            <div className="rh"><b>{r.name}</b> <span className="cnt">{r.tasks.length}</span> <span className="hint">{r.hint}</span>{over === r.key && drag ? <span className="hint" style={{ color: '#3b82f6', fontWeight: 700 }}> ← 여기로 놓으면 «{ROOM2POS[r.key]}»</span> : null}</div>
            <div className="floorpeople">
              {r.tasks.length ? r.tasks.map((t) => <Char key={t.id} t={t} />) : <div className="empty">— 비어있음 —</div>}
            </div>
          </section>
        ))}
      </div>

      <div className="selfbox"
        onDragEnter={(e) => e.preventDefault()}
        onDragOver={(e) => { e.preventDefault(); setOver((o) => (o === 'self' ? o : 'self')); }}
        onDragLeave={() => setOver((o) => (o === 'self' ? '' : o))}
        onDrop={(e) => { e.preventDefault(); dropToSelf(e.dataTransfer.getData('text/plain')); }}
        style={over === 'self' ? { outline: '2px dashed #0ea5e9', outlineOffset: '-5px' } : undefined}>
        <div className="sech">🏗️ 자체 사업 (내부·투자) — 같은 캐릭터, 자리만 분리{over === 'self' && drag ? <span style={{ color: '#0ea5e9', fontWeight: 700 }}> ← 놓으면 자체로 전환</span> : null}</div>
        <div className="floorpeople">
          {자체.length ? 자체.map((t) => <Char key={t.id} t={t} self />) : <div className="empty">—</div>}
        </div>
        {언젠가.length > 0 && (
          <div className="later">💤 언젠가(보류): {언젠가.map((t) => (
            <span key={t.id} className="file">📁 {t.client || t.project} · {t.task}</span>
          ))}</div>
        )}
      </div>

      <div className="legend">
        <span><i style={{ background: 'var(--mine)' }}>🙋 내 차례</i></span>
        <span><i style={{ background: 'var(--client)' }}>⏳ 고객답</i></span>
        <span><i style={{ background: 'var(--urgent)' }}>‼️ 급함</i></span>
        <span><i style={{ background: '#dbeafe', color: '#1d4ed8' }}>⚙️ 작업중</i></span>
        <span>🔴 글로우=오래 멈춤(노화)</span>
      </div>

      {sel && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setSel(null)}>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 max-w-sm w-[90%]" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-bold">{sel.client || sel.project}</div>
            <div className="text-sm text-slate-700 mt-0.5">{sel.task}</div>
            {sel.status && <div className="text-xs text-slate-400 mt-2">현재상태</div>}
            {sel.status && <div className="text-sm">{sel.status}</div>}
            {sel.nextStep && <div className="text-xs text-slate-400 mt-2">다음할일</div>}
            {sel.nextStep && <div className="text-sm">▸ {sel.nextStep}</div>}
            <div className="text-xs text-slate-400 mt-3">공위치 바꾸기 (공 차례 넘기기)</div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {POS_LABELS.map((p) => (
                <button key={p} disabled={busy} onClick={() => changeBall(p)}
                  className={`text-xs px-2.5 py-1 rounded-md border ${BALL2KO[sel.ball] === p ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}>{p}</button>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button disabled={busy} onClick={done} className="flex-1 text-sm py-2 rounded-lg bg-emerald-500 text-white font-medium">✓ 완료(아카이브)</button>
              <button onClick={() => setSel(null)} className="px-4 text-sm py-2 rounded-lg bg-slate-100 text-slate-600">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
