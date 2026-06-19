// 돈축 집계 — 구글시트 "큐앤뱅 지출장부"의 매출·고정비 탭을 읽어 스코어카드 숫자를 만든다.
// 같은 Apps Script 웹앱(SHEET_URL)이 모든 탭을 JSON으로 내보내므로, sheet.ts와 같은 소스를 쓴다.
// 탭 헤더: 매출=[계약일,계약명,클라이언트,계약금액,부가세,입금상태,입금일,입금액,순매출,비고]
//          고정비=[항목,금액,주기,납부일,종류,할부종료월,활성]

const SHEET_URL = process.env.SHEET_URL!;
const SHEET_KEY = process.env.SHEET_KEY!;

const num = (v: unknown) => Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;
const ym = (v: unknown) => {
  const s = String(v ?? '');
  const m = s.match(/(\d{4})[-/.](\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}` : '';
};

export interface Contract {
  계약일: string; 계약명: string; 클라이언트: string;
  계약금액: number; 입금상태: string; 입금일: string; 입금액: number; 순매출: number;
  미수금: number;
}
export interface MoneyData {
  순매출누계: number;
  미수금합: number;
  고정비월합: number;
  계약건수: number;
  월별: { 월: string; 계약액: number; 순매출: number; 실현: number }[];
  계약목록: Contract[];
  고정비목록: { 항목: string; 금액: number; 납부일: string; 종류: string }[];
}

// 시트 탭을 객체배열로 (헤더 행 기준)
function rows(sheet: unknown[][] | undefined): Record<string, unknown>[] {
  if (!Array.isArray(sheet) || sheet.length < 2) return [];
  const head = (sheet[0] as unknown[]).map((h) => String(h));
  return sheet.slice(1)
    .filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''))
    .map((r) => Object.fromEntries(head.map((h, i) => [h, (r as unknown[])[i]])));
}

export async function fetchMoneyData(): Promise<MoneyData> {
  const res = await fetch(`${SHEET_URL}?key=${encodeURIComponent(SHEET_KEY)}`, { cache: 'no-store' });
  const json = await res.json();
  const sheets: Record<string, unknown[][]> = json.sheets || {};

  // 매출(계약 원장)
  const 계약목록: Contract[] = rows(sheets['매출']).map((r) => {
    const 계약금액 = num(r['계약금액']);
    const 입금액 = num(r['입금액']);
    return {
      계약일: ym(r['계약일']),
      계약명: String(r['계약명'] ?? ''),
      클라이언트: String(r['클라이언트'] ?? ''),
      계약금액, 입금액,
      입금상태: String(r['입금상태'] ?? ''),
      입금일: ym(r['입금일']),
      순매출: num(r['순매출']),
      미수금: Math.max(0, 계약금액 - 입금액),
    };
  });

  // 고정비
  const 고정비목록 = rows(sheets['고정비'])
    .filter((r) => String(r['활성'] ?? 'Y').toUpperCase() !== 'N')
    .map((r) => ({
      항목: String(r['항목'] ?? ''),
      금액: num(r['금액']),
      납부일: String(r['납부일'] ?? ''),
      종류: String(r['종류'] ?? ''),
    }))
    .filter((f) => f.항목);

  // 월별 집계 (계약일=계약기준 매출, 입금일=실현매출)
  const map: Record<string, { 계약액: number; 순매출: number; 실현: number }> = {};
  for (const c of 계약목록) {
    if (c.계약일) {
      (map[c.계약일] ||= { 계약액: 0, 순매출: 0, 실현: 0 });
      map[c.계약일].계약액 += c.계약금액;
      map[c.계약일].순매출 += c.순매출;
    }
    if (c.입금일) {
      (map[c.입금일] ||= { 계약액: 0, 순매출: 0, 실현: 0 });
      map[c.입금일].실현 += c.입금액;
    }
  }
  const 월별 = Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
    .map(([월, v]) => ({ 월, ...v }));

  return {
    순매출누계: 계약목록.reduce((s, c) => s + c.순매출, 0),
    미수금합: 계약목록.reduce((s, c) => s + c.미수금, 0),
    고정비월합: 고정비목록.reduce((s, c) => s + c.금액, 0),
    계약건수: 계약목록.length,
    월별,
    계약목록,
    고정비목록,
  };
}
