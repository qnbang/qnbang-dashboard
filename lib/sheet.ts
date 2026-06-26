// 구글 시트(Apps Script 웹앱)에서 지출 데이터를 읽어 대시보드용으로 가공한다.
// 이 파일은 서버에서만 실행되므로 비밀번호(SHEET_KEY)가 브라우저에 노출되지 않는다.

import { getSheets } from './sheetCache';

export interface Expense {
  _row: number;       // 시트 행 번호 (수정/삭제용)
  month: number;      // 1~12
  date: string;       // ISO 날짜 (정렬·폼 입력용)
  dateLabel: string;  // 2026년 6월 5일 (표시용)
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

// Excel 시리얼 숫자 → ISO 날짜 (구글시트에서 숫자 형식으로 저장된 날짜 처리)
// 원인: 셀 서식이 '날짜'가 아닌 '숫자'이면 FORMATTED_VALUE가 46177 같은 숫자를 반환
function parseDate(raw: string): { iso: string; label: string } {
  if (!raw) return { iso: '', label: '' };
  const n = Number(raw);
  if (!isNaN(n) && n > 40000 && n < 70000) {
    // Excel epoch: 1899-12-30 UTC
    const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
    const iso = d.toISOString().split('T')[0];
    return { iso, label: d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' }) };
  }
  const d = new Date(raw);
  if (isNaN(d.getTime())) return { iso: raw, label: raw };
  return {
    iso: d.toISOString().split('T')[0],
    label: d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' }),
  };
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
      const { iso, label } = parseDate(r[0] ? String(r[0]) : '');
      expenses.push({
        _row: i + 1, // 헤더=1행, i=1→2행
        month: m,
        date: iso,
        dateLabel: label,
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
