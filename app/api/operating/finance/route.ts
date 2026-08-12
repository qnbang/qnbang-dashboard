import { NextResponse } from 'next/server';
import { fetchBudget } from '@/lib/budget';
import { fetchMoneyData } from '@/lib/money';
import { fetchExpenseData } from '@/lib/sheet';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';
const 통합인덱스ID = '1RnmSplWT2-Aqk-flDInpWMljKwBbUes1q6pab9j3dfo';

function 표행(values: unknown[][]) {
  const [header = [], ...rows] = values;
  return rows.map((row) => Object.fromEntries(header.map((key, index) => [String(key), String(row[index] ?? '')])));
}

function 정산시트(scope: string) {
  const serviceAccount = JSON.parse(process.env.GOOGLE_SA_JSON || '{}');
  const auth = new google.auth.JWT({ email: serviceAccount.client_email, key: serviceAccount.private_key, scopes: [scope] });
  return google.sheets({ version: 'v4', auth });
}

function 이번달() {
  const now = new Date();
  const year = now.toLocaleString('en-US', { timeZone: 'Asia/Seoul', year: 'numeric' });
  const month = now.toLocaleString('en-US', { timeZone: 'Asia/Seoul', month: '2-digit' });
  return `${year}-${month}`;
}

// 운영OS 재무 화면은 기존 '큐앤뱅 지출장부'를 읽기만 한다.
// 금액 확정과 수정은 기존 대시보드의 매출·지출·인건비 경로를 그대로 사용한다.
export async function GET() {
  const [moneyResult, expenseResult, budgetResult, reviewResult] = await Promise.allSettled([
    fetchMoneyData(),
    fetchExpenseData(),
    fetchBudget(),
    정산시트('https://www.googleapis.com/auth/spreadsheets.readonly').spreadsheets.values.get({ spreadsheetId: 통합인덱스ID, range: "'정산확인대기'!A:Z" }),
  ]);

  if (moneyResult.status !== 'fulfilled' || expenseResult.status !== 'fulfilled') {
    return NextResponse.json({ ok: false, message: '기존 재무 원장을 읽지 못했습니다.' }, { status: 503 });
  }

  const money = moneyResult.value;
  const expenses = expenseResult.value;
  const month = 이번달();
  const 거래목록 = reviewResult.status === 'fulfilled' ? 표행((reviewResult.value.data.values as unknown[][]) || []).map((row) => ({
    id: row['거래ID'], date: row['거래시각'], counterparty: row['상대'], income: Number(row['입금액'] || 0), expense: Number(row['출금액'] || 0), category: row['자동분류'], confidence: row['확신도'], customerId: row['후보고객ID'], projectId: row['후보프로젝트ID'], status: row['확인상태'] || '확인 필요', source: row['원문링크'],
  })).filter((item) => item.id) : [];
  const 이번달거래 = 거래목록.filter((item) => String(item.date).replace(/[./]/g, '-').startsWith(month));
  const 통장자료있음 = 이번달거래.length > 0;
  const monthlyRevenue = 통장자료있음 ? 이번달거래.reduce((total, item) => total + item.income, 0) : money.월별.find((item) => item.월 === month)?.실현 || 0;
  const monthlyExpense = 통장자료있음 ? 이번달거래.reduce((total, item) => total + item.expense, 0) : expenses.thisMonthTotal;
  const pendingLabor = money.인건비목록
    .filter((item) => item.지급상태 !== '지급완료')
    .reduce((total, item) => total + item.실지급, 0);

  return NextResponse.json({
    ok: true,
    source: 통장자료있음 ? '통장 거래 원본' : '큐앤뱅 지출장부(통장 자료 업로드 전)',
    sourceMode: 통장자료있음 ? '통장 거래 기준' : '기존 원장 대조',
    updatedAt: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' }),
    summary: {
      month,
      income: monthlyRevenue,
      expense: monthlyExpense,
      receivable: money.미수금합,
      pendingLabor,
    },
    recentExpenses: expenses.recent.slice(0, 10),
    bankTransactions: 거래목록,
    contracts: money.계약목록,
    labor: money.인건비목록,
    monthlyExpenses: expenses.monthly,
    fixedCosts: money.고정비목록,
    balances: money.잔고,
    budget: budgetResult.status === 'fulfilled' ? budgetResult.value : null,
    reviewQueue: 거래목록.filter((item) => item.status !== '확정' && item.status !== '통장 대조 완료'),
  });
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = String(body.id || '').trim();
    const status = String(body.status || '').trim();
    if (!id || !['확정', '보류'].includes(status)) return NextResponse.json({ ok: false, message: '거래와 처리 상태를 확인해 주세요.' }, { status: 400 });
    const sheets = 정산시트('https://www.googleapis.com/auth/spreadsheets');
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: 통합인덱스ID, range: "'정산확인대기'!A:Z" });
    const [header = [], ...rows] = response.data.values || [];
    const idColumn = header.indexOf('거래ID');
    const statusColumn = header.indexOf('확인상태');
    const reviewerColumn = header.indexOf('확인자');
    const dateColumn = header.indexOf('확인일');
    const rowIndex = rows.findIndex((row) => String(row[idColumn] || '') === id);
    if (rowIndex < 0 || [statusColumn, reviewerColumn, dateColumn].some((index) => index < 0)) return NextResponse.json({ ok: false, message: '정산확인대기 원장 구조를 확인해 주세요.' }, { status: 404 });
    const column = (index: number) => String.fromCharCode(65 + index);
    await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: 통합인덱스ID, requestBody: { valueInputOption: 'RAW', data: [
      { range: `'정산확인대기'!${column(statusColumn)}${rowIndex + 2}`, values: [[status]] },
      { range: `'정산확인대기'!${column(reviewerColumn)}${rowIndex + 2}`, values: [[String(body.reviewer || '신종호')]] },
      { range: `'정산확인대기'!${column(dateColumn)}${rowIndex + 2}`, values: [[new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })]] },
    ] } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: '정산 확인 상태를 기록하지 못했습니다.' }, { status: 500 });
  }
}
