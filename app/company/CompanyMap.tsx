'use client';
// 회사지도 본체 — 시안(회사지도/시안틀.html)을 Tailwind로 포팅. 색: 인디고 #4545da(밴드) · 라임 #cbfe03(미수 숫자만) ·
// 시그널 #ff5e30(마감지남·미수만). 완료·폐기 항목은 흐리게. 항상 다크(보스룩 — 전역 라이트 glass 배경과 분리).

import { useEffect, useState } from 'react';
import type { CompanyMapData, MapNode, Branch } from '@/lib/companyMap';
import ProjectDocs from '../components/ProjectDocs';

const 원 = (n?: number) => (n ? n.toLocaleString('ko-KR') : '0');
const DONE_STATUS = new Set(['완료', '폐기', '중단']);

type Popover = { node: MapNode; branchKey: string; branchTitle: string; x: number; y: number };

function chip(n: MapNode, today: string): { text: string; cls: string } | null {
  if (!n.done && n.마감 && n.마감 < today) return { text: '마감 지남', cls: 'signal' };
  if (n.상태 === '진행 중') return { text: '진행 중', cls: 'run' };
  if (n.상태) return { text: n.상태, cls: 'plain' };
  return null;
}

const CHIP_CLS: Record<string, string> = {
  run: 'text-[#7b7bf5] bg-transparent border border-[#7b7bf5]',
  signal: 'text-[#ff5e30] bg-transparent border border-[#ff5e30]',
  plain: 'text-[#adaeb3] bg-white/5',
};

function NodeMoney({ n }: { n: MapNode }) {
  if (n.계약 === undefined) return null;
  if (n.장부매칭안됨) {
    return (
      <div className="text-[12px] font-medium text-[#ff5e30] mt-0.5">
        계약 {원(n.계약)} · <span className="font-semibold">장부 매칭 안 됨</span>
      </div>
    );
  }
  return (
    <div className="text-[13px] font-medium text-[#adaeb3] tabular-nums mt-0.5">
      계약 {원(n.계약)} · 입금 {원(n.입금)}
      {(n.미수 || 0) > 0 && <span className="text-[#ff5e30]"> · 미수 {원(n.미수)}</span>}
      {typeof n.카드입금 === 'number' && n.카드입금 !== n.입금 && (
        <span className="text-[11px] text-[#6d6e73]"> (카드값 {원(n.카드입금)})</span>
      )}
    </div>
  );
}

function InboxList({ nodes, money, onPick }: { nodes: MapNode[]; money?: boolean; onPick: (n: MapNode, e: React.MouseEvent) => void }) {
  if (!nodes.length) return <li className="text-[13px] text-[#6d6e73] px-2 py-1">없음</li>;
  return (
    <>
      {nodes.map((n) => (
        <li key={n.key} onClick={(e) => onPick(n, e)}
          className="relative pl-4 py-1.5 rounded-lg cursor-pointer hover:bg-white/5 transition">
          <span className="text-[14px] font-semibold">{n.이름}</span>
          {n.제안 && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#cbfe03] text-[#1d2138] align-middle">🤖 제안</span>}
          {money && <NodeMoney n={n} />}
          {(n.담당 || n.마감) && (
            <div className="text-[12px] text-[#6d6e73] mt-0.5">
              {[n.담당, n.마감 && `마감 ${n.마감}`].filter(Boolean).join(' · ')}
            </div>
          )}
        </li>
      ))}
    </>
  );
}

export default function CompanyMap({ data }: { data: CompanyMapData }) {
  const [branches, setBranches] = useState<Branch[]>(data.branches);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [pop, setPop] = useState<Popover | null>(null);
  const [busy, setBusy] = useState(false);
  const [docName, setDocName] = useState<string | null>(null);
  const [openBranch, setOpenBranch] = useState<Record<string, boolean>>(
    Object.fromEntries(data.branches.map((b) => [b.key, !b.collapsedDefault]))
  );

  useEffect(() => {
    fetch('/api/company/cleanup').then((r) => r.json()).then((j) => {
      if (j.ok) setFlagged(new Set((j.queue as { key: string }[]).map((q) => q.key)));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!pop) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('#company-pop')) setPop(null);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [pop]);

  const openPop = (branchKey: string, branchTitle: string) => (n: MapNode, e: React.MouseEvent) => {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(r.left, window.innerWidth - 300);
    const y = Math.min(r.bottom + 6, window.innerHeight - 260);
    setPop({ node: n, branchKey, branchTitle, x, y });
  };
  const inboxPop = (label: string) => (n: MapNode, e: React.MouseEvent) => {
    const owner = branches.find((b) => b.nodes.some((x) => x.key === n.key));
    openPop(owner?.key || 'inbox', owner?.title || label)(n, e);
  };

  const setStatus = async (value: string) => {
    if (!pop || !pop.node.repo || !pop.node.editable) return;
    setBusy(true);
    const { node, branchKey } = pop;
    setBranches((bs) => bs.map((b) => b.key !== branchKey ? b : {
      ...b, nodes: b.nodes.map((n) => n.key === node.key ? { ...n, 상태: value, done: DONE_STATUS.has(value) } : n),
    }));
    setPop({ ...pop, node: { ...pop.node, 상태: value, done: DONE_STATUS.has(value) } });
    try {
      const res = await fetch(`/api/git-projects/${node.repo}/meta`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: 'progressStatus', value }),
      }).then((r) => r.json());
      if (!res.ok) alert('저장 실패: ' + (res.error || ''));
    } catch (e) { alert('저장 실패: ' + String(e)); }
    setBusy(false);
  };

  const toggleFlag = async () => {
    if (!pop) return;
    setBusy(true);
    try {
      const res = await fetch('/api/company/cleanup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: pop.node.key, 이름: pop.node.이름, 위치: pop.branchTitle }),
      }).then((r) => r.json());
      if (res.ok) {
        setFlagged((f) => { const n = new Set(f); if (res.flagged) n.add(pop.node.key); else n.delete(pop.node.key); return n; });
      } else alert('저장 실패: ' + (res.error || ''));
    } catch (e) { alert('저장 실패: ' + String(e)); }
    setBusy(false);
  };

  const 산것끝난것 = (nodes: MapNode[]) => ({
    산것: nodes.filter((n) => !n.done),
    끝난것: nodes.filter((n) => n.done),
  });

  const bandMisu = data.돈.미수;

  return (
    <div className="min-h-screen bg-[#0b0b12] text-[#f2f4ff]" style={{ fontFamily: '"Helvetica Neue", Pretendard, "Pretendard Variable", system-ui, sans-serif', letterSpacing: '-0.02em', wordBreak: 'keep-all' }}>
      <div className="max-w-[1280px] mx-auto px-6 pt-12 pb-24">
        {/* 꼭대기 */}
        <div className="max-w-[640px] mx-auto text-center">
          <h1 className="text-[28px] font-bold">큐앤뱅</h1>
          <p className="text-[13px] font-medium text-[#6d6e73] mt-1">
            생성 {data.생성} · 대행 {data.대행수} · 제품 {data.제품수} · 브랜드 {data.브랜드수} · 데이터: 등록카드 자동집계
          </p>
        </div>

        {/* AI 제안 */}
        {data.제안 && data.제안.종합?.length > 0 && (
          <section className="mt-10">
            <h2 className="text-[15px] font-semibold text-[#cbfe03] mb-2">🤖 제안</h2>
            <div className="bg-white/[0.04] rounded-2xl p-4 space-y-1.5">
              {data.제안.종합.map((s, i) => (
                <p key={i} className="text-[13px] text-[#c8cad6] leading-relaxed">· {s}</p>
              ))}
            </div>
          </section>
        )}

        {/* 이번 주 챙길 것 */}
        <section className="mt-10">
          <h2 className="text-[20px] font-semibold mb-4">이번 주 챙길 것</h2>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
            <div className="bg-white/[0.04] rounded-2xl p-4">
              <h3 className="text-[14px] font-semibold text-[#adaeb3] mb-1.5">결정·회신 대기</h3>
              <ul className="ml-0">
                <InboxList nodes={data.이번주.대기} onPick={inboxPop('결정·회신 대기')} />
              </ul>
            </div>
            <div className="bg-white/[0.04] rounded-2xl p-4">
              <h3 className="text-[14px] font-semibold text-[#adaeb3] mb-1.5">마감 임박·지남 (7일)</h3>
              <ul>
                <InboxList nodes={data.이번주.마감} onPick={inboxPop('마감 임박·지남')} />
              </ul>
            </div>
            <div className="bg-white/[0.04] rounded-2xl p-4">
              <h3 className="text-[14px] font-semibold text-[#adaeb3] mb-1.5">미수 청구</h3>
              <ul>
                <InboxList nodes={data.이번주.미수} money onPick={inboxPop('미수 청구')} />
              </ul>
            </div>
          </div>
        </section>

        {/* 돈 */}
        <section className="mt-14">
          <h2 className="text-[20px] font-semibold mb-4">돈</h2>
          <div className="bg-[#4545da] text-white rounded-2xl p-5 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-[clamp(22px,2.6vw,32px)] font-bold tabular-nums">{원(data.돈.계약)}원</div>
              <div className="text-[13px] font-medium opacity-85 mt-0.5">계약 합계 (대행·카드)</div>
            </div>
            <div>
              <div className="text-[clamp(22px,2.6vw,32px)] font-bold tabular-nums">{원(data.돈.입금)}원</div>
              <div className="text-[13px] font-medium opacity-85 mt-0.5">입금 합계 (매출 시트)</div>
            </div>
            <div>
              <div className="text-[clamp(22px,2.6vw,32px)] font-bold tabular-nums text-[#cbfe03]">{원(bandMisu)}원</div>
              <div className="text-[13px] font-medium opacity-85 mt-0.5">미수금</div>
            </div>
          </div>
          <p className="text-[12px] text-[#6d6e73] mt-2">계약은 각 프로젝트 카드, 입금·미수는 매출 시트(통장 원장) 기준 — 두 값이 다르면 시트가 정답입니다.</p>
        </section>

        {/* 회사 지도 */}
        <section className="mt-14">
          <h2 className="text-[20px] font-semibold mb-4">회사 지도</h2>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(224px,1fr))' }}>
            {branches.map((b) => {
              const { 산것, 끝난것 } = 산것끝난것(b.nodes);
              return (
                <details key={b.key} open={openBranch[b.key]} className="min-w-0">
                  <summary
                    onClick={(e) => { e.preventDefault(); setOpenBranch((s) => ({ ...s, [b.key]: !s[b.key] })); }}
                    className="list-none cursor-pointer bg-white/[0.04] rounded-xl px-4 py-3 flex items-baseline gap-2 hover:bg-white/[0.07] transition">
                    <span className="text-[12px] text-[#6d6e73] transition-transform" style={{ transform: openBranch[b.key] ? 'rotate(90deg)' : 'none' }}>▶</span>
                    <h3 className="text-[16px] font-semibold">{b.title}</h3>
                    <span className="text-[13px] text-[#adaeb3] tabular-nums ml-auto">{산것.length}건</span>
                  </summary>
                  {openBranch[b.key] && (
                    <ul className="mt-2 ml-3.5 border-l border-white/10 pl-0">
                      {산것.map((n) => (
                        <li key={n.key} onClick={(e) => openPop(b.key, b.title)(n, e)}
                          className="relative pl-4 py-2 rounded-lg cursor-pointer hover:bg-white/5 transition">
                          <span className="text-[15px] font-semibold">{n.이름}</span>
                          {(() => { const c = chip(n, data.생성); return c ? <span className={`ml-1.5 text-[11px] font-semibold tracking-wide rounded-full px-2 py-0.5 align-middle ${CHIP_CLS[c.cls]}`}>{c.text}</span> : null; })()}
                          {flagged.has(n.key) && <span className="ml-1.5 text-[11px] font-semibold rounded-full px-2 py-0.5 align-middle bg-[#cbfe03] text-[#1d2138]">정리</span>}
                          {n.제안 && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#cbfe03]/30 text-[#cbfe03] align-middle" title={n.제안}>🤖</span>}
                          {b.moneyVisible && <NodeMoney n={n} />}
                          {(n.owner || n.담당 || n.마감) && (
                            <div className="text-[12px] text-[#6d6e73] mt-0.5">{[n.담당, n.마감 && `마감 ${n.마감}`].filter(Boolean).join(' · ')}</div>
                          )}
                        </li>
                      ))}
                      {끝난것.length > 0 && (
                        <details className="ml-3.5 mt-1">
                          <summary className="text-[13px] text-[#6d6e73] cursor-pointer py-1 hover:text-[#adaeb3]">완료·폐기 {끝난것.length}건</summary>
                          <ul className="ml-3.5 border-l border-white/10">
                            {끝난것.map((n) => (
                              <li key={n.key} onClick={(e) => openPop(b.key, b.title)(n, e)} className="opacity-50 relative pl-4 py-2 rounded-lg cursor-pointer hover:bg-white/5 hover:opacity-70 transition">
                                <span className="text-[15px] font-semibold">{n.이름}</span>
                                {b.moneyVisible && <NodeMoney n={n} />}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </ul>
                  )}
                </details>
              );
            })}
          </div>
        </section>
      </div>

      {/* 노드 팝오버 */}
      {pop && (
        <div id="company-pop" className="fixed z-50 bg-[#15161f] border border-white/15 rounded-xl shadow-2xl p-4 w-[264px]"
          style={{ left: pop.x, top: pop.y }}>
          <h4 className="text-[15px] font-semibold mb-2.5">{pop.node.이름}</h4>
          {pop.node.제안 && <p className="text-[12px] text-[#cbfe03] mb-2.5 leading-relaxed">🤖 {pop.node.제안}</p>}
          {pop.node.editable && pop.node.repo && (
            <>
              <label className="text-[12px] font-semibold text-[#adaeb3] block mb-1">진행상태 변경</label>
              <select disabled={busy} value={pop.node.상태 || ''} onChange={(e) => setStatus(e.target.value)}
                className="w-full h-10 border border-white/15 rounded-lg bg-white/5 text-white text-[14px] px-2 mb-2.5">
                <option value="">(미정)</option>
                <option>시작 전</option><option>진행 중</option><option>피드백 대기</option>
                <option>보류</option><option>완료</option><option>중단</option><option>폐기</option>
              </select>
            </>
          )}
          <button disabled={busy} onClick={toggleFlag}
            className="w-full h-10 border border-white/30 rounded-xl bg-transparent text-white text-[14px] font-semibold hover:bg-white/10 transition">
            {flagged.has(pop.node.key) ? '정리표시 해제' : '정리표시 달기'}
          </button>
          {pop.node.repo && (
            <button onClick={() => { setDocName(pop.node.이름); setPop(null); }}
              className="w-full h-10 mt-2 border border-white/15 rounded-xl bg-transparent text-[#adaeb3] text-[13px] hover:bg-white/5 transition">
              작업로그 보기
            </button>
          )}
          {!pop.node.editable && pop.node.repo && (
            <p className="text-[11px] text-[#6d6e73] mt-2 leading-relaxed">다른 조직 소유 저장소 — 진행상태는 여기서 못 바꿔요(읽기 전용).</p>
          )}
        </div>
      )}

      {docName && <ProjectDocs name={docName} onClose={() => setDocName(null)} />}
    </div>
  );
}
