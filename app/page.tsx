'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MonthlyBar, CategoryPie } from './components/charts';

type Expense = {
  month: number;
  date: string;
  dateLabel: string;
  category: string;
  content: string;
  cost: number;
  note: string;
};
type DashboardData = {
  monthly: { month: string; total: number }[];
  byCategory: { category: string; total: number }[];
  recent: Expense[];
  yearTotal: number;
  thisMonthTotal: number;
  count: number;
};

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

const TABS = [
  { key: 'expense', label: '지출', ready: true },
  { key: 'revenue', label: '매출', ready: false },
  { key: 'work', label: '업무', ready: false },
];

export default function Home() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('expense');

  useEffect(() => {
    fetch('/api/data')
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j.data);
        else setError(j.error || '데이터를 불러오지 못했습니다.');
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* 헤더 */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-800">큐앤뱅 대시보드</h1>
          <button
            onClick={logout}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            로그아웃
          </button>
        </div>
        {/* 탭 */}
        <div className="max-w-5xl mx-auto px-4 flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                tab === t.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {t.label}
              {!t.ready && <span className="ml-1 text-[10px] text-slate-300">준비중</span>}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading && <p className="text-slate-400 text-center py-20">불러오는 중…</p>}
        {error && <p className="text-red-500 text-center py-20">⚠️ {error}</p>}

        {!loading && !error && tab === 'expense' && data && <ExpenseView data={data} />}

        {tab !== 'expense' && (
          <div className="text-center py-20 text-slate-400">
            <p className="text-lg">🚧 {TABS.find((t) => t.key === tab)?.label} 대시보드</p>
            <p className="text-sm mt-2">준비 중이에요. 곧 추가됩니다.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function ExpenseView({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label="올해 누적 지출" value={won(data.yearTotal)} accent />
        <SummaryCard label="이번 달 지출" value={won(data.thisMonthTotal)} />
        <SummaryCard label="총 기록 건수" value={`${data.count}건`} />
      </div>

      {/* 차트 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="월별 지출">
          <MonthlyBar data={data.monthly} />
        </Card>
        <Card title="카테고리별 지출">
          {data.byCategory.length ? (
            <CategoryPie data={data.byCategory} />
          ) : (
            <p className="text-slate-400 text-center py-20">데이터 없음</p>
          )}
        </Card>
      </div>

      {/* 최근 지출 */}
      <Card title="최근 지출">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="py-2 pr-3 font-medium">날짜</th>
                <th className="py-2 pr-3 font-medium">카테고리</th>
                <th className="py-2 pr-3 font-medium">내용</th>
                <th className="py-2 pr-3 font-medium text-right">금액</th>
                <th className="py-2 font-medium">비고</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((e, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">{e.dateLabel}</td>
                  <td className="py-2 pr-3">
                    <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {e.category}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-slate-700">{e.content}</td>
                  <td className="py-2 pr-3 text-right font-medium text-slate-800 whitespace-nowrap">
                    {won(e.cost)}
                  </td>
                  <td className="py-2 text-slate-400 text-xs">{e.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200'}`}>
      <p className={`text-sm ${accent ? 'text-indigo-100' : 'text-slate-400'}`}>{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">{title}</h2>
      {children}
    </div>
  );
}
