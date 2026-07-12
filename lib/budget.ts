// 월 예산 자동 계산 — "지난달 번 돈으로 이번달 산다" (2026-07-12 승인 규칙)
// 재원 = 전월 실입금. 필수(부가세적립·기본급 2인·고정비)를 떼고 남는 여유를
// 등급(빠듯/보통/좋음)에 따라 상여·비상금·써도되는돈으로 배분한다.
// 규칙 숫자는 전부 시트 '예산' 탭에서 읽음 — 코드에 하드코딩 없음. 탭이 없으면 null(기능 꺼짐).
// 적립·상여는 전부 "표시만": 지출 기록은 기존 관문(지급확인·크론)이 담당한다.

import { getSheets } from './sheetCache';
import { fetchMoneyData } from './money';
import { fetchExpenseData } from './sheet';

const num = (v: unknown) => Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;

export interface Budget {
  기준월: string;        // 이번달 YYYY-MM
  전월: string;
  재원: number;          // 전월 실입금 합
  부가세적립: number;    // 전월 입금분 부가세 (세이프박스 이체 권장)
  기본급: number;        // 대표+직원 기본급 (예산 탭)
  고정비: number;        // 고정비 탭 활성 합
  세금적립: number;
  여유: number;
  등급: '적자' | '빠듯' | '보통' | '좋음';
  상여권장: number;
  비상금적립: number;
  저축: number;          // 비상금 목표 달성 후 비상금 몫이 저축으로 전환
  써도되는돈: number;
  이미쓴돈: number;      // 이번달 재량지출 (자동기록·세금·급여 제외)
  남은한도: number;      // 써도되는돈 − 이미쓴돈 (음수 = 초과)
  비상금인출: number;    // 적자 달에 비상금에서 보전해야 하는 금액
  비상금잔액: number;
  비상금목표: number;
  전월지출: number;      // 브리핑용 전월 마감
  코멘트: string[];      // 재무팀 경고·조언 (미수금 등)
}

// KST 기준 YYYY-MM (서버는 UTC — recurring 크론과 같은 방식)
function kstYM(offsetMonth = 0): string {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonth, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function fetchBudget(): Promise<Budget | null> {
  const sheets = await getSheets();
  const 예산탭 = sheets['예산'];
  if (!Array.isArray(예산탭) || 예산탭.length < 2) return null; // 규칙 미설정 → 기능 꺼짐

  const p: Record<string, number> = {};
  for (const r of 예산탭.slice(1)) {
    const row = r as unknown[];
    const k = String(row[0] ?? '').trim();
    if (k) p[k] = num(row[1]);
  }

  const [money, exp] = await Promise.all([fetchMoneyData(), fetchExpenseData()]);
  const 기준월 = kstYM(0);
  const 전월 = kstYM(-1);

  const 전월입금건 = money.계약목록.filter((c) => c.입금일 === 전월 && c.입금액 > 0);
  const 재원 = 전월입금건.reduce((s, c) => s + c.입금액, 0);
  const 부가세적립 = 전월입금건.reduce((s, c) => s + c.부가세, 0);
  const 기본급 = p['기본급월합'] || 0;
  const 고정비 = money.고정비월합;
  const 세금적립 = Math.round(재원 * (p['세금적립률'] || 0) / 100);
  const 여유 = 재원 - 부가세적립 - 기본급 - 고정비 - 세금적립;

  // 비상금 잔액 — 잔고 탭 '비상금' 행 (money.ts는 통장·세이프박스만 파싱)
  let 비상금잔액 = 0;
  for (const r of (sheets['잔고'] || []).slice(1)) {
    const row = r as unknown[];
    if (String(row[0] ?? '').includes('비상금')) 비상금잔액 = num(row[1]);
  }
  const 비상금목표 = p['비상금목표액'] || 0;

  // 등급별 배분율 (예산 탭)
  let 등급: Budget['등급'], 비율 = 0, 상율 = 0;
  if (여유 <= 0) 등급 = '적자';
  else if (여유 <= (p['구간1상한'] || 0)) { 등급 = '빠듯'; 비율 = p['빠듯_비상금%'] || 0; 상율 = p['빠듯_상여%'] || 0; }
  else if (여유 <= (p['구간2상한'] || 0)) { 등급 = '보통'; 비율 = p['보통_비상금%'] || 0; 상율 = p['보통_상여%'] || 0; }
  else { 등급 = '좋음'; 비율 = p['좋음_비상금%'] || 0; 상율 = p['좋음_상여%'] || 0; }

  const 상여권장 = 등급 === '적자' ? 0 : Math.min(Math.round(여유 * 상율 / 100), p['상여상한'] || Infinity);
  const 비상금몫 = 등급 === '적자' ? 0 : Math.round(여유 * 비율 / 100);
  // 목표 도달까지만 비상금, 넘치는 몫은 저축(투자 여력)으로 전환
  const 비상금적립 = Math.min(비상금몫, Math.max(0, 비상금목표 - 비상금잔액));
  const 저축 = 비상금몫 - 비상금적립;
  const 써도되는돈 = 등급 === '적자' ? 0 : 여유 - 상여권장 - 비상금몫;
  const 비상금인출 = 등급 === '적자' ? -여유 : 0;

  // 이번달 재량지출 = 지출탭에서 자동기록(고정비·인건비)·세금·급여 제외 — 이중계산 방지
  const 이번달 = Number(기준월.slice(5));
  const 이미쓴돈 = exp.expenses
    .filter((e) => e.month === 이번달)
    .filter((e) => !e.note.includes('자동(고정비)') && !e.note.includes('자동(인건비'))
    .filter((e) => e.category !== '세금' && e.category !== '급여' && e.category !== '보험' && e.category !== '세무')
    .reduce((s, e) => s + e.cost, 0);
  const 남은한도 = 써도되는돈 - 이미쓴돈;

  const 전월지출 = exp.expenses.filter((e) => e.month === Number(전월.slice(5)) && 전월.slice(0, 4) === 기준월.slice(0, 4)).reduce((s, e) => s + e.cost, 0);

  const 코멘트: string[] = [];
  if (등급 === '적자') 코멘트.push(`지난달 수입으로 필수비용이 안 됩니다 — 부족분 ${비상금인출.toLocaleString()}원은 비상금(또는 미수금 회수)에서 보전해야 합니다.`);
  if (money.미수금합 > money.잔고.보유현금) 코멘트.push(`미수금 ${money.미수금합.toLocaleString()}원이 보유현금보다 큽니다 — 상여·지출보다 회수 연락이 먼저입니다.`);
  if (money.단순미수합 > 0) 코멘트.push(`입금예정일 없는 미수금이 ${money.단순미수합.toLocaleString()}원 — 예정일부터 받아내세요.`);
  if (남은한도 < 0) 코멘트.push(`이번달 재량지출이 한도를 ${(-남은한도).toLocaleString()}원 초과했습니다. 외주비(프로젝트 원가) 때문이라면 정상 신호입니다.`);

  return {
    기준월, 전월, 재원, 부가세적립, 기본급, 고정비, 세금적립, 여유, 등급,
    상여권장, 비상금적립, 저축, 써도되는돈, 이미쓴돈, 남은한도, 비상금인출,
    비상금잔액, 비상금목표, 전월지출, 코멘트,
  };
}
