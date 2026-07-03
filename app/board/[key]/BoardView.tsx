'use client';
// 회의 게시판 화면 — 기존 정적 HTML(m650-meeting-board.html)의 모양을 그대로 이식.
// authed=true 면 '회의 추가' 폼과 각 행 삭제(✕)가 뜬다(로그인한 사람만).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BoardEntry } from '@/lib/boards';

// 2026-06-16 → 2026. 06. 16 (그 외 문자열은 그대로)
const fmtDate = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d.replace(/-/g, '. ') : d);

export default function BoardView({ hubKey, project, footer, entries, authed }: {
  hubKey: string; project: string; footer: string; entries: BoardEntry[]; authed: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: '', date: '', desc: '', href: '' });
  // 원본 인덱스(삭제용)를 지닌 채 최신순 정렬
  const rows = entries.map((e, i) => ({ e, i })).sort((a, b) => (b.e.date || '').localeCompare(a.e.date || ''));

  const post = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await fetch('/api/board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: hubKey, ...payload }) });
      const j = await r.json();
      if (!j.ok) { alert(j.error || '실패'); return; }
      if (payload.action === 'add') setForm({ title: '', date: '', desc: '', href: '' });
      router.refresh();
    } catch (e) { alert(String(e)); } finally { setBusy(false); }
  };
  const add = () => { if (!form.title.trim()) { alert('제목을 입력하세요'); return; } post({ action: 'add', entry: form }); };
  const del = (i: number, title: string) => { if (confirm(`"${title}" 회의를 삭제할까요?`)) post({ action: 'delete', index: i }); };

  return (
    <div className="bwrap">
      <style>{CSS}</style>
      <div className="brandbar"><img src="/share/qn-logo.png" alt="큐앤뱅" /><span className="role">회의록</span></div>
      <h1>회의록</h1>
      <p className="sub">{project} 회의 기록입니다. (최신순)</p>

      {authed && (
        <div className="addbox">
          <div className="addrow">
            <input className="tin" placeholder="회의 제목" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input type="date" className="din" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <input className="win" placeholder="한 줄 설명" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
          <input className="win" placeholder="링크 (회의 문서 주소 — 없으면 비움)" value={form.href} onChange={(e) => setForm({ ...form, href: e.target.value })} />
          <button className="addbtn" disabled={busy} onClick={add}>+ 회의 추가</button>
        </div>
      )}

      <div className="board">
        {rows.length === 0 && <p className="empty">아직 회의 기록이 없습니다.{authed ? ' 위에서 추가하세요.' : ''}</p>}
        {rows.map(({ e, i }, n) => (
          <div className="row" key={i}>
            <a className="rowlink" href={e.href || undefined} target={e.href ? '_top' : undefined}>
              <span className="no">{n + 1}</span>
              <span className="body">
                <p className="title">{e.tag && <span className="tag">{e.tag}</span>}{e.title}</p>
                {e.desc && <p className="desc">{e.desc}</p>}
              </span>
              {e.date && <span className="date">{fmtDate(e.date)}</span>}
              <span className="arrow">›</span>
            </a>
            {authed && <button className="del" title="삭제" disabled={busy} onClick={() => del(i, e.title)}>✕</button>}
          </div>
        ))}
      </div>

      {footer && <div className="footer"><img src="/share/qn-logo.png" alt="큐앤뱅" /><p className="meta">{footer}</p></div>}
    </div>
  );
}

const CSS = `
.bwrap { max-width:820px; margin:0 auto; min-height:100vh; background:#fff; padding:0 24px 88px;
  color:#1f2328; font-family:"Apple SD Gothic Neo","Pretendard","Malgun Gothic",sans-serif; line-height:1.7; font-size:16px; }
.bwrap .brandbar { display:flex; align-items:center; justify-content:space-between; padding:26px 0 22px; margin-bottom:18px; border-bottom:1px solid #ececec; }
.bwrap .brandbar img { height:30px; width:auto; display:block; }
.bwrap .brandbar .role { font-size:12.5px; color:#8a8a8a; }
.bwrap h1 { font-size:26px; letter-spacing:-0.5px; margin:0 0 4px; }
.bwrap .sub { color:#8a8a8a; font-size:14px; margin:0 0 22px; }
.bwrap .addbox { background:#faf9f7; border:1px solid #ececec; border-radius:12px; padding:12px; margin:0 0 20px; display:flex; flex-direction:column; gap:8px; }
.bwrap .addrow { display:flex; gap:8px; }
.bwrap .addbox input { font:inherit; font-size:14px; border:1px solid #dcdcdc; border-radius:8px; padding:8px 10px; color:#1f2328; background:#fff; }
.bwrap .addbox .tin { flex:1; } .bwrap .addbox .din { flex:none; width:150px; } .bwrap .addbox .win { width:100%; }
.bwrap .addbtn { align-self:flex-start; font:inherit; font-size:14px; font-weight:700; background:#b8430f; color:#fff; border:none; border-radius:8px; padding:8px 18px; cursor:pointer; }
.bwrap .addbtn:disabled { opacity:.5; }
.bwrap .board { border-top:2px solid #1f2328; }
.bwrap .row { display:flex; align-items:stretch; border-bottom:1px solid #ececec; }
.bwrap .rowlink { flex:1; min-width:0; display:flex; align-items:center; gap:16px; text-decoration:none; color:#1f2328; padding:16px 8px; transition:.15s; }
.bwrap .rowlink:hover { background:#faf9f7; }
.bwrap .row .no { flex:none; width:30px; text-align:center; font-weight:700; color:#8a8a8a; font-size:14px; }
.bwrap .row .body { flex:1; min-width:0; }
.bwrap .row .title { font-weight:700; font-size:16.5px; letter-spacing:-0.2px; margin:0 0 3px; }
.bwrap .row .title .tag { display:inline-block; background:#b8430f; color:#fff; font-size:10.5px; font-weight:700; padding:1px 7px; border-radius:5px; margin-right:7px; vertical-align:2px; }
.bwrap .row .desc { font-size:13.5px; color:#666; margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.bwrap .row .date { flex:none; font-size:13px; color:#8a8a8a; white-space:nowrap; }
.bwrap .row .arrow { flex:none; color:#ccc; font-size:18px; }
.bwrap .rowlink:hover .arrow { color:#b8430f; }
.bwrap .row .del { flex:none; border:none; background:none; color:#c9c9c9; font-size:14px; cursor:pointer; padding:0 10px; }
.bwrap .row .del:hover { color:#d6455f; }
.bwrap .empty { color:#8a8a8a; font-size:14px; padding:22px 8px; }
.bwrap .footer { margin-top:50px; padding-top:22px; border-top:1px solid #ececec; display:flex; gap:12px; align-items:center; }
.bwrap .footer img { height:20px; opacity:.85; } .bwrap .footer .meta { color:#8a8a8a; font-size:12.5px; margin:0; }
@media (max-width:520px){ .bwrap{padding:0 16px 64px;} .bwrap h1{font-size:22px;} .bwrap .row .date{display:none;} .bwrap .addbox .din{width:130px;} }
`;
