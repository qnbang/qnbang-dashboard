'use client';

// 협업 허브 뷰 — 5층 구조: 목표 → 산출물 → 지금 할 일(현황판 SSOT) → 코멘트 → 바로가기.
// 지금 할 일은 현황판.md에서 받아 체크 토글(읽기+토글). 목표·산출물·바로가기·코멘트는 허브 config.
import { useState, useEffect } from 'react';

export type Item = { state: 'done' | 'wait' | 'todo'; who: string; text: string; date?: string };
export type Section = { name: string; items: Item[] };
export type Nav = { src: string; title: string; ic?: string; t: string; d: string; primary?: boolean };
export type Deliverable = { name: string; badge?: string; badgeType?: 'doing' | 'wait' | 'done'; src?: string };
export type NavGroup = { label: string; items: Nav[] };
export type Cfg = {
  title: string; sub: string; deadline: string; nav: Nav[]; comments: string[][];
  role?: string;        // 상단 표기
  footerText?: string;  // 하단 푸터
  ddayLabel?: string;   // D-day 박스 라벨 (기본 '납품 목표')
  ddayNote?: string;
  coLabel?: string;     // 협력사(고객) 담당 이름 — 담당 뱃지 매핑용
  goal?: { title: string; meta?: string };          // ① 이 프로젝트
  deliverables?: Deliverable[];                       // ② 필요 산출물
  navGroups?: NavGroup[];                             // ④ 바로가기 그룹(없으면 nav 단일)
};

export default function HubView({ hubKey, cfg, sections }: { hubKey: string; cfg: Cfg; sections: Section[]; done?: number; total?: number }) {
  const [modal, setModal] = useState<{ src: string; title: string } | null>(null);
  const [dday, setDday] = useState('D-—');
  const [secs, setSecs] = useState<Section[]>(sections);
  const [busy, setBusy] = useState<string | null>(null);

  // 체크박스 토글 — 낙관적 반영 후 서버 저장(현황판.md). 실패 시 롤백, 충돌이면 새로고침.
  async function toggle(si: number, ii: number) {
    if (busy) return;
    const it = secs[si].items[ii];
    const sectionName = secs[si].name;
    const nextState: Item['state'] = it.state === 'done' ? 'todo' : 'done';
    const prev = secs;
    const id = `${si}:${ii}`;
    setBusy(id);
    setSecs((s) => s.map((sec, x) => (x !== si ? sec : { ...sec, items: sec.items.map((item, y) => (y !== ii ? item : { ...item, state: nextState })) })));
    try {
      const r = await fetch('/api/hub-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: hubKey, sectionName, text: it.text }),
      });
      if (!r.ok) {
        setSecs(prev);
        if (r.status === 409) { alert('다른 곳에서 먼저 바뀌었어요. 최신 상태로 새로고침합니다.'); location.reload(); }
        else alert('저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
      }
    } catch {
      setSecs(prev);
      alert('네트워크 오류로 저장하지 못했어요.');
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    const dl = new Date(cfg.deadline + 'T00:00:00'); const t = new Date(); t.setHours(0, 0, 0, 0);
    const diff = Math.round((dl.getTime() - t.getTime()) / 86400000);
    setDday(diff > 0 ? `D-${diff}` : diff === 0 ? 'D-DAY' : `D+${-diff}`);
  }, [cfg.deadline]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModal(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const total = secs.reduce((a, s) => a + s.items.length, 0);
  const done = secs.reduce((a, s) => a + s.items.filter((i) => i.state === 'done').length, 0);
  const pct = total ? Math.round((done / total) * 100) : 0;

  // 현재 단계 = 전체를 통틀어 첫 미완료 항목 (시안의 흰색 강조 대상)
  let nowKey: string | null = null;
  for (let si = 0; si < secs.length && !nowKey; si++)
    for (let ii = 0; ii < secs[si].items.length; ii++)
      if (secs[si].items[ii].state !== 'done') { nowKey = `${si}:${ii}`; break; }

  // 담당 뱃지 색: 큐앤뱅=잉크(qn), 그 외(고객·협력사)=인디고(co), 협의=both
  const whoCls = (w: string) => (w === '큐앤뱅' ? 'qn' : w === '협의' ? 'both' : w ? 'co' : '');
  const resolveSrc = (src: string) => src.startsWith('board:') ? `/board/${src.slice(6)}` : src.startsWith('survey:') ? `/survey/${src.slice(7)}` : `/share/${src}`;
  const openDoc = (src: string, title: string) => setModal({ src: resolveSrc(src), title });

  const groups: NavGroup[] = cfg.navGroups ?? (cfg.nav.length ? [{ label: '', items: cfg.nav }] : []);

  return (
    <div className="wrap">
      <style>{HUB_CSS}</style>

      {/* 헤더 */}
      <div className="hd">
        <div className="hdl">
          <div className="t1">{cfg.role ?? '큐앤뱅(QN!)'}</div>
          <h1>{cfg.title}</h1>
        </div>
        <div className="dday">
          <div className="lab">{cfg.ddayLabel ?? '납품 목표'}</div>
          <div className="d">{dday}</div>
          <div className="dsub">~ {cfg.deadline.slice(5).replace('-', '/')}</div>
        </div>
      </div>
      {total > 0 && (
        <div className="progrow"><span>진행률 <b>{pct}%</b></span><div className="bar"><i style={{ width: `${pct}%` }} /></div><span><b>{done}</b> / {total} 완료</span></div>
      )}

      {/* ① 이 프로젝트 */}
      {cfg.goal && (
        <section>
          <div className="sh"><h2>이 프로젝트</h2><span className="hint">뭘 왜 만드는지</span></div>
          <div className="goal"><div className="g">{cfg.goal.title}</div>{cfg.goal.meta && <div className="m">{cfg.goal.meta}</div>}</div>
        </section>
      )}

      {/* ② 필요 산출물 */}
      {cfg.deliverables && cfg.deliverables.length > 0 && (
        <section>
          <div className="sh"><h2>필요 산출물</h2><span className="hint">완성되면 체크 · 누르면 그 문서로</span></div>
          <div className="deliv">
            {cfg.deliverables.map((d, i) => (
              <div key={i} className="drow" style={{ cursor: d.src ? 'pointer' : 'default' }} onClick={() => d.src && openDoc(d.src, d.name)}>
                <div className="ck" /><div className="nm">{d.name}</div>{d.badge && <span className={`bdg ${d.badgeType || ''}`}>{d.badge}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ③ 지금 할 일 (현황판 SSOT) */}
      {total > 0 && (
        <section>
          <div className="sh"><h2>지금 할 일</h2><span className="hint">현황판과 자동 동기화 · 항목을 누르면 체크</span></div>
          {secs.map((s, si) => (
            <div key={s.name} className="stepgrp">
              {secs.length > 1 && <div className="secname">{s.name}</div>}
              <div className="steps">
                {s.items.map((it, ii) => {
                  const k = `${si}:${ii}`;
                  const isNow = k === nowKey;
                  return (
                    <div key={ii} className={`st${it.state === 'done' ? ' done' : ''}${it.state === 'wait' ? ' wait' : ''}${isNow ? ' now' : ''}${busy === k ? ' busy' : ''}`}
                      role="button" tabIndex={0}
                      onClick={() => toggle(si, ii)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(si, ii); } }}>
                      <span className="mk" /><span className="tx">{it.text}</span>
                      {it.date && <span className="dt">{it.date}</span>}
                      {it.who && <span className={`who ${whoCls(it.who)}`}>{it.who}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ④ 코멘트·피드백 */}
      {cfg.comments.length > 0 && (
        <section>
          <div className="sh"><h2>코멘트·피드백</h2><span className="hint">남긴 말 → 우리 수정 방법</span></div>
          <div className="cmts">
            {cfg.comments.map((r, i) => (
              <div key={i} className="cmt">
                {r[2] && <span className={`who ${whoCls(r[2])}`}>{r[2]}</span>}
                <div className="cbody"><div className="q">{r[0]}</div>{r[1] && <div className="a">→ {r[1]}</div>}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ⑤ 바로가기 */}
      {groups.length > 0 && (
        <section>
          <div className="sh"><h2>바로가기</h2><span className="hint">공통 슬롯으로 고정</span></div>
          {groups.map((g, gi) => (
            <div key={gi} className="navgrp">
              {g.label && <div className="gl">{g.label}</div>}
              <div className={`nav${g.items.length <= 2 ? ' two' : ''}`}>
                {g.items.map((n) => (
                  <button key={n.src} onClick={() => openDoc(n.src, n.title)}>
                    <div className="nt">{n.t}</div><div className="nd">{n.d}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="footer"><img src="/share/qn-logo.png" alt="큐앤뱅" /><p className="meta">{cfg.footerText ?? '큐앤뱅(QN!) 협업 허브'}</p></div>

      {modal && (
        <div className="modal open" onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="box">
            <div className="bar"><span className="ti">{modal.title}</span><button className="x" onClick={() => setModal(null)} aria-label="닫기">×</button></div>
            <iframe src={modal.src} title={modal.title} />
          </div>
        </div>
      )}
    </div>
  );
}

const HUB_CSS = `
  .wrap { --canvas:#fff; --card:#fff; --card-hover:#f7f8fa; --sunken:#eef0f4;
    --ink:#1d2138; --ink-muted:#4a5060; --ink-faint:#9aa0b4; --accent:#4545da; --hairline:#e6e9ee;
    --r:8px; --shadow:0 1px 3px rgba(29,33,56,.08), 0 1px 2px rgba(29,33,56,.05);
    max-width:880px; margin:0 auto; padding:28px 22px 88px; color:var(--ink);
    font-family:"Helvetica Neue",Pretendard,"Apple SD Gothic Neo",sans-serif; line-height:1.6; font-size:16px;
    word-break:keep-all; overflow-wrap:break-word; letter-spacing:-0.01em; }
  .wrap .hd { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid var(--ink); padding-bottom:15px; gap:16px; }
  .wrap .hdl { min-width:0; }
  .wrap .t1 { font-size:12.5px; color:var(--ink-muted); font-weight:500; }
  .wrap h1 { font-size:26px; font-weight:800; line-height:1.25; margin:4px 0 0; letter-spacing:-0.025em; }
  .wrap .dday { flex:none; background:var(--accent); color:#fff; border-radius:var(--r); padding:11px 18px; text-align:center; box-shadow:0 2px 8px rgba(69,69,218,.25); }
  .wrap .dday .lab, .wrap .dday .dsub { font-size:11px; color:rgba(255,255,255,.85); font-weight:500; }
  .wrap .dday .d { font-size:27px; font-weight:800; font-variant-numeric:tabular-nums; line-height:1.1; margin:1px 0; }
  .wrap .progrow { display:flex; align-items:center; gap:11px; margin:16px 0 30px; font-size:12.5px; color:var(--ink-muted); font-weight:500; }
  .wrap .progrow b { color:var(--ink); font-weight:700; }
  .wrap .bar { flex:1; height:7px; background:var(--sunken); border-radius:4px; overflow:hidden; }
  .wrap .bar > i { display:block; height:100%; background:var(--accent); transition:.3s; }
  .wrap section { margin-bottom:30px; }
  .wrap .sh { display:flex; align-items:baseline; gap:9px; margin-bottom:13px; }
  .wrap .sh h2 { font-size:16px; font-weight:800; letter-spacing:-0.02em; margin:0; }
  .wrap .sh .hint { font-size:12px; color:var(--ink-faint); font-weight:500; }
  .wrap .goal { background:var(--card); border:1px solid var(--hairline); border-left:3px solid var(--accent); box-shadow:var(--shadow); border-radius:var(--r); padding:18px 20px; }
  .wrap .goal .g { font-size:16.5px; font-weight:700; line-height:1.55; }
  .wrap .goal .m { font-size:13px; color:var(--ink-muted); line-height:1.65; margin-top:8px; font-weight:500; }
  .wrap .deliv { display:flex; flex-direction:column; gap:7px; }
  .wrap .drow { display:flex; align-items:center; gap:12px; background:var(--card); border:1px solid var(--hairline); box-shadow:var(--shadow); border-radius:var(--r); padding:11px 15px; transition:background .12s, border-color .12s; }
  .wrap .drow:hover { background:var(--card-hover); border-color:var(--accent); }
  .wrap .drow .ck { width:18px; height:18px; border:2px solid var(--ink-faint); border-radius:5px; flex:none; }
  .wrap .drow .nm { font-weight:700; font-size:14.5px; flex:1; line-height:1.4; }
  .wrap .bdg { font-size:11px; padding:3px 10px; border-radius:5px; font-weight:700; white-space:nowrap; background:var(--sunken); color:var(--ink-muted); }
  .wrap .bdg.doing { background:var(--accent); color:#fff; }
  .wrap .stepgrp { margin-bottom:10px; }
  .wrap .secname { font-size:12px; font-weight:700; color:var(--ink-faint); margin:0 0 6px 2px; }
  .wrap .steps { background:var(--sunken); border:1px solid var(--hairline); border-radius:var(--r); padding:6px; display:flex; flex-direction:column; gap:3px; }
  .wrap .st { display:flex; align-items:center; gap:12px; padding:12px 13px; font-size:14.5px; line-height:1.45; border-radius:6px; cursor:pointer; transition:background .12s; }
  .wrap .st:hover { background:rgba(255,255,255,.55); }
  .wrap .st.busy { opacity:.5; pointer-events:none; }
  .wrap .st .mk { width:18px; height:18px; border:2px solid var(--ink-faint); border-radius:4px; flex:none; position:relative; }
  .wrap .st.done .mk { background:var(--ink-faint); border-color:var(--ink-faint); }
  .wrap .st.done .mk::after { content:""; position:absolute; left:4px; top:1px; width:5px; height:9px; border:solid #fff; border-width:0 2px 2px 0; transform:rotate(45deg); }
  .wrap .st.wait .mk { border-style:dashed; }
  .wrap .st .tx { flex:1; font-weight:600; }
  .wrap .st.done .tx { color:var(--ink-faint); font-weight:500; text-decoration:line-through; text-decoration-color:#c8ccd6; }
  .wrap .st.now { background:var(--card); box-shadow:var(--shadow); }
  .wrap .st.now .mk { border-color:var(--accent); border-width:3px; }
  .wrap .st.now .tx { font-weight:800; color:var(--accent); }
  .wrap .st .dt { font-size:11.5px; color:var(--ink-faint); font-variant-numeric:tabular-nums; flex:none; font-weight:600; margin-left:auto; }
  .wrap .st.now .dt { color:var(--accent); }
  .wrap .who { font-size:11px; color:#fff; background:var(--ink); border-radius:4px; padding:2px 8px; flex:none; font-weight:700; white-space:nowrap; margin-left:10px; }
  .wrap .who.co { background:var(--accent); }
  .wrap .who.qn { background:var(--ink); }
  .wrap .who.both { background:#1a8a4a; }
  .wrap .cmts { display:flex; flex-direction:column; gap:8px; }
  .wrap .cmt { display:flex; align-items:flex-start; gap:13px; background:var(--card); border:1px solid var(--hairline); box-shadow:var(--shadow); border-radius:var(--r); padding:14px 16px; }
  .wrap .cmt .who { margin-left:0; margin-top:1px; }
  .wrap .cmt .cbody { flex:1; }
  .wrap .cmt .q { font-size:14px; font-weight:700; line-height:1.5; }
  .wrap .cmt .a { font-size:12.5px; color:var(--ink-muted); line-height:1.55; margin-top:5px; font-weight:500; }
  .wrap .navgrp { margin-bottom:16px; }
  .wrap .navgrp:last-child { margin-bottom:0; }
  .wrap .navgrp .gl { font-size:11.5px; color:var(--ink-faint); font-weight:700; margin-bottom:8px; }
  .wrap .nav { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
  .wrap .nav.two { grid-template-columns:repeat(2,1fr); }
  .wrap .nav button { font:inherit; cursor:pointer; background:var(--card); border:1px solid var(--hairline); box-shadow:var(--shadow); border-radius:var(--r); padding:18px 16px; text-align:center; color:var(--ink); transition:background .12s, border-color .12s; }
  .wrap .nav button:hover { background:var(--card-hover); border-color:var(--accent); }
  .wrap .nav .nt { font-size:15px; font-weight:800; }
  .wrap .nav .nd { font-size:12px; color:var(--ink-muted); margin-top:5px; line-height:1.5; font-weight:500; }
  .wrap .footer { margin-top:48px; padding-top:22px; border-top:1px solid var(--hairline); display:flex; align-items:center; gap:12px; }
  .wrap .footer img { height:20px; opacity:.85; } .wrap .footer .meta { color:var(--ink-faint); font-size:12.5px; margin:0; }
  .modal { position:fixed; inset:0; background:rgba(20,22,26,.55); display:flex; z-index:50; align-items:center; justify-content:center; padding:24px; }
  .modal .box { background:#fff; border-radius:14px; width:100%; max-width:920px; height:88vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 18px 60px rgba(0,0,0,.3); }
  .modal .bar { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid #ececec; }
  .modal .bar .ti { font-weight:700; font-size:15px; }
  .modal .bar .x { font:inherit; cursor:pointer; border:none; background:#f1f1f1; border-radius:8px; width:32px; height:32px; font-size:18px; line-height:1; color:#555; }
  .modal .bar .x:hover { background:#e3e3e3; }
  .modal iframe { border:0; width:100%; flex:1; }
  @media (max-width:560px){ .wrap{ padding:22px 16px 64px; } .wrap .hd{ flex-direction:column; align-items:flex-start; gap:12px; } .wrap h1{ font-size:22px; } .wrap .nav, .wrap .nav.two{ grid-template-columns:repeat(2,1fr); } .modal{ padding:10px; } .modal .box{ height:92vh; } }
`;
