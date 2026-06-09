'use client';

import { useState } from 'react';
import Link from 'next/link';

// 입력 필드 한 줄 컴포넌트
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-600">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 outline-none focus:border-slate-500"
      />
    </label>
  );
}

export default function TaxInvoicePage() {
  const [buyerCorpNum, setBuyerCorpNum] = useState('');
  const [buyerCorpName, setBuyerCorpName] = useState('');
  const [buyerCeoName, setBuyerCeoName] = useState('');
  const [buyerAddr, setBuyerAddr] = useState('');
  const [buyerBizType, setBuyerBizType] = useState('');
  const [buyerBizClass, setBuyerBizClass] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [itemName, setItemName] = useState('');
  const [supplyCost, setSupplyCost] = useState('');
  const [purpose, setPurpose] = useState<'청구' | '영수'>('청구');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; ntsConfirmNum?: string } | null>(null);

  const cost = Number(supplyCost.replace(/[^0-9]/g, '')) || 0;
  const tax = Math.round(cost * 0.1);
  const total = cost + tax;
  const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/tax-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerCorpNum,
          buyerCorpName,
          buyerCeoName,
          buyerAddr,
          buyerBizType,
          buyerBizClass,
          buyerEmail,
          itemName,
          supplyCost: cost,
          purpose,
        }),
      });
      const j = await res.json();
      setResult(j);
    } catch (err) {
      setResult({ ok: false, message: String(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800">세금계산서 발행</h1>
            <p className="text-xs text-amber-600 mt-0.5">
              {process.env.NEXT_PUBLIC_POPBILL_TEST === 'false'
                ? '운영 모드 — 국세청에 실제 전송됩니다'
                : '테스트 모드 — 실제 국세청 전송이 아닙니다'}
            </p>
          </div>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">
            ← 대시보드
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={submit} className="space-y-6">
          <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-700">공급받는 자 (거래처)</h2>
            <Field label="사업자등록번호" value={buyerCorpNum} onChange={setBuyerCorpNum} placeholder="1234567890 (숫자 10자리)" required />
            <Field label="상호" value={buyerCorpName} onChange={setBuyerCorpName} required />
            <Field label="대표자명" value={buyerCeoName} onChange={setBuyerCeoName} required />
            <Field label="주소" value={buyerAddr} onChange={setBuyerAddr} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="업태" value={buyerBizType} onChange={setBuyerBizType} />
              <Field label="종목" value={buyerBizClass} onChange={setBuyerBizClass} />
            </div>
            <Field label="이메일 (발행 안내 수신)" value={buyerEmail} onChange={setBuyerEmail} type="email" />
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-700">거래 내용</h2>
            <Field label="품목명" value={itemName} onChange={setItemName} placeholder="예: 컨설팅 용역" required />
            <Field label="공급가액 (부가세 제외)" value={supplyCost} onChange={setSupplyCost} placeholder="예: 1000000" required />
            <div>
              <span className="text-sm font-medium text-slate-600">영수 / 청구</span>
              <div className="mt-1 flex gap-2">
                {(['청구', '영수'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPurpose(p)}
                    className={`px-4 py-2 rounded-lg text-sm border ${
                      purpose === p
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white text-slate-600 border-slate-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700 space-y-1">
              <div className="flex justify-between"><span>공급가액</span><span>{won(cost)}</span></div>
              <div className="flex justify-between"><span>부가세 (10%)</span><span>{won(tax)}</span></div>
              <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200"><span>합계</span><span>{won(total)}</span></div>
            </div>
          </section>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-slate-800 text-white py-3 font-medium disabled:opacity-50"
          >
            {loading ? '발행 중…' : '세금계산서 발행'}
          </button>
        </form>

        {result && (
          <div
            className={`mt-5 rounded-xl p-4 text-sm ${
              result.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <p className="font-bold">{result.ok ? '✅ 발행 완료' : '❌ 발행 실패'}</p>
            <p className="mt-1">{result.message}</p>
            {result.ntsConfirmNum && <p className="mt-1">국세청 승인번호: {result.ntsConfirmNum}</p>}
          </div>
        )}
      </main>
    </div>
  );
}
