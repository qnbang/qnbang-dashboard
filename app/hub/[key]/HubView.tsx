'use client';

// 협업 허브 뷰 — 작업순서 체크리스트는 현황판.md(SSOT)에서 받아 표시(읽기전용),
// 바로가기·코멘트표는 허브 콘텐츠. 문서는 모달(iframe)로 연다.
import { useState, useEffect } from 'react';

export type Item = { state: 'done' | 'wait' | 'todo'; who: string; text: string };
export type Section = { name: string; items: Item[] };
export type Nav = { src: string; title: string; ic: string; t: string; d: string; primary?: boolean };
export type Cfg = { title: string; sub: string; deadline: string; nav: Nav[]; comments: string[][] };

export default function HubView({ cfg, sections, done, total }: { cfg: Cfg; sections: Section[]; done: number; total: number }) {
  const [modal, setModal] = useState<{ src: string; title: string } | null>(null);
  const [dday, setDday] = useState('D-—');

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

  const pct = total ? Math.round((done / total) * 100) : 0;
  const whoCls = (w: string) => (w === '큐앤뱅' ? 'qn' : w === '씨투아' ? 'co' : w === '협의' ? 'both' : '');

  return (
    <div className="wrap">
      <style>{HUB_CSS}</style>
      <div className="brandbar"><img src="/share/qn-logo.png" alt="큐앤뱅" /><span className="role">큐앤뱅(QN!) × 씨투아테크놀러지 협업</span></div>

      <h1>{cfg.title}</h1>
      <p className="sub">{cfg.sub}</p>

      <div className="dday">
        <div className="big">{dday}</div>
        <div className="txt"><b>제출 마감 {cfg.deadline.replace(/-/g, '. ')}</b> (나라장터 입찰 제출과 연동)</div>
      </div>

      <h2>바로가기</h2>
      <div className="nav">
        {cfg.nav.map((n) => (
          <button key={n.src} className={n.primary ? 'primary' : ''} onClick={() => setModal({ src: `/share/${n.src}`, title: n.title })}>
            <div className="ic">{n.ic}</div><div className="t">{n.t}</div><div className="d">{n.d}</div>
          </button>
        ))}
      </div>

      <h2>작업 순서 <small style={{ color: '#999', fontWeight: 400, fontSize: 14 }}>— 현황판과 자동 동기화</small></h2>
      <div className="prog"><i style={{ width: `${pct}%` }} /></div>
      <p className="progtxt">진행률 {pct}% ({done}/{total} 완료)</p>
      <p className="legend">담당: <span className="who qn">큐앤뱅</span> · <span className="who co">씨투아</span> · <span className="who both">협의</span></p>

      {sections.map((s) => (
        <div className="step" key={s.name}>
          <h3>{s.name}</h3>
          <ul className="todo">
            {s.items.map((it, i) => (
              <li key={i} className={it.state === 'done' ? 'checked' : ''}>
                <span className="mark">{it.state === 'done' ? '✅' : it.state === 'wait' ? '⏳' : '⬜'}</span>
                <span>{it.who && <span className={`who ${whoCls(it.who)}`}>{it.who}</span>}{it.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {cfg.comments.length > 0 && (
        <>
          <h2>코멘트별 수정 방법</h2>
          <table>
            <thead><tr><th>코멘트</th><th>어떻게 고칠까</th><th>담당</th></tr></thead>
            <tbody>{cfg.comments.map((r, i) => <tr key={i}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody>
          </table>
        </>
      )}

      <div className="footer"><img src="/share/qn-logo.png" alt="큐앤뱅" /><p className="meta">큐앤뱅(QN!) × 씨투아테크놀러지 · M650 탄광문화축제 프로젝트 관리</p></div>

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
  .wrap { --ink:#1f2328; --muted:#8a8a8a; --accent:#b8430f; --line:#ececec; --done:#1a8a4a;
    max-width:880px; margin:0 auto; padding:0 24px 88px; color:var(--ink);
    font-family:"Apple SD Gothic Neo","Pretendard","Malgun Gothic",sans-serif; line-height:1.7; font-size:16px; }
  .wrap .brandbar { display:flex; align-items:center; justify-content:space-between; padding:26px 0 22px; margin-bottom:24px; border-bottom:1px solid var(--line); }
  .wrap .brandbar img { height:30px; width:auto; display:block; }
  .wrap .role { font-size:12.5px; color:var(--muted); }
  .wrap h1 { font-size:29px; line-height:1.3; letter-spacing:-0.5px; margin:0 0 4px; }
  .wrap .sub { color:var(--muted); font-size:14.5px; margin:0 0 20px; }
  .wrap h2 { font-size:20px; letter-spacing:-0.3px; margin:40px 0 14px; padding-bottom:8px; border-bottom:2px solid var(--ink); }
  .wrap .dday { display:flex; align-items:center; gap:16px; flex-wrap:wrap; background:#1f2328; color:#fff; border-radius:14px; padding:18px 22px; margin-bottom:8px; }
  .wrap .dday .big { font-size:34px; font-weight:800; letter-spacing:-1px; color:#ffd9a8; }
  .wrap .dday .txt { font-size:14px; line-height:1.5; opacity:0.92; } .wrap .dday .txt b { color:#fff; }
  .wrap .nav { display:grid; grid-template-columns:repeat(auto-fill,minmax(168px,1fr)); gap:10px; margin:6px 0 8px; }
  .wrap .nav button { text-align:left; font:inherit; cursor:pointer; border:1px solid var(--line); border-radius:11px; padding:14px 15px; color:var(--ink); background:#fff; transition:.15s; width:100%; }
  .wrap .nav button:hover { border-color:var(--accent); box-shadow:0 3px 12px rgba(0,0,0,.06); transform:translateY(-1px); }
  .wrap .nav .ic { font-size:18px; } .wrap .nav .t { font-weight:700; font-size:15px; margin:5px 0 2px; } .wrap .nav .d { font-size:12px; color:var(--muted); line-height:1.4; }
  .wrap .nav button.primary { background:#b8430f; border-color:#b8430f; color:#fff; } .wrap .nav button.primary .d { color:#ffe3d3; }
  .wrap .step { border:1px solid var(--line); border-radius:13px; padding:16px 18px; margin:12px 0; background:#fff; }
  .wrap .step h3 { margin:0 0 8px; font-size:16.5px; }
  .wrap ul.todo { list-style:none; padding:0; margin:6px 0 0; }
  .wrap ul.todo li { display:flex; align-items:flex-start; gap:9px; padding:6px 0; border-top:1px dashed #eee; font-size:14.5px; }
  .wrap ul.todo li:first-child { border-top:none; }
  .wrap ul.todo .mark { flex:none; }
  .wrap ul.todo li.checked span:last-child { color:#aaa; text-decoration:line-through; }
  .wrap ul.todo li.checked .who { text-decoration:none; }
  .wrap .who { font-weight:700; font-size:11.5px; padding:1px 7px; border-radius:5px; margin-right:6px; white-space:nowrap; display:inline-block; }
  .wrap .who.qn { background:#fdeee7; color:#b8430f; } .wrap .who.co { background:#e7f0fb; color:#0a66c2; } .wrap .who.both { background:#eef4ea; color:#1a8a4a; }
  .wrap .prog { height:7px; background:#eee; border-radius:5px; overflow:hidden; margin:10px 0 2px; }
  .wrap .prog > i { display:block; height:100%; background:var(--done); transition:.3s; }
  .wrap .progtxt { font-size:12px; color:var(--muted); margin:2px 0; }
  .wrap .legend { font-size:12.5px; color:#666; margin:4px 0 0; }
  .wrap table { border-collapse:collapse; width:100%; margin:14px 0; font-size:13.5px; }
  .wrap th,.wrap td { border:1px solid var(--line); padding:8px 10px; text-align:left; vertical-align:top; } .wrap th { background:#f7f7f7; font-weight:700; }
  .wrap .footer { margin-top:54px; padding-top:22px; border-top:1px solid var(--line); display:flex; align-items:center; gap:12px; }
  .wrap .footer img { height:20px; opacity:.85; } .wrap .footer .meta { color:var(--muted); font-size:12.5px; margin:0; }
  .modal { position:fixed; inset:0; background:rgba(20,22,26,.55); display:flex; z-index:50; align-items:center; justify-content:center; padding:24px; }
  .modal .box { background:#fff; border-radius:14px; width:100%; max-width:920px; height:88vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 18px 60px rgba(0,0,0,.3); }
  .modal .bar { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid #ececec; }
  .modal .bar .ti { font-weight:700; font-size:15px; }
  .modal .bar .x { font:inherit; cursor:pointer; border:none; background:#f1f1f1; border-radius:8px; width:32px; height:32px; font-size:18px; line-height:1; color:#555; }
  .modal .bar .x:hover { background:#e3e3e3; }
  .modal iframe { border:0; width:100%; flex:1; }
  @media (max-width:520px){ .wrap{padding:0 16px 64px;} .wrap h1{font-size:23px;} .wrap .dday .big{font-size:28px;} .modal{padding:10px;} .modal .box{height:92vh;} }
`;
