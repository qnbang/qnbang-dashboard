'use client';

// 공간형 사무실 뷰 — "방 = 공이 누구 차례냐". 대행은 방(사장실·작업·로비·아이디어),
// 자체(투자)는 따로. 캐릭터를 마우스로 끌어 방에 놓으면 공위치 변경(포인터 방식 — HTML5 드래그 불안정 회피).
import { useEffect, useState, useCallback, useRef } from 'react';

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
// 방 → 공위치(놓으면 이 공위치로) = "공 차례 넘기기"
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
.ospace .room{position:relative;border:1px solid #ffffff7a;border-radius:22px;padding:12px 14px 16px;min-height:160px;background:#ffffff5c;backdrop-filter:blur(32px) saturate(190%);-webkit-backdrop-filter:blur(32px) saturate(190%);box-shadow:0 12px 38px -12px #2a335548,inset 0 1px 1px #fffffff2,inset 0 0 0 1px #ffffff30,inset 0 -18px 34px -20px #ffffff55,inset 0 16px 30px -22px #ffffff66}
.ospace .room.boss{grid-row:1/3;border-left:3px solid #e3c98f}
.ospace .room.lobby{border-left:3px solid #c9b8f0}
.ospace .room.work{border-left:3px solid #a9cbe8}
.ospace .room.over{outline:2px dashed #3b82f6;outline-offset:-5px;background:#eef6ff}
.ospace .selfbox.over{outline:2px dashed #0ea5e9;outline-offset:-5px}
.ospace .rh{font-size:13.5px;margin-bottom:10px}.ospace .rh b{font-size:14.5px}
.ospace .cnt{background:#eef2f8;border:1px solid #d3dcea;border-radius:999px;padding:1px 8px;font-size:11.5px;color:#475569}
.ospace .hint{color:#94a3b8;font-size:11.5px}
.ospace .floorpeople{display:grid;grid-template-columns:repeat(auto-fill,98px);gap:10px 4px;align-items:end;min-height:60px}
.ospace .ch{width:98px;height:160px;text-align:center;cursor:grab;user-select:none;position:relative;padding-top:24px;display:flex;flex-direction:column;align-items:center;transition:transform .12s;touch-action:none}
.ospace .ch.dragging{opacity:.35}
.ospace .ch:hover{transform:translateY(-4px)}
.ospace .chimg{height:82px;display:flex;align-items:flex-end;justify-content:center}
.ospace .chimg img{max-height:82px;max-width:90px;width:auto;filter:drop-shadow(0 4px 4px #0003);pointer-events:none}
.ospace .ch .nm{font-size:12.5px;font-weight:700;margin-top:2px;height:17px;line-height:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:98px;color:#1e293b}
.ospace .ch .role{font-size:10.5px;color:#64748b;line-height:1.2;height:26px;overflow:hidden;width:98px}
.ospace .ch .ow{font-size:10px;color:#db2777;font-weight:700;height:13px}
.ospace .ch.glow .chimg img{filter:drop-shadow(0 0 8px #ef4444) drop-shadow(0 0 3px #ef4444)}
.ospace .mk{position:absolute;top:0;left:50%;transform:translateX(-50%);font-size:9.5px;font-weight:800;padding:2px 7px;border-radius:7px;white-space:nowrap;z-index:6;border:1px solid #0002}
.ospace .mk.mine{background:var(--mine);color:#fff}.ospace .mk.client{background:var(--client);color:#fff}
.ospace .mk.urgent{background:var(--urgent);color:#fff}
.ospace .mk.run{background:#dbeafe;color:#1d4ed8;border-color:#bfdbfe}.ospace .mk.seed{background:#d1fae5;color:#047857}.ospace .mk.self{background:#e0f2fe;color:#0369a1;border-color:#bae6fd}
.ospace .empty{color:#94a3b8;font-size:12.5px;padding:24px 10px;text-align:center;width:100%}
.ospace .selfbox{margin-top:18px;border:1.5px solid #d8e0ec;border-radius:16px;padding:12px 14px 16px;background:#f4f7fb}
.ospace .later{margin-top:12px;font-size:12px;color:#64748b}
.ospace .file{display:inline-block;background:#fff;border:1px solid #d8e0ec;border-radius:7px;padding:4px 9px;margin:3px 3px 0 0;color:#475569}
.ospace .legend{display:flex;gap:12px;flex-wrap:wrap;margin-top:14px;font-size:11.5px;color:#64748b}
.ospace .legend i{padding:2px 8px;border-radius:6px;font-weight:800;color:#fff}
.ospace .ghost{position:fixed;pointer-events:none;z-index:200;opacity:.9;width:72px;filter:drop-shadow(0 6px 8px #0005)}
`;

export default function OfficeSpaceView() {
  const [office, setOffice] = useState<Office | null>(null);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState<Task | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [over, setOver] = useState('');
  const [toast, setToast] = useState('');
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);

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
  const patchTask = async (t: Task, patch: Record<string, string>) => {
    setBusy(true);
    const r = await fetch('/api/office/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, patch }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!j.ok) { setToast(`⚠️ 이동 실패: ${j.error || '네트워크 오류'}`); setTimeout(() => setToast(''), 4000); return; }
    setToast(`✅ ${t.client || t.project} → ${patch.공위치 || (patch.돈종류 === '투자' ? '자체' : '')}`); setTimeout(() => setToast(''), 2000);
    load();
  };
  const dropOn = (t: Task, zone: string) => {
    if (zone === 'self') {
      if (t.money !== '투자') patchTask(t, { 돈종류: '투자' });   // 대행 → 자체
      return;
    }
    if (ROOM2POS[zone]) {
      const patch: Record<string, string> = { 공위치: ROOM2POS[zone] };
      if (t.money === '투자') patch.돈종류 = '매출';               // 자체 → 대행
      patchTask(t, patch);
    }
  };

  // 포인터 드래그: 누르고 6px 이상 움직이면 드래그, 아니면 클릭(상세). 놓은 지점의 [data-room]으로 이동.
  const onDown = (e: React.PointerEvent, t: Task) => {
    if (e.button !== 0) return;
    downAt.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;
    setDrag(t); setPos({ x: e.clientX, y: e.clientY });
  };
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
      if (downAt.current) {
        const dx = e.clientX - downAt.current.x, dy = e.clientY - downAt.current.y;
        if (Math.hypot(dx, dy) > 6) movedRef.current = true;
      }
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const zone = el?.closest('[data-room]') as HTMLElement | null;
      setOver(zone?.getAttribute('data-room') || '');
    };
    const up = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const zone = (el?.closest('[data-room]') as HTMLElement | null)?.getAttribute('data-room') || '';
      const t = drag;
      setDrag(null); setPos(null); setOver('');
      if (!t) return;
      if (!movedRef.current) { setSel(t); return; }   // 안 움직였으면 클릭 = 상세
      if (zone) dropOn(t, zone);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  if (err) return <p className="text-rose-500 text-center py-10">⚠️ {err}</p>;
  if (!office) return <p className="text-slate-400 text-center py-10">사무실 불러오는 중…</p>;

  const Char = ({ t, self }: { t: Task; self?: boolean }) => {
    const [cls, lab] = self ? ['self', '🏗️ 자체'] : marker(t);
    const dt = ddText(t.dday);
    return (
      <div className={`ch ${t.stale ? 'glow' : ''} ${drag?.id === t.id ? 'dragging' : ''}`}
        onPointerDown={(e) => onDown(e, t)}>
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
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] bg-slate-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg">{toast}</div>}
      <div className="sech">대행(고객 일) — 방 = 공이 누구 차례냐 <span style={{ color: '#94a3b8', fontWeight: 400 }}>· 캐릭터를 끌어 다른 방에 놓으면 공위치 바뀜, 그냥 누르면 상세</span></div>
      <div className="grid">
        {office.rooms.map((r) => (
          <section key={r.key} data-room={r.key} className={`room ${r.key} ${over === r.key && drag ? 'over' : ''}`}>
            <div className="rh"><b>{r.name}</b> <span className="cnt">{r.tasks.length}</span> <span className="hint">{r.hint}</span>
              {over === r.key && drag ? <span className="hint" style={{ color: '#3b82f6', fontWeight: 700 }}> ← 놓으면 «{ROOM2POS[r.key]}»</span> : null}</div>
            <div className="floorpeople">
              {r.tasks.length ? r.tasks.map((t) => <Char key={t.id} t={t} />) : <div className="empty">— 비어있음 —</div>}
            </div>
          </section>
        ))}
      </div>

      <div data-room="self" className={`selfbox ${over === 'self' && drag ? 'over' : ''}`}>
        <div className="sech">🏗️ 자체 사업 (내부·투자) — 같은 캐릭터, 자리만 분리
          {over === 'self' && drag ? <span style={{ color: '#0ea5e9', fontWeight: 700 }}> ← 놓으면 자체로 전환</span> : null}</div>
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

      {/* 끌고 있는 유령 캐릭터 */}
      {drag && pos && (
        <img className="ghost" src={`/office/char${charIdx(drag.id)}.png`} alt=""
          style={{ left: pos.x - 36, top: pos.y - 70 }} />
      )}

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
