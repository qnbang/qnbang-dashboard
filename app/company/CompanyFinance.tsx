'use client';
// 회장 금고 — /company 안의 재무 운영 섹션 (예산·통장 업로드·잔고·상여 확정).
// 데이터는 /api/office(budget·money 재사용), 통장 파일·잔고 수정은 /api/company/bank.
// 다크 보스룩(CompanyMap과 동일 팔레트): 인디고 #4545da · 라임 #cbfe03 · 시그널 #ff5e30.

import { useEffect, useRef, useState } from 'react';

const 원 = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;

type Budget = {
  기준월: string; 전월: string; 재원: number; 부가세적립: number; 기본급: number; 고정비: number; 세금적립: number;
  여유: number; 등급: '적자' | '빠듯' | '보통' | '좋음';
  상여권장: number; 비상금적립: number; 저축: number; 써도되는돈: number;
  이미쓴돈: number; 남은한도: number; 비상금인출: number; 비상금잔액: number; 비상금목표: number;
  전월지출: number; 코멘트: string[];
};
type Money = {
  미수금합: number;
  인건비목록?: { 실지급: number; 지급상태: string }[];
  잔고?: { 통장잔고: number; 세이프박스: number; 보유현금: number; 업데이트: string };
};

export default function CompanyFinance() {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [money, setMoney] = useState<Money | null>(null);
  const [loading, setLoading] = useState(true);
  const [upMsg, setUpMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = (fresh = false) =>
    fetch(`/api/office${fresh ? '?fresh=1' : ''}`).then((r) => r.json()).then((j) => {
      if (j.ok) { setBudget(j.budget ?? null); setMoney(j.money ?? null); }
    }).catch(console.error).finally(() => setLoading(false));

  useEffect(() => { reload(); }, []);

  const uploadBank = async (f: File) => {
    setBusy(true); setUpMsg('통장 파일 읽는 중…');
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await fetch('/api/company/bank', { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) { setUpMsg(`⚠️ 실패: ${j.error || res.status}`); return; }
      setUpMsg(`✅ 잔고 갱신됨 — ${j.기준일} 기준 ${원(j.잔액)} · 이번달 입금 ${원(j.이번달입금)} / 출금 ${원(j.이번달출금)} (거래 ${j.건수}건 읽음)`);
      await reload(true);
    } catch (e) {
      setUpMsg(`⚠️ 실패: ${String(e)}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // 세이프박스·비상금은 통장 파일에 안 나오므로 직접 입력 (잔고 탭 갱신)
  const setBalance = async (항목: '세이프박스' | '비상금') => {
    const cur = 항목 === '세이프박스' ? money?.잔고?.세이프박스 : budget?.비상금잔액;
    const v = window.prompt(`${항목} 현재 금액 (숫자만)`, String(cur ?? 0));
    if (v === null) return;
    const 금액 = Number(v.replace(/[^0-9]/g, ''));
    setBusy(true);
    const res = await fetch('/api/company/bank', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 항목, 금액 }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !j.ok) { alert(`실패: ${j.error || res.status}`); return; }
    await reload(true);
  };

  // 상여 확정 = 인건비 원장에 대기 행 추가 → 대시보드 10일 지급확인 흐름 합류
  const confirmBonus = async () => {
    if (!budget) return;
    const 이름 = window.prompt('상여 받을 사람 이름 (예: 신종호 / 김지영)');
    if (!이름) return;
    const 금액 = Number((window.prompt(`상여 금액 (권장 ${원(budget.상여권장)})`, String(budget.상여권장)) || '').replace(/[^0-9]/g, ''));
    if (!금액) return;
    setBusy(true);
    const res = await fetch('/api/office/labor', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 월: budget.전월, 구분: '직원', 이름, 세전: 금액, 공제: 0, 실지급: 금액, 비고: '상여(예산 권장)' }),
    });
    const j = await res.json().catch(() => ({ ok: res.ok }));
    setBusy(false);
    if (!res.ok || j.ok === false) { alert(`실패: ${j.error || res.status}`); return; }
    alert(`상여 등록됨 — ${이름} ${원(금액)} (대기 상태, 실제 이체 후 대시보드 정산 탭에서 지급확인)`);
  };

  if (loading) return <section className="mt-14"><p className="text-[13px] text-[#6d6e73]">회장 금고 여는 중…</p></section>;

  const b = budget;
  const 잔고 = money?.잔고;
  const 잔고나이 = (() => {
    if (!잔고?.업데이트) return 999;
    const d = new Date(`${잔고.업데이트}T00:00:00+09:00`);
    return isNaN(d.getTime()) ? 999 : Math.floor((Date.now() - d.getTime()) / 86400000);
  })();
  const 대기인건비 = (money?.인건비목록 || []).filter((l) => l.지급상태 !== '지급완료').reduce((s, l) => s + l.실지급, 0);

  return (
    <section className="mt-14">
      <h2 className="text-[20px] font-semibold mb-4">회장 금고</h2>

      {/* 잔고 3칸 + 통장 파일 업로드 */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
        <div className="bg-white/[0.04] rounded-2xl p-4">
          <div className="text-[13px] font-semibold text-[#adaeb3]">통장 (운영)</div>
          <div className="text-[24px] font-bold tabular-nums mt-1">{원(잔고?.통장잔고 ?? 0)}</div>
          <div className={`text-[12px] mt-0.5 ${잔고나이 > 3 ? 'text-[#ff5e30]' : 'text-[#6d6e73]'}`}>
            {잔고?.업데이트 || '기준일 없음'} 기준{잔고나이 > 3 && 잔고나이 < 999 ? ` · ${잔고나이}일 전 — 통장 파일 올려서 갱신` : ''}
          </div>
        </div>
        <div onClick={() => !busy && setBalance('세이프박스')} className="bg-white/[0.04] rounded-2xl p-4 cursor-pointer hover:bg-white/[0.07] transition">
          <div className="text-[13px] font-semibold text-[#adaeb3]">세이프박스 (부가세·세금 전용)</div>
          <div className="text-[24px] font-bold tabular-nums mt-1">{원(잔고?.세이프박스 ?? 0)}</div>
          <div className="text-[12px] text-[#6d6e73] mt-0.5">눌러서 금액 수정</div>
        </div>
        <div onClick={() => !busy && setBalance('비상금')} className="bg-white/[0.04] rounded-2xl p-4 cursor-pointer hover:bg-white/[0.07] transition">
          <div className="text-[13px] font-semibold text-[#adaeb3]">비상금 (별도 통장)</div>
          <div className="text-[24px] font-bold tabular-nums mt-1">{원(b?.비상금잔액 ?? 0)}</div>
          <div className="text-[12px] text-[#6d6e73] mt-0.5">
            목표 {원(b?.비상금목표 ?? 0)}의 {b && b.비상금목표 > 0 ? Math.min(100, Math.round(b.비상금잔액 / b.비상금목표 * 100)) : 0}% · 눌러서 수정
          </div>
        </div>
      </div>

      {/* 통장 파일 넣는 칸 */}
      <label className={`mt-3 block bg-white/[0.04] border border-dashed border-white/20 rounded-2xl p-4 text-center transition ${busy ? 'opacity-50' : 'cursor-pointer hover:bg-white/[0.07]'}`}>
        <input ref={fileRef} type="file" accept=".xlsx" className="hidden" disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBank(f); }} />
        <span className="text-[14px] font-semibold text-[#c8cad6]">📄 통장 파일 넣기 — 카카오뱅크 거래내역 .xlsx</span>
        <p className="text-[12px] text-[#6d6e73] mt-1">카카오뱅크 앱 → 거래내역 내보내기 파일을 그대로. 암호는 자동 해제되고, 통장 잔고·기준일이 장부에 바로 반영됩니다.</p>
        {upMsg && <p className="text-[13px] mt-2 text-[#cbfe03]">{upMsg}</p>}
      </label>

      {/* 이번달 예산 — 재무팀 */}
      {!b ? (
        <p className="text-[13px] text-[#6d6e73] mt-3">예산 규칙 미설정 — 시트 &lsquo;예산&rsquo; 탭이 있어야 표시됩니다.</p>
      ) : (() => {
        const 등급색 = b.등급 === '좋음' ? 'text-[#cbfe03] border-[#cbfe03]' : b.등급 === '보통' ? 'text-[#7b7bf5] border-[#7b7bf5]' : b.등급 === '빠듯' ? 'text-[#ffb03a] border-[#ffb03a]' : 'text-[#ff5e30] border-[#ff5e30]';
        const 사용률 = b.써도되는돈 > 0 ? Math.min(100, Math.round(b.이미쓴돈 / b.써도되는돈 * 100)) : (b.이미쓴돈 > 0 ? 100 : 0);
        const 바색 = b.남은한도 < 0 ? 'bg-[#ff5e30]' : 사용률 >= 80 ? 'bg-[#ffb03a]' : 'bg-[#cbfe03]';
        return (
          <div className="mt-3 bg-white/[0.04] rounded-2xl overflow-hidden">
            <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/10">
              <span className="text-[15px] font-semibold">💼 이번달 예산 <span className="text-[12px] text-[#6d6e73] font-normal">{b.기준월} · 재원 = {b.전월} 실입금</span></span>
              <span className={`text-[12px] px-2 py-0.5 rounded-full font-semibold border bg-transparent ${등급색}`}>등급: {b.등급}</span>
            </div>
            <div className="divide-y divide-white/5 text-[14px]">
              <div className="px-4 py-2.5 flex justify-between"><span className="font-semibold text-[#c8cad6]">들어온 돈</span><span className="font-bold text-[#cbfe03] tabular-nums">{원(b.재원)}</span></div>
              <div className="px-4 py-2.5 space-y-0.5 text-[#adaeb3]">
                <div className="flex justify-between"><span>− 부가세 적립 <span className="text-[11px] text-[#6d6e73]">세이프박스 이체</span></span><span className="tabular-nums">{원(b.부가세적립)}</span></div>
                <div className="flex justify-between"><span>− 기본급 2인 <span className="text-[11px] text-[#6d6e73]">10일 지급</span></span><span className="tabular-nums">{원(b.기본급)}</span></div>
                <div className="flex justify-between"><span>− 고정비</span><span className="tabular-nums">{원(b.고정비)}</span></div>
                {b.세금적립 > 0 && <div className="flex justify-between"><span>− 세금 적립</span><span className="tabular-nums">{원(b.세금적립)}</span></div>}
                <div className="flex justify-between pt-1 font-semibold text-[#c8cad6]"><span>= 여유</span><span className={`tabular-nums ${b.여유 < 0 ? 'text-[#ff5e30]' : ''}`}>{원(b.여유)}</span></div>
              </div>
              {b.등급 === '적자' ? (
                <div className="px-4 py-2.5 text-[13px] text-[#ff5e30]">
                  ⚠️ 지난달 수입으로 필수비용 부족 — {원(b.비상금인출)}은 비상금 또는 미수금 회수로 보전. 이번달 상여·저축 없음.
                </div>
              ) : (
                <div className="px-4 py-2.5 space-y-1 text-[#adaeb3]">
                  <div className="flex justify-between items-center">
                    <span>🎁 상여 권장 <span className="text-[11px] text-[#6d6e73]">기본급 외 추가 여력</span></span>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold tabular-nums">{원(b.상여권장)}</span>
                      {b.상여권장 > 0 && (
                        <button onClick={confirmBonus} disabled={busy}
                          className="text-[12px] px-2.5 py-1 rounded-lg bg-[#4545da] text-white font-semibold hover:opacity-90 disabled:opacity-50">상여 확정</button>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between"><span>🏦 비상금 적립 <span className="text-[11px] text-[#6d6e73]">비상금통장 이체</span></span><span className="font-semibold tabular-nums">{원(b.비상금적립)}</span></div>
                  {b.저축 > 0 && <div className="flex justify-between"><span>💎 저축(투자 여력)</span><span className="font-semibold tabular-nums">{원(b.저축)}</span></div>}
                </div>
              )}
              <div className="px-4 py-3">
                <div className="flex justify-between mb-1.5">
                  <span className="font-semibold">✅ 써도 되는 돈</span>
                  <span className="font-bold text-[#cbfe03] tabular-nums">{원(b.써도되는돈)}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className={`h-full ${바색}`} style={{ width: `${사용률}%` }} /></div>
                <div className="flex justify-between mt-1 text-[12px] text-[#6d6e73]">
                  <span>이미 씀 {원(b.이미쓴돈)}</span>
                  <span className={b.남은한도 < 0 ? 'text-[#ff5e30] font-semibold' : ''}>{b.남은한도 < 0 ? `한도 초과 ${원(-b.남은한도)}` : `남은 한도 ${원(b.남은한도)}`}</span>
                </div>
              </div>
              <div className="px-4 py-2.5 flex justify-between text-[13px] text-[#adaeb3]">
                <span>💸 다음 10일에 나갈 인건비(대기)</span><span className="font-semibold tabular-nums">{원(대기인건비)}</span>
              </div>
              {b.코멘트.length > 0 && (
                <div className="px-4 py-2.5 space-y-1">
                  {b.코멘트.map((c, i) => <p key={i} className="text-[12px] text-[#ffb03a] leading-relaxed">💬 {c}</p>)}
                </div>
              )}
            </div>
          </div>
        );
      })()}
      <p className="text-[12px] text-[#6d6e73] mt-2">규칙(비율·목표) 조정 = 지출장부 시트 &lsquo;예산&rsquo; 탭 숫자 수정 · 매달 9일 아침 라크 브리핑 · 지급확인은 대시보드 정산 탭에서.</p>
    </section>
  );
}
