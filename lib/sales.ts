// 영업 보드(P8) — 영업 시트탭을 읽어 3단계(접촉·제안·계약대기) 파이프라인 + 무응답 노화.
// "물어봐놓고 까먹음"을 막는 게 핵심: 단계별 임계 넘게 답 없으면 stale(빨강 '한 번 더').
import { getSheets } from './sheetCache';

// 단계별 "이만큼 답 없으면 팔로업" 임계(일). 영업은 빨리 식어서 짧게.
const STAGE_DAYS: Record<string, number> = { 접촉: 3, 제안: 7, 계약대기: 5 };
const ACTIVE = ['접촉', '제안', '계약대기']; // 계약/종료는 보드에서 빠짐

export interface Lead {
  id: string; 대상: string; 단계: string; 다음액션: string;
  예상금액: number | null;  // null = 협의 전(가격 미정)
  마지막접촉일: string; 비고: string;
  staleDays: number | null; stale: boolean;
}
export interface SalesData {
  leads: Lead[];
  followups: Lead[];                 // stale만, 오래된 순
  예상매출: number;                    // 가격 정해진 것 합
  협의전: number;                      // 가격 미정 건수
  단계수: Record<string, number>;
  source: 'sheet' | 'unavailable';
}

function daysSince(s?: string): number | null {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  const ymd = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).split('-').map(Number);
  const [y, m, dd] = ymd(d);
  const [ty, tm, td] = ymd(new Date());
  return Math.max(0, Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(y, m - 1, dd)) / 86400000));
}

export async function buildSales(): Promise<SalesData> {
  let rows: unknown[][] | undefined;
  try {
    rows = (await getSheets())?.['영업'];
  } catch {
    return { leads: [], followups: [], 예상매출: 0, 협의전: 0, 단계수: {}, source: 'unavailable' };
  }
  if (!Array.isArray(rows) || rows.length < 1) {
    return { leads: [], followups: [], 예상매출: 0, 협의전: 0, 단계수: {}, source: 'sheet' };
  }
  const head = (rows[0] as unknown[]).map((h) => String(h));
  const col = (n: string) => head.indexOf(n);
  const ci = {
    id: col('id'), 대상: col('대상'), 단계: col('단계'), 다음액션: col('다음액션'),
    예상금액: col('예상금액'), 마지막접촉일: col('마지막접촉일'), 비고: col('비고'),
  };
  const get = (r: unknown[], j: number) => (j >= 0 ? String(r[j] ?? '').trim() : '');

  const leads: Lead[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!Array.isArray(r) || r.every((c) => String(c ?? '').trim() === '')) continue;
    const 단계 = get(r, ci.단계) || '접촉';
    if (!ACTIVE.includes(단계)) continue; // 계약/종료는 보드에서 제외
    const 금액raw = get(r, ci.예상금액).replace(/[^0-9.]/g, '');
    const 예상금액 = 금액raw ? Math.round(Number(금액raw)) : null;
    const 마지막접촉일 = get(r, ci.마지막접촉일);
    const staleDays = daysSince(마지막접촉일);
    const stale = staleDays !== null && staleDays >= (STAGE_DAYS[단계] ?? Infinity);
    leads.push({
      id: get(r, ci.id) || `s${i}`, 대상: get(r, ci.대상), 단계, 다음액션: get(r, ci.다음액션),
      예상금액, 마지막접촉일, 비고: get(r, ci.비고), staleDays, stale,
    });
  }

  // 팔로업(stale) 오래된 순으로
  const followups = leads.filter((l) => l.stale).sort((a, b) => (b.staleDays ?? 0) - (a.staleDays ?? 0));
  // 단계 안에서도 stale 먼저, 그다음 오래된 순
  leads.sort((a, b) => (a.stale !== b.stale ? (a.stale ? -1 : 1) : (b.staleDays ?? 0) - (a.staleDays ?? 0)));

  const 단계수: Record<string, number> = {};
  ACTIVE.forEach((s) => { 단계수[s] = leads.filter((l) => l.단계 === s).length; });

  return {
    leads,
    followups,
    예상매출: leads.reduce((s, l) => s + (l.예상금액 ?? 0), 0),
    협의전: leads.filter((l) => l.예상금액 === null).length,
    단계수,
    source: 'sheet',
  };
}
