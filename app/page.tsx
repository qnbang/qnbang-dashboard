'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
  expenses: Expense[];
  yearTotal: number;
  thisMonthTotal: number;
  count: number;
};

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

const TABS = [
  { key: 'expense', label: '지출', ready: true },
  { key: 'revenue', label: '매출', ready: false },
  { key: 'work', label: '업무', ready: false },
  { key: 'tools', label: '업무툴', ready: true },
];

// 업무에 쓰는 외부 도구 목록 — 새 도구가 생기면 여기에 한 줄 추가하면 됩니다.
const WORK_TOOLS = [
  {
    name: '키워드 광고 도구',
    desc: '네이버 검색광고 키워드 월간 검색량·연관키워드 조회',
    href: 'https://qnbang-naver-keyword.vercel.app',
    icon: '🔍',
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  },
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
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-800">큐앤뱅 대시보드</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/tax-invoice"
              className="text-sm font-medium rounded-lg bg-slate-800 text-white px-3 py-1.5 hover:bg-slate-700"
            >
              세금계산서 발행
            </Link>
            <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-800">
              로그아웃
            </button>
          </div>
        </div>
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

        {tab === 'tools' && <ToolsView />}

        {tab !== 'expense' && tab !== 'tools' && (
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
  const [sel, setSel] = useState<'all' | number>('all');

  const monthsWithData = Array.from(new Set(data.expenses.map((e) => e.month))).sort(
    (a, b) => a - b
  );

  const filtered = sel === 'all' ? data.expenses : data.expenses.filter((e) => e.month === sel);
  const total = filtered.reduce((s, e) => s + e.cost, 0);

  const catMap: Record<string, number> = {};
  for (const e of filtered) {
    const k = e.category || '미분류';
    catMap[k] = (catMap[k] || 0) + e.cost;
  }
  const byCategory = Object.entries(catMap)
    .map(([category, t]) => ({ category, total: t }))
    .sort((a, b) => b.total - a.total);

  const list = [...filtered].sort((a, b) => (a.date < b.date ? 1 : -1));

  const periodLabel = sel === 'all' ? '올해 누적 지출' : `${sel}월 지출`;

  return (
    <div className="space-y-6">
      {/* 월 선택창 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">기간 선택</span>
        <select
          value={String(sel)}
          onChange={(e) => setSel(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-500"
        >
          <option value="all">전체 (올해 누적)</option>
          {monthsWithData.map((m) => (
            <option key={m} value={m}>
              {m}월
            </option>
          ))}
        </select>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label={periodLabel} value={won(total)} accent />
        <SummaryCard label="기록 건수" value={`${filtered.length}건`} />
        <SummaryCard label="카테고리 수" value={`${byCategory.length}개`} />
      </div>

      {/* 차트 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="월별 지출 (전체 비교)">
          <MonthlyBar data={data.monthly} />
        </Card>
        <Card title={sel === 'all' ? '카테고리별 지출 (전체)' : `카테고리별 지출 (${sel}월)`}>
          {byCategory.length ? (
            <CategoryPie data={byCategory} />
          ) : (
            <p className="text-slate-400 text-center py-20">데이터 없음</p>
          )}
        </Card>
      </div>

      {/* 지출 내역 */}
      <Card title={sel === 'all' ? '지출 내역 (전체)' : `${sel}월 지출 내역`}>
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
              {list.map((e, i) => (
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
              {list.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    이 기간에는 지출이 없어요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ToolsView() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">업무에 쓰는 도구 모음입니다. 아이콘을 누르면 새 창에서 열려요.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {WORK_TOOLS.map((t) => (
          <a
            key={t.name}
            href={t.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-2xl border border-slate-200 bg-white p-5 flex flex-col items-center text-center transition hover:shadow-md hover:-translate-y-0.5"
          >
            <div
              className={`w-14 h-14 rounded-2xl border flex items-center justify-center text-2xl ${t.color}`}
            >
              {t.icon}
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-800 group-hover:text-indigo-600">
              {t.name}
            </p>
            <p className="mt-1 text-xs text-slate-400 leading-snug">{t.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        accent ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200'
      }`}
    >
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
