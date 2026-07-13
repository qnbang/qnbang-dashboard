'use client';
// /company 2차 게이트 — 대시보드 로그인과 별개 비번 한 번 더. app/login/page.tsx와 같은 패턴, /api/company/login으로만 다르게.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CompanyLogin() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/company/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push('/company');
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || '로그인에 실패했습니다.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-8"
      >
        <h1 className="text-xl font-bold text-slate-800">큐앤뱅 회사지도</h1>
        <p className="text-sm text-slate-500 mt-1">회장 전용 — 비밀번호를 한 번 더 입력하세요</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          autoFocus
          className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-800 outline-none focus:border-[#4545da] focus:ring-2 focus:ring-[#4545da]/20"
        />
        {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-4 w-full rounded-lg bg-[#4545da] py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {loading ? '확인 중…' : '들어가기'}
        </button>
      </form>
    </div>
  );
}
