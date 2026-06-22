'use client';

// 관제탑 보드 — 시안 I 그대로(리퀴드 글라스). 받은일·처리·작업·대기·예정·언젠가·보류 + 제품.
// 시트의 flat 공위치(ball)를 시안 I 칸으로 매핑해 실데이터로 그린다. 카드 클릭=슬라이드 패널.
import { useEffect, useState, useCallback } from 'react';

type Task = {
  id: string; project: string; task: string; owner: string;
  money: string; ball: string; due: string; dday: number | null;
  urgent: boolean; client?: string; status?: string; nextStep?: string;
  todos?: string[]; staleDays?: number | null; stale?: boolean;
};
type Office = { rooms: { tasks: Task[] }[]; 자체?: Task[]; 언젠가?: Task[]; 가동률?: Record<string, number>; 과업수?: number; source?: string; syncedAt?: string };
type Money = { 순매출누계: number; 미수금합: number; 고정비월합: number; 계약건수: number };
const won = (n: number) => `${(n || 0).toLocaleString('ko-KR')}원`;

// 공위치(ball) → 시안 I 칸. 내회신=처리(영업·연락·결재류) / 내작업=작업(제작) / 고객대기=대기 / 시작전=예정(날짜)·언젠가(무날짜) / 보류=보류.
const POS_BTN = ['받은일', '시작전', '내작업', '내회신', '고객대기', '보류', '완수'];
const BALL2KO: Record<string, string> = { inbox: '받은일', start: '시작전', mywork: '내작업', myreply: '내회신', client: '고객대기', hold: '보류', done: '완수' };
const WHO: Record<string, string> = { 신종호: '🧑‍💼 종호', 김지영: '🎨 김지영' };

// 📦 제품 백로그(서비스개발 5종) · 🧪 실험실 — 과업 시트가 아닌 고정 참조(시안 I).
const PRODUCTS = [
  { n: '가격 모니터링', v: 'MVP 배포', next: '다음: 알림 자동화' },
  { n: 'SEO 상품명 작명기', v: 'MVP 배포', next: '다음: 사용성 개선' },
  { n: '네이버 키워드 검색기', v: '배포·인증 추가', next: '다음: 요금제' },
  { n: '크몽 상세페이지 생성기', v: '개발 중', next: '다음: 완성도 마무리' },
  { n: '쇼츠 자동 편집기', v: '개발 중', next: '다음: 자동자막' },
  { n: '매크로 투자 브리핑', v: '자동발행 운영', next: '' },
  { n: 'AI 마케팅팀', v: '콘텐츠 루프', next: '' },
  { n: '가게지기', v: '개발 중', next: '' },
];
// 도구는 과업 보드(공위치)가 아니라 도구 백로그로 — 임시 하드코딩(추후 시트 `분류` 칸으로 대체).
const TOOL_PROJECTS = new Set(['매크로 투자 브리핑', '큐앤뱅 AI마케팅팀']);
const EXPERIMENTS = [
  { n: '풋살 케어·트레이닝', g: '개인 — v1 출시 판정 대기' },
  { n: '생일 커뮤니티', g: '개인 — 할지 말지 미정' },
];

const CSS = `
.qb{--ink:#1a1e30}
.qb .note0{font-size:12px;color:#6b7088;margin:0 0 14px}
.qb .filters{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.qb .chip{font-size:12.5px;font-weight:700;border:1px solid #e0e3ee;background:#ffffffcc;border-radius:999px;padding:6px 14px;cursor:pointer;color:#5a6078;box-shadow:0 1px 2px #0000000a}
.qb .chip:hover{border-color:#c4c8da;color:#2a2f44}
.qb .chip.on{background:#3a3d44;border-color:#3a3d44;color:#fff;box-shadow:0 6px 18px -4px #3a3d4455}
.qb .room{position:relative;border:1px solid #ffffff7a;border-radius:24px;padding:12px 15px 15px;min-height:84px;background:#ffffff5c;backdrop-filter:blur(32px) saturate(190%);-webkit-backdrop-filter:blur(32px) saturate(190%);box-shadow:0 12px 38px -12px #2a335548,inset 0 1px 1px #fffffff2,inset 0 0 0 1px #ffffff30,inset 0 -18px 34px -20px #ffffff55,inset 0 16px 30px -22px #ffffff66}
.qb .room.inbox-room{border-left:3px solid #4b5563}.qb .room.proc{border-left:3px solid #586070}.qb .room.work{border-left:3px solid #6b7280}.qb .room.wait{border-left:3px solid #828a98}.qb .room.todo{border-left:3px solid #9aa1ad}.qb .room.someday{border-left:3px solid #9aa1ad}.qb .room.hold{border-left:3px solid #b8bdc8}.qb .room.product{border-left:3px solid #6b7280}
.qb .rh{font-size:13.5px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:6px;color:var(--ink)}
.qb .rh .cnt{background:#0000000d;border-radius:999px;padding:1px 8px;font-size:11px;color:#475569;font-weight:700}.qb .rh .cnt.red{background:#ef4444;color:#fff}.qb .rh .hint{font-weight:500;color:#9298ac;font-size:11px;margin-left:auto}
.qb .board{display:grid;grid-template-columns:1.05fr 1fr;gap:14px;align-items:start;margin-top:14px}
.qb .board3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;align-items:start;margin-top:14px}
.qb .tkts{display:flex;flex-direction:column;gap:8px}.qb .rowwrap{display:flex;gap:10px;flex-wrap:wrap}
.qb .tkt{display:flex;gap:10px;align-items:center;background:#fff;border:1px solid #e7e9f3;border-radius:13px;padding:9px 12px;cursor:pointer;box-shadow:0 2px 8px -6px #1e225522;transition:box-shadow .12s,transform .12s}
.qb .tkt:hover{box-shadow:0 8px 20px -10px #2a335533;transform:translateY(-1px)}.qb .tkt.sel{border-color:#3a3d44;box-shadow:0 0 0 1px #3a3d4488}
.qb .tkt.urgent{border-left:3px solid #ef4458}
.qb .ic{font-size:17px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:#f1f3fa;border-radius:10px;flex-shrink:0}
.qb .tbody{flex:1;min-width:0}.qb .tag-cli{font-size:10px;font-weight:700;color:#9298ac}
.qb .task{font-size:13.5px;font-weight:700;margin-top:1px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qb .proj-sub{font-size:10.5px;color:#9298ac;margin-top:1px}
.qb .who-bdg{font-size:10px;font-weight:700;color:#5a6078;background:#f1f3fa;border-radius:6px;padding:2px 6px;flex-shrink:0}
.qb .bdg{font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;background:#eef0f7;color:#5a6078;flex-shrink:0}.qb .bdg.soon{background:#fde8eb;color:#e0364a}
.qb .row-item{display:flex;align-items:center;gap:9px;background:#fff;border:1px solid #e7e9f3;border-radius:11px;padding:8px 11px;margin-bottom:6px;cursor:pointer}
.qb .row-item .it{font-size:13px;font-weight:600;color:var(--ink)}.qb .row-item .imeta{font-size:10.5px;color:#9298ac;margin-top:1px}.qb .row-item .ibody{flex:1;min-width:0}
.qb .smalltk{display:flex;gap:7px;align-items:center;background:#fff;border:1px solid #e7e9f3;border-radius:12px;padding:8px 11px;margin-bottom:6px;cursor:pointer;font-size:12px;box-shadow:0 2px 8px -6px #1e225522}
.qb .smalltk:hover{border-color:#c4c8d2}.qb .smalltk .task{font-size:12.5px;white-space:normal}.qb .smalltk .c{font-size:10px;color:#9298ac;font-weight:600;margin-top:1px}
.qb .waitfor{font-size:9.5px;font-weight:800;padding:2px 7px;border-radius:6px;flex-shrink:0;background:#ede5ff;color:#6d4cd0}
.qb .prodcard{flex:1;min-width:200px;background:#fff;border:1px solid #e0e3ee;border-radius:14px;padding:10px 13px;box-shadow:0 4px 14px -8px #2a335522}.qb .prodcard .pn{font-size:13px;font-weight:800;color:var(--ink)}.qb .prodcard .pv{font-size:10.5px;color:#3a3d44;font-weight:700;margin-top:2px}.qb .prodcard .pnext{font-size:10.5px;color:#9298ac;margin-top:4px}
.qb .labcard{flex:1;min-width:200px;background:#fff;border:1px dashed #e0a8e8;border-radius:14px;padding:10px 13px}.qb .labcard .ln{font-size:13px;font-weight:700;color:var(--ink)}.qb .labcard .lg{font-size:10.5px;color:#a04ca0;margin-top:3px}
.qb .divider{display:flex;align-items:center;gap:10px;margin:22px 0 10px;color:#7a8098;font-size:12.5px;font-weight:800}.qb .divider::after{content:"";flex:1;height:1px;background:#dde0ec}
.qb .empty{color:#b0b5c6;font-size:12px;padding:12px;text-align:center;width:100%}
.qb .ovl{position:fixed;inset:0;background:#1e225566;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);z-index:40}
.qb .panel{position:fixed;top:0;right:0;width:400px;max-width:92vw;height:100%;background:#ffffffe8;backdrop-filter:blur(30px) saturate(180%);-webkit-backdrop-filter:blur(30px) saturate(180%);border-left:1px solid #ffffffcc;box-shadow:-14px 0 50px #1e225528;z-index:50;display:flex;flex-direction:column}
.qb .ph{padding:18px 20px 12px;border-bottom:1px solid #eef0f7;position:relative}.qb .pcli{font-size:11.5px;font-weight:700;color:#3a3d44}.qb .pproj{font-size:18px;font-weight:800;margin:3px 0 2px;color:#15182a}.qb .pmeta{font-size:11.5px;color:#6b7088}
.qb .pclose{position:absolute;top:14px;right:16px;border:none;background:#f1f3fa;width:30px;height:30px;border-radius:9px;font-size:16px;cursor:pointer;color:#5a6078}
.qb .statebtns{display:flex;gap:6px;margin-top:12px;flex-wrap:wrap}.qb .statebtns button{font-size:11px;font-weight:700;border:1px solid #e0e3ee;background:#f7f8fc;border-radius:8px;padding:5px 10px;cursor:pointer;color:#5a6078}.qb .statebtns button:hover{background:#fff;border-color:#3a3d44}.qb .statebtns button.cur{background:#3a3d44;color:#fff;border-color:#3a3d44}
.qb .pbody{flex:1;overflow-y:auto;padding:16px 20px}.qb .psec{font-size:12px;font-weight:800;color:#1a1e30;margin:0 0 6px}
.qb .step{display:flex;gap:9px;padding:8px 0;border-bottom:1px dashed #f0f2f8;font-size:13px;color:#23283c}
.qb .note{font-size:11.5px;color:#7a8098;padding:10px;background:#f6f7fb;border-radius:9px;margin-top:6px}
`;

function ddText(d: number | null) { if (d == null) return ''; if (d < 0) return `마감 ${-d}일 지남`; if (d === 0) return '오늘'; return `D-${d}`; }

export default function OfficeBoardView() {
  const [office, setOffice] = useState<Office | null>(null);
  const [money, setMoney] = useState<Money | null>(null);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState<'all' | '회사' | 'jy'>('all');
  const [sel, setSel] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch('/api/office').then((r) => r.json()).then((j) => {
      if (j.ok) { setOffice(j.office); setMoney(j.money); } else setErr(j.error || '불러오기 실패');
    }).catch((e) => setErr(String(e)));
  }, []);
  useEffect(() => { load(); }, [load]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusy(true);
    await fetch('/api/office/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) }).catch(() => null);
    setBusy(false); setSel(null); load();
  };
  const complete = async (id: string) => {
    setBusy(true);
    await fetch('/api/office/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => null);
    setBusy(false); setSel(null); load();
  };

  if (err) return <p className="text-rose-500 text-center py-10">⚠️ {err}</p>;
  if (!office) return <p className="text-slate-400 text-center py-10">관제탑 불러오는 중…</p>;

  const all: Task[] = [
    ...(office.rooms || []).flatMap((r) => r.tasks),
    ...(office.자체 || []),
    ...(office.언젠가 || []),
  ];
  const vis = all.filter((t) => filter === 'all' || filter === '회사' || (filter === 'jy' && t.owner === '김지영'));
  // 도구(판매 도구)는 과업 보드가 아니라 아래 도구 백로그로 빠짐. 나머지는 공위치대로 7칸.
  const board = vis.filter((t) => !TOOL_PROJECTS.has(t.project));
  const inbox = board.filter((t) => t.ball === 'inbox');
  const proc = board.filter((t) => t.ball === 'myreply');
  const work = board.filter((t) => t.ball === 'mywork').sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0));
  const wait = board.filter((t) => t.ball === 'client');
  const todo = board.filter((t) => t.ball === 'start' && t.due);
  const some = board.filter((t) => t.ball === 'start' && !t.due);
  const hold = board.filter((t) => t.ball === 'hold');
  const 가동 = Object.entries(office.가동률 || {}).sort(([, a], [, b]) => b - a).map(([k, v]) => `${k} ${v}`).join(' · ') || '–';

  // 원래 구조: 고객사(위) / 과업(가운데) / 프로젝트명(아래 회색). 단건(과업=프로젝트)·중복은 생략.
  const titleOf = (t: Task) => (t.task && t.task !== '(프로젝트 등록)') ? t.task : t.project;
  const Card = (t: Task) => {
    const title = titleOf(t);
    return (
    <div key={t.id} className={`tkt${t.urgent ? ' urgent' : ''}${sel?.id === t.id ? ' sel' : ''}`} onClick={() => setSel(t)}>
      <div className="ic">{t.ball === 'client' ? '🚪' : t.ball === 'myreply' ? '🧾' : '🖥️'}</div>
      <div className="tbody">
        {t.client && <div className="tag-cli">{t.client}</div>}
        <div className="task">{title}</div>
        {t.project !== title && t.project !== t.client && <div className="proj-sub">{t.project}</div>}
      </div>
      {t.owner && t.owner !== '신종호' && <span className="who-bdg">{WHO[t.owner] || t.owner}</span>}
      {t.due && t.dday != null && <span className={`bdg${t.dday <= 7 ? ' soon' : ''}`}>{ddText(t.dday)}</span>}
    </div>
    );
  };
  const Empty = () => <div className="empty">— 없음 —</div>;

  return (
    <div className="qb">
      <style>{CSS}</style>
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="glass rounded-2xl p-4"><div className="text-xs text-slate-500 mb-1">순매출 누계</div><div className="text-2xl font-bold text-emerald-600">{won(money?.순매출누계 ?? 0)}</div><div className="text-[11px] text-slate-400 mt-1">계약 {money?.계약건수 ?? 0}건</div></div>
        <div className="glass rounded-2xl p-4"><div className="text-xs text-slate-500 mb-1">미수금 ●</div><div className="text-2xl font-bold text-rose-600">{won(money?.미수금합 ?? 0)}</div><div className="text-[11px] text-slate-400 mt-1">계약금액 − 입금액</div></div>
        <div className="glass rounded-2xl p-4"><div className="text-xs text-slate-500 mb-1">월 고정비</div><div className="text-2xl font-bold text-slate-700">{won(money?.고정비월합 ?? 0)}</div><div className="text-[11px] text-slate-400 mt-1">매달 나가는 돈</div></div>
        <div className="glass rounded-2xl p-4"><div className="text-xs text-slate-500 mb-1">가동률 (담당 과업)</div><div className="text-xl font-bold text-slate-800">{가동}</div><div className="text-[11px] text-slate-400 mt-1">진행 중 과업 {office.과업수 ?? 0}개</div></div>
      </section>
      <p className="note0">실시간 업무 현황 — 받은일 · 처리 · 작업 · 대기 · 예정 · 언젠가 · 제품 {office.source === 'sheet' ? `· ✓ ${office.syncedAt} 기준` : office.source === 'seed' ? '· ⚠️ 미리보기 시드' : ''}</p>
      <div className="filters">
        {([['all', '전체'], ['회사', '🏢 큐앤뱅'], ['jy', '🎨 김지영']] as const).map(([k, lb]) => (
          <div key={k} className={`chip${filter === k ? ' on' : ''}`} onClick={() => setFilter(k)}>{lb}</div>
        ))}
      </div>

      <section className="room inbox-room"><div className="rh">📥 받은 일 <span className={`cnt${inbox.length ? ' red' : ''}`}>{inbox.length}</span><span className="hint">라크·메일·DM에서 들어온 미분류</span></div>
        <div className="rowwrap">{inbox.length ? inbox.map(Card) : <div className="empty">📭 받은 일 비움</div>}</div></section>

      <div className="board">
        <section className="room proc"><div className="rh">🧾 처리 <span className="cnt">{proc.length}</span><span className="hint">영업·연락·결재·발행</span></div>
          <div className="tkts">{proc.length ? proc.map(Card) : <Empty />}</div></section>
        <section className="room work"><div className="rh">🖥️ 작업 <span className="cnt">{work.length}</span><span className="hint">제작·디자인</span></div>
          <div className="tkts">{work.length ? work.map(Card) : <Empty />}</div></section>
      </div>

      <section className="room wait" style={{ marginTop: 14 }}><div className="rh">🚪 대기 <span className="cnt">{wait.length}</span><span className="hint">상대 답·결과 기다림</span></div>
        <div className="rowwrap">{wait.length ? wait.map((t) => (
          <div key={t.id} className={`tkt${sel?.id === t.id ? ' sel' : ''}`} style={{ width: 300 }} onClick={() => setSel(t)}>
            <div className="ic">🚪</div><div className="tbody">{t.client && t.client !== t.project && <div className="tag-cli">{t.client}</div>}<div className="task">{t.project}</div><div className="proj-sub">⏳ {t.status || t.task}</div></div>
            <span className="waitfor">🟣 고객</span></div>
        )) : <Empty />}</div></section>

      <div className="board3">
        <section className="room todo"><div className="rh">📅 예정 <span className="cnt">{todo.length}</span><span className="hint">날짜 있음</span></div>
          {todo.length ? todo.map((t) => <div key={t.id} className="smalltk" onClick={() => setSel(t)}><span>📅</span><div><div className="task">{t.project}</div><div className="c">{ddText(t.dday)} · {t.task}</div></div></div>) : <Empty />}</section>
        <section className="room someday"><div className="rh">💭 언젠가 <span className="cnt">{some.length}</span><span className="hint">날짜 없음</span></div>
          {some.length ? some.map((t) => <div key={t.id} className="smalltk" onClick={() => setSel(t)}><span>💭</span><div><div className="task">{t.project}</div><div className="c">{t.client || '날짜 없음'}</div></div></div>) : <Empty />}</section>
        <section className="room hold"><div className="rh">⏸️ 보류 <span className="cnt">{hold.length}</span><span className="hint">멈춤</span></div>
          {hold.length ? hold.map((t) => <div key={t.id} className="smalltk" onClick={() => setSel(t)}><span>⏸️</span><div><div className="task">{t.project}</div><div className="c">{t.status || t.task}</div></div></div>) : <Empty />}</section>
      </div>

      {filter !== 'jy' && (<>
        <div className="divider">📦 제품 백로그 — 자체 제품 (마감 없는 지속 개선)</div>
        <section className="room product"><div className="rowwrap">{PRODUCTS.map((p) => (
          <div key={p.n} className="prodcard"><div className="pn">{p.n}</div><div className="pv">{p.v}</div><div className="pnext">{p.next}</div></div>
        ))}</div></section>
      </>)}

      {filter === 'all' && (<>
        <div className="divider">🧪 실험실 — 개인·미공식 (공식화 게이트)</div>
        <section className="room product"><div className="rowwrap">{EXPERIMENTS.map((x) => (
          <div key={x.n} className="labcard"><div className="ln">🧪 {x.n}</div><div className="lg">{x.g}</div></div>
        ))}</div></section>
      </>)}

      {sel && (<>
        <div className="ovl" onClick={() => setSel(null)} />
        <aside className="panel">
          <div className="ph"><button className="pclose" onClick={() => setSel(null)}>✕</button>
            <div className="pcli">{sel.client || sel.project}</div><div className="pproj">{sel.task}</div>
            <div className="pmeta">{sel.project} · {WHO[sel.owner] || sel.owner}{sel.due && sel.dday != null ? ` · ${ddText(sel.dday)}` : ''}</div>
            <div className="statebtns">{POS_BTN.map((p) => (
              <button key={p} className={BALL2KO[sel.ball] === p ? 'cur' : ''} disabled={busy} onClick={() => p === '완수' ? complete(sel.id) : patch(sel.id, { patch: { 공위치: p } })}>{p}</button>
            ))}</div>
            <div className="statebtns"><button disabled={busy} onClick={() => patch(sel.id, { patch: { 담당자: sel.owner === '김지영' ? '신종호' : '김지영' } })}>담당 → {sel.owner === '김지영' ? '종호' : '지영'}</button></div>
          </div>
          <div className="pbody">
            {sel.status && (<><div className="psec">📍 현재 상황</div><div className="step">{sel.status}</div></>)}
            {sel.nextStep && (<><div className="psec" style={{ marginTop: 16 }}>▸ 다음 할 일</div><div className="step">{sel.nextStep}</div></>)}
            <div className="psec" style={{ marginTop: 16 }}>🧭 할일</div>
            {sel.todos && sel.todos.length ? sel.todos.map((td, i) => <div key={i} className="step">☐ {td}</div>) : <div className="note">할일 미입력. 라크 과업방에서 추가.</div>}
            <div className="psec" style={{ marginTop: 16 }}>🕘 이력</div>
            <div className="note">과업별 이력 저장소는 다음 단계. 지금은 갱신일·현재상태로 대체.</div>
          </div>
        </aside>
      </>)}
    </div>
  );
}
