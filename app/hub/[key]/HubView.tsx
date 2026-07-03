'use client';

// 협업 허브 뷰 — 작업순서 체크리스트는 현황판.md(SSOT)에서 받아 표시(읽기전용),
// 바로가기·코멘트표는 허브 콘텐츠. 문서는 모달(iframe)로 연다.
import { useState, useEffect } from 'react';

export type Item = { state: 'done' | 'wait' | 'todo'; who: string; text: string };
export type Section = { name: string; items: Item[] };
export type Nav = { src: string; title: string; ic: string; t: string; d: string; primary?: boolean };
export type Cfg = {
  title: string; sub: string; deadline: string; nav: Nav[]; comments: string[][];
  role?: string;        // 상단 브랜드바 협업 표기 (기본: 씨투아)
  footerText?: string;  // 하단 푸터 문구
  ddayLabel?: string;   // D-day 박스 라벨 (기본: '제출 마감' / 행사면 '행사 시작' 등)
  ddayNote?: string;    // D-day 박스 보조 설명 (기본: 나라장터 입찰 연동)
  coLabel?: string;     // 담당 범례의 협력사 이름 (기본: 씨투아 / 사례별 '상인회' 등)
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
  // 담당 색상: 큐앤뱅=qn, 협의=both, 그 외(협력사 이름 무엇이든)=co — 특정 회사명 하드코딩 제거
  const whoCls = (w: string) => (w === '큐앤뱅' ? 'qn' : w === '협의' ? 'both' : w ? 'co' : '');

  return (
    <div className="wrap">
      <style>{HUB_CSS}</style>
      <div className="brandbar"><img src="/share/qn-logo.png" alt="큐앤뱅" /><span className="role">{cfg.role ?? '큐앤뱅(QN!) × 씨투아테크놀러지 협업'}</span></div>

      <h1>{cfg.title}</h1>
      <p className="sub">{cfg.sub}</p>

      <div className="dday">
        <div className="big">{dday}</div>
        <div className="txt"><b>{cfg.ddayLabel ?? '제출 마감'} {cfg.deadline.replace(/-/g, '. ')}</b> {cfg.ddayNote ?? '(나라장터 입찰 제출과 연동)'}</div>
      </div>

      <h2>바로가기</h2>
      <div className="nav">
        {cfg.nav.map((n) => (
          <button key={n.src} className={n.primary ? 'primary' : ''} onClick={() => setModal({ src: `/share/${n.src}`, title: n.title })}>
            <div className="ic">{n.ic}</div><div className="t">{n.t}</div><div className="d">{n.d}</div>
          </button>
        ))}
      </div>

      {total > 0 && (
        <>
          <h2>작업 순서 <small style={{ color: '#999', fontWeight: 400, fontSize: 14 }}>— 현황판과 자동 동기화</small></h2>
          <div className="prog"><i style={{ width: `${pct}%` }} /></div>
          <p className="progtxt">진행률 {pct}% ({done}/{total} 완료)</p>
          <p className="legend">담당: <span className="who qn">큐앤뱅</span> · <span className="who co">{cfg.coLabel ?? '씨투아'}</span> · <span className="who both">협의</span> <span style={{ color: '#aaa' }}>· 항목을 누르면 체크/해제</span></p>

          {secs.map((s, si) => (
            <div className="step" key={s.name}>
              <h3>{s.name}</h3>
              <ul className="todo">
                {s.items.map((it, i) => (
                  <li key={i} className={`${it.state === 'done' ? 'checked' : ''}${busy === `${si}:${i}` ? ' busy' : ''}`}
                    role="button" tabIndex={0}
                    onClick={() => toggle(si, i)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(si, i); } }}>
                    <span className="mark">{it.state === 'done' ? '✅' : it.state === 'wait' ? '⏳' : '⬜'}</span>
                    <span>{it.who && <span className={`who ${whoCls(it.who)}`}>{it.who}</span>}{it.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}

      {cfg.comments.length > 0 && (
        <>
          <h2>코멘트별 수정 방법</h2>
          <table>
            <thead><tr><th>코멘트</th><th>어떻게 고칠까</th><th>담당</th></tr></thead>
            <tbody>{cfg.comments.map((r, i) => <tr key={i}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody>
          </table>
        </>
      )}

      <div className="footer"><img src="/share/qn-logo.png" alt="큐앤뱅" /><p className="meta">{cfg.footerText ?? '큐앤뱅(QN!) × 씨투아테크놀러지 · M650 탄광문화축제 프로젝트 관리'}</p></div>

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
  .wrap ul.todo li { display:flex; align-items:flex-start; gap:9px; padding:6px 6px; border-top:1px dashed #eee; font-size:14.5px; cursor:pointer; border-radius:7px; transition:background .12s; }
  .wrap ul.todo li:hover { background:#faf9f7; }
  .wrap ul.todo li.busy { opacity:.5; pointer-events:none; }
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
