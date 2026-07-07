// 돈축 집계 — 구글시트 "큐앤뱅 지출장부"의 매출·고정비 탭을 읽어 스코어카드 숫자를 만든다.
// 같은 Apps Script 웹앱(SHEET_URL)이 모든 탭을 JSON으로 내보내므로, sheet.ts와 같은 소스를 쓴다.
// 탭 헤더: 매출=[계약일,계약명,클라이언트,계약금액,부가세,입금상태,입금일,입금액,순매출,비고]
//          고정비=[항목,금액,주기,납부일,종류,할부종료월,활성]

import { getSheets } from './sheetCache';

const num = (v: unknown) => Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;
const ym = (v: unknown) => {
  const s = String(v ?? '').replace(/\s/g, '');
  const m = s.match(/(\d{4})[-/.](\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}` : '';
};

export interface Contract {
  _row: number;        // 시트 행 번호 (수정/삭제용)
  입금일full: string;   // 원본 날짜 문자열 (표시용)
  계약일: string; 계약명: string; 클라이언트: string;
  계약금액: number; 부가세: number; 공급가: number;
  입금상태: string; 입금일: string; 입금예정일: string; 입금액: number; 순매출: number;
  미수금: number;
  미수종류: '받을예정' | '단순미수' | '';
}
export interface Labor {
  _row: number;
  월: string;          // 귀속월 YYYY-MM
  구분: string;        // 직원 | 프리랜서 | 기타
  이름: string;
  세전: number; 공제: number; 실지급: number;
  지급상태: string;    // 대기 | 지급완료
  지급일: string; 비고: string;
}
export interface MoneyData {
  순매출누계: number;
  미수금합: number;
  받을예정합: number;   // 미수 중 입금예정일 잡힌 것
  단순미수합: number;   // 미수 중 예정일 없는 것(미정·연체)
  고정비월합: number;
  계약건수: number;
  월별: { 월: string; 계약액: number; 순매출: number; 실현: number }[];
  계약목록: Contract[];
  고정비목록: { 항목: string; 금액: number; 납부일: string; 종류: string }[];
  인건비목록: Labor[];
  잔고: { 통장잔고: number; 세이프박스: number; 보유현금: number; 업데이트: string };
}

// 시트 탭을 객체배열로 (헤더 행 기준), _row = 실제 시트 행 번호
function rows(sheet: unknown[][] | undefined): Record<string, unknown>[] {
  if (!Array.isArray(sheet) || sheet.length < 2) return [];
  const head = (sheet[0] as unknown[]).map((h) => String(h));
  return sheet.slice(1)
    .map((r, i) => {
      const obj: Record<string, unknown> = Object.fromEntries(head.map((h, j) => [h, Array.isArray(r) ? (r as unknown[])[j] : undefined]));
      obj['_row'] = i + 2; // 헤더=1행, 첫 데이터=2행
      return obj;
    })
    .filter((r) => head.some((h) => h !== '_row' && String(r[h] ?? '').trim() !== ''));
}

export async function fetchMoneyData(): Promise<MoneyData> {
  const sheets = await getSheets();

  // 매출(계약 원장)
  const 계약목록: Contract[] = rows(sheets['매출']).map((r) => {
    const 계약금액 = num(r['계약금액']);
    const 입금액 = num(r['입금액']);
    const 부가세 = num(r['부가세']);
    const 입금예정일 = ym(r['입금예정일']);
    const 미수금 = Math.max(0, 계약금액 - 입금액);
    const 입금일raw = String(r['입금일'] ?? '');
    return {
      _row: Number(r['_row']) || 0,
      입금일full: 입금일raw,
      계약일: ym(r['계약일']),
      계약명: String(r['계약명'] ?? ''),
      클라이언트: String(r['클라이언트'] ?? ''),
      계약금액, 입금액, 부가세,
      공급가: 부가세 > 0 ? 계약금액 - 부가세 : 계약금액,
      입금상태: String(r['입금상태'] ?? ''),
      입금일: ym(입금일raw),
      입금예정일,
      순매출: num(r['순매출']),
      미수금,
      미수종류: 미수금 > 0 ? (입금예정일 ? '받을예정' : '단순미수') : '',
    } as Contract;
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

  // 인건비 (귀속월 원장 — 지급확인 전까지는 지출에 안 잡히고 미지급으로 집계)
  const 인건비목록: Labor[] = rows(sheets['인건비']).map((r) => ({
    _row: Number(r['_row']) || 0,
    월: ym(r['월']),
    구분: String(r['구분'] ?? ''),
    이름: String(r['이름'] ?? ''),
    세전: num(r['세전']), 공제: num(r['공제']), 실지급: num(r['실지급']),
    지급상태: String(r['지급상태'] ?? ''),
    지급일: String(r['지급일'] ?? ''),
    비고: String(r['비고'] ?? ''),
  })).filter((l) => l.이름);

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

  // 잔고
  const 잔고sheet = sheets['잔고'];
  let 통장잔고 = 0, 세이프박스 = 0, 잔고업데이트 = '';
  if (Array.isArray(잔고sheet)) {
    for (const r of 잔고sheet.slice(1)) {
      const row = r as unknown[];
      const 항목 = String(row[0] ?? '');
      if (항목 === '통장잔고') { 통장잔고 = num(row[1]); 잔고업데이트 = String(row[2] ?? ''); }
      if (항목 === '세이프박스') 세이프박스 = num(row[1]);
    }
  }

  return {
    순매출누계: 계약목록.reduce((s, c) => s + c.입금액, 0),  // 정산 탭과 동일하게 실입금 기준(통장)
    미수금합: 계약목록.reduce((s, c) => s + c.미수금, 0),
    받을예정합: 계약목록.filter((c) => c.미수종류 === '받을예정').reduce((s, c) => s + c.미수금, 0),
    단순미수합: 계약목록.filter((c) => c.미수종류 === '단순미수').reduce((s, c) => s + c.미수금, 0),
    고정비월합: 고정비목록.reduce((s, c) => s + c.금액, 0),
    계약건수: 계약목록.length,
    월별,
    계약목록,
    고정비목록,
    인건비목록,
    잔고: { 통장잔고, 세이프박스, 보유현금: 통장잔고 + 세이프박스, 업데이트: 잔고업데이트 },
  };
}
