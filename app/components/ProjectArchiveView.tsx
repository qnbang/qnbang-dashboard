'use client';
// 프로젝트 아카이브 탭 — 월별(계약일 기준) 게시판. 흐름 체크 + 프로젝트별 매출·미수·작업.
// 데이터: /api/archive (매출+과업). 카드 클릭 → 개요·작업·자료 바로가기 펼침.

import { useEffect, useState } from 'react';

type Proj = { name: string; client: string; 분류: '자체' | '대행'; 계약: number; 입금: number; 미수: number; 건: number; 월: string; 작업: string; 상태: string; 링크: string; noRevenue?: boolean };
type Month = { 월: string; label: string; 계약: number; 입금: number; 미수: number; projects: Proj[] };
type Archive = { months: Month[]; 연도흐름: { 월: string; 입금: number; 미수: number }[]; source: string };

// 금액 → 만 단위 축약 (1,210,000 → 121만)
function won(v: number) {
  if (!v) return '-';
  if (v >= 10000) { const m = Math.floor(v / 10000); const t = Math.floor((v % 10000) / 1000); return `${m.toLocaleString()}만${t ? t + '천' : ''}`; }
  return v.toLocaleString();
}

export default function ProjectArchiveView() {
  const [data, setData] = useState<Archive | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<string | null>(null);  // 펼친 카드 key
  const [filter, setFilter] = useState<'all' | '대행' | '자체'>('all');
  const [revForm, setRevForm] = useState<string | null>(null);  // 매출 입력 폼 열린 카드 key
  const [revInput, setRevInput] = useState({ 계약금액: '', 분류: '대행', 입금상태: '입금완료', 계약일: '' });
  const [revBusy, setRevBusy] = useState(false);

  useEffect(() => {
    fetch('/api/archive').then((r) => r.json()).then((j) => {
      if (j.ok) setData(j.archive); else setErr(j.error || '불러오기 실패');
    }).catch((e) => setErr(String(e))).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-400 text-center py-20">불러오는 중…</p>;
  if (err) return <p className="text-red-500 text-center py-20">⚠️ {err}</p>;
  if (!data) return null;

  const flow = data.연도흐름.filter((y) => y.입금 + y.미수 > 0);
  const ymax = Math.max(1, ...flow.map((y) => y.입금 + y.미수));
  const yr = new Date().getFullYear();

  const fmonths = data.months.map((m) => ({
    ...m,
    projects: filter === 'all' ? m.projects : m.projects.filter((p) => p.분류 === filter),
  })).filter((m) => m.projects.length > 0);

  return (
    <div>
      <h2 className="text-lg font-bold text-slate-800 mb-1">📋 프로젝트 아카이브</h2>
      <p className="text-[13px] text-slate-500 mb-4">현재 하는 / 했던 모든 프로젝트를 월별(계약일 기준)로. 카드를 누르면 개요·작업·자료가 펼쳐집니다.</p>

      {/* 올해 월별 흐름 막대 (입금 파랑 + 미수 빨강 누적) */}
      <div className="glass rounded-2xl p-4 mb-2">
        <div className="flex items-end gap-2" style={{ height: 110 }}>
          <div className="text-[12px] font-bold text-slate-500 self-center mr-1 leading-tight">{yr}<br />월별<br />매출</div>
          {flow.map((y) => {
            const ih = Math.round(y.입금 / ymax * 72), dh = Math.round(y.미수 / ymax * 72);
            return (
              <div key={y.월} className="flex-1 flex flex-col justify-end items-center">
                {y.미수 > 0 && <div className="text-[9px] font-bold text-red-500 mb-0.5">미수 {won(y.미수)}</div>}
                <div className="flex flex-col-reverse" style={{ width: '60%' }}>
                  <div style={{ height: ih, background: 'linear-gradient(#6366f1,#a5b4fc)', borderRadius: '0 0 4px 4px' }} title={`입금 ${won(y.입금)}`} />
                  <div style={{ height: dh, background: 'repeating-linear-gradient(45deg,#ef4444,#ef4444 4px,#f87171 4px,#f87171 8px)', borderRadius: '4px 4px 0 0' }} title={`미수 ${won(y.미수)}`} />
                </div>
                <div className="text-[11px] text-slate-500 mt-1">{parseInt(y.월.slice(5, 7))}월</div>
                <div className="text-[10px] text-slate-400">{won(y.입금 + y.미수)}</div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-3 justify-end text-[11px] text-slate-500 mt-2">
          <span><i className="inline-block w-2.5 h-2.5 rounded-sm align-middle mr-1" style={{ background: '#6366f1' }} />입금</span>
          <span><i className="inline-block w-2.5 h-2.5 rounded-sm align-middle mr-1" style={{ background: '#ef4444' }} />미수(아직 안 들어온 돈)</span>
        </div>
      </div>

      {/* 분류 필터 */}
      <div className="flex gap-1.5 mb-4">
        {(['all', '대행', '자체'] as const).map((k) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`text-[12px] font-medium px-3 py-1 rounded-md border transition ${filter === k ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
            {k === 'all' ? '전체' : k === '대행' ? '🤝 대행' : '🏢 자체'}
          </button>
        ))}
      </div>

      {/* 월별 게시판 */}
      {fmonths.map((m) => (
        <section key={m.월} className="mb-6">
          <div className="flex items-baseline gap-2.5 mb-2.5 pb-1.5 border-b-2 border-slate-200">
            <span className="text-base font-extrabold text-slate-800">{m.label}</span>
            <span className="text-[12px] text-slate-500">
              {m.projects.length}개 · 계약 {won(m.계약)}
              {m.미수 > 0 && <span className="text-red-600"> · 미수 {won(m.미수)}</span>}
            </span>
          </div>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))' }}>
            {m.projects.map((p) => {
              const key = m.월 + p.name;
              const isOpen = open === key;
              return (
                <div key={key} onClick={() => setOpen(isOpen ? null : key)}
                  className={`border rounded-md p-3 cursor-pointer transition hover:shadow-md ${p.noRevenue ? 'bg-slate-50 border-dashed border-slate-300' : p.미수 > 0 ? 'bg-white border-l-[3px] border-l-red-500 border-slate-200' : 'bg-white border-slate-200'}`}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded ${p.분류 === '자체' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-600'}`}>
                      {p.분류 === '자체' ? '🏢 자체' : '🤝 대행'}
                    </span>
                    {p.noRevenue
                      ? <span className="text-[11px] text-slate-400 font-medium">💡 매출 미입력</span>
                      : p.미수 > 0
                        ? <span className="text-[14px] font-extrabold"><span className="text-emerald-600">{won(p.입금)}</span><span className="text-slate-400 font-bold">/{won(p.계약)}</span></span>
                        : <span className="text-[14px] font-extrabold text-emerald-600">{won(p.계약)}</span>}
                  </div>
                  <div className="text-[13.5px] font-bold leading-snug mb-1 text-slate-800">{p.name}</div>
                  <div className="text-[11.5px] text-slate-500">
                    {p.client}{p.client ? ' · ' : ''}
                    {p.noRevenue
                      ? <span className="text-slate-400">완수됨 · 매출 미기록</span>
                      : p.미수 > 0 ? <span className="text-red-600 font-semibold">미수 {won(p.미수)}</span> : <span className="text-emerald-600 font-semibold">완납</span>}
                  </div>
                  {isOpen && (
                    <div className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-dashed border-slate-200 leading-relaxed">
                      {p.noRevenue ? (
                        <div onClick={(e) => e.stopPropagation()}>
                          <div className="mb-2 text-slate-500">계약 정보를 입력하면 매출 집계에 포함됩니다.</div>
                          {revForm === key ? (
                            <div className="flex flex-col gap-1.5">
                              <div className="flex gap-1.5">
                                <input type="number" placeholder="계약금액 (원)" value={revInput.계약금액}
                                  onChange={(e) => setRevInput((v) => ({ ...v, 계약금액: e.target.value }))}
                                  className="flex-1 border border-slate-300 rounded px-2 py-1 text-[11px] text-slate-700 min-w-0" />
                                <input type="date" value={revInput.계약일}
                                  onChange={(e) => setRevInput((v) => ({ ...v, 계약일: e.target.value }))}
                                  className="border border-slate-300 rounded px-2 py-1 text-[11px] text-slate-700" />
                              </div>
                              <div className="flex gap-1.5">
                                <select value={revInput.분류} onChange={(e) => setRevInput((v) => ({ ...v, 분류: e.target.value }))}
                                  className="flex-1 border border-slate-300 rounded px-2 py-1 text-[11px] text-slate-700">
                                  <option value="대행">대행</option><option value="자체">자체</option>
                                </select>
                                <select value={revInput.입금상태} onChange={(e) => setRevInput((v) => ({ ...v, 입금상태: e.target.value }))}
                                  className="flex-1 border border-slate-300 rounded px-2 py-1 text-[11px] text-slate-700">
                                  <option value="입금완료">입금완료</option><option value="입금대기">입금대기</option>
                                </select>
                              </div>
                              <div className="flex gap-1.5">
                                <button disabled={revBusy || !revInput.계약금액}
                                  onClick={async () => {
                                    setRevBusy(true);
                                    const amt = Number(revInput.계약금액) || 0;
                                    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
                                    const res = await fetch('/api/office/revenue', {
                                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        계약명: p.name, 클라이언트: p.client, 계약금액: amt, 분류: revInput.분류,
                                        입금상태: revInput.입금상태, 계약일: revInput.계약일 || today,
                                        입금일: revInput.입금상태 === '입금완료' ? today : '',
                                        입금액: revInput.입금상태 === '입금완료' ? amt : 0,
                                        순매출: revInput.입금상태 === '입금완료' ? amt : 0,
                                      }),
                                    }).then((r) => r.json()).catch(() => ({ ok: false }));
                                    setRevBusy(false);
                                    if (res.ok) { setRevForm(null); fetch('/api/archive').then((r) => r.json()).then((j) => { if (j.ok) setData(j.archive); }); }
                                    else alert('저장 실패: ' + (res.error || ''));
                                  }}
                                  className="flex-1 bg-slate-700 text-white text-[11px] rounded py-1 disabled:opacity-50">
                                  {revBusy ? '저장 중…' : '💾 저장'}
                                </button>
                                <button onClick={() => setRevForm(null)} className="px-3 text-[11px] text-slate-400 border border-slate-200 rounded py-1">취소</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => { setRevForm(key); setRevInput({ 계약금액: '', 분류: '대행', 입금상태: '입금완료', 계약일: '' }); }}
                              className="text-[11px] text-blue-600 underline">💡 계약 정보 입력하기</button>
                          )}
                        </div>
                      ) : (
                        <>
                          <div><b className="text-slate-600">개요</b> {p.client || '자체'} · 계약 {won(p.계약)} · {p.건}건{p.상태 ? ` · ${p.상태}` : ''}</div>
                          <div className="mt-1"><b className="text-slate-600">작업</b> {p.작업 ? p.작업.replace(/;/g, ' › ').slice(0, 120) : '— (과업 시트에 작업 기록이 없어요)'}</div>
                          <div className="mt-1">
                            <b className="text-slate-600">자료</b>{' '}
                            {p.링크 ? (
                              p.링크.split(/[\s,]+/).filter(Boolean).map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                  className="inline-block mr-2 text-blue-500 underline hover:text-blue-700"
                                  onClick={(e) => e.stopPropagation()}>
                                  {url.includes('drive.google') ? '📁 드라이브' : url.includes('figma') ? '🎨 피그마' : `🔗 링크${i + 1}`}
                                </a>
                              ))
                            ) : (
                              <span className="text-slate-400">— 과업 시트 메모 칸에 드라이브/피그마 URL 넣으면 연결됩니다</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {fmonths.length === 0 && <p className="text-slate-400 text-center py-10">표시할 프로젝트가 없어요.</p>}
    </div>
  );
}
