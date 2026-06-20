// 구글 시트(Apps Script 웹앱)에서 지출 데이터를 읽어 대시보드용으로 가공한다.
// 이 파일은 서버에서만 실행되므로 비밀번호(SHEET_KEY)가 브라우저에 노출되지 않는다.

import { getSheets } from './sheetCache';

export interface Expense {
  month: number;      // 1~12
  date: string;       // 원본(ISO 등)
  dateLabel: string;  // 2026. 6. 5.
  category: string;
  content: string;
  cost: number;
  note: string;
}

export interface DashboardData {
  monthly: { month: string; total: number }[];
  byCategory: { category: string; total: number }[];
  recent: Expense[];
  expenses: Expense[];
  yearTotal: number;
  thisMonthTotal: number;
  count: number;
}

function formatDate(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export async function fetchExpenseData(): Promise<DashboardData> {
  const sheets = await getSheets();

  const expenses: Expense[] = [];
  for (let m = 1; m <= 12; m++) {
    const rows = sheets[`${m}월`];
    if (!Array.isArray(rows)) continue;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;
      const cost = Number(String(r[3] ?? '').replace(/[^0-9.-]/g, '')) || 0;
      const dateRaw = r[0] ? String(r[0]) : '';
      expenses.push({
        month: m,
        date: dateRaw,
        dateLabel: formatDate(dateRaw),
        category: String(r[1] ?? ''),
        content: String(r[2] ?? ''),
        cost,
        note: String(r[4] ?? ''),
      });
    }
  }

  const monthly = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const total = expenses
      .filter((e) => e.month === month)
      .reduce((s, e) => s + e.cost, 0);
    return { month: `${month}월`, total };
  });

  const catMap: Record<string, number> = {};
  for (const e of expenses) {
    const key = e.category || '미분류';
    catMap[key] = (catMap[key] || 0) + e.cost;
  }
  const byCategory = Object.entries(catMap)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  const recent = [...expenses]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 15);

  const yearTotal = expenses.reduce((s, e) => s + e.cost, 0);

  const kstMonth = Number(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul', month: 'numeric' })
  );
  const thisMonthTotal = monthly[kstMonth - 1]?.total || 0;

  return {
    monthly,
    byCategory,
    recent,
    expenses,
    yearTotal,
    thisMonthTotal,
    count: expenses.length,
  };
}
