// 고객 관리(CRM, #5) — 영업/과업/매출/아카이브를 '고객' 기준으로 묶어 생애주기로 본다.
// 영업 대기중 → 계약 진행중 → 완수한 고객. (영업을 따로 두지 않고 고객 안에 녹임)
import { getSheets } from './sheetCache';

const num = (v: unknown) => Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;

function objs(sheet: unknown[][] | undefined): Record<string, string>[] {
  if (!Array.isArray(sheet) || sheet.length < 2) return [];
  const head = (sheet[0] as unknown[]).map((h) => String(h));
  return sheet.slice(1)
    .filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''))
    .map((r) => Object.fromEntries(head.map((h, i) => [h, String((r as unknown[])[i] ?? '').trim()])));
}
// 고객명 매칭 — 공백/접미 차이 흡수(소리쉼↔소리쉼티). 빈 값은 매칭 안 함.
function same(a: string, b: string): boolean {
  a = (a || '').trim(); b = (b || '').trim();
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  return a.split(/\s+/)[0] === b.split(/\s+/)[0];
}

export interface CRMClient {
  고객: string;
  단계?: string;          // 영업 단계(영업중일 때)
  예상금액?: number | null;
  과업수?: number;         // 진행중 과업 수
  공위치?: string[];
  담당?: string[];
  계약금액?: number;       // 매출 계약 합
  미수?: number;           // 미수금
  staleDays?: number | null;
}
export interface CRMData {
  영업중: CRMClient[];
  진행중: CRMClient[];
  완수: CRMClient[];
  source: 'sheet' | 'unavailable';
}

export async function buildCRM(): Promise<CRMData> {
  let sh: Record<string, unknown[][]>;
  try { sh = await getSheets(); } catch { return { 영업중: [], 진행중: [], 완수: [], source: 'unavailable' }; }

  const 영업 = objs(sh['영업']);
  const 과업 = objs(sh['과업']);
  const 매출 = objs(sh['매출']);
  const 아카이브 = objs(sh['아카이브']);

  const 미수of = (name: string) => 매출.filter((c) => same(name, c['클라이언트'] || c['계약명']))
    .reduce((s, c) => s + Math.max(0, num(c['계약금액']) - num(c['입금액'])), 0);
  const 계약of = (name: string) => 매출.filter((c) => same(name, c['클라이언트'] || c['계약명']))
    .reduce((s, c) => s + num(c['계약금액']), 0);

  // 진행중: 보류·완수 아닌 과업을 고객(없으면 프로젝트)으로 묶음
  const 진행: Record<string, CRMClient> = {};
  for (const t of 과업) {
    const 공 = t['공위치'];
    if (공 === '보류' || 공 === '완수') continue;
    const key = (t['고객'] || t['프로젝트'] || '').trim();
    if (!key) continue;
    const c = (진행[key] ||= { 고객: key, 과업수: 0, 공위치: [], 담당: [] });
    c.과업수! += 1;
    if (공 && !c.공위치!.includes(공)) c.공위치!.push(공);
    const o = t['담당자']; if (o && !c.담당!.includes(o)) c.담당!.push(o);
  }
  const 진행중 = Object.values(진행).map((c) => ({ ...c, 계약금액: 계약of(c.고객), 미수: 미수of(c.고객) }))
    .sort((a, b) => (b.미수 ?? 0) - (a.미수 ?? 0));
  const 진행keys = new Set(진행중.map((c) => c.고객));

  // 영업중: 영업 보드 active 단계(진행중에 이미 있으면 제외)
  const 영업중 = 영업.filter((l) => ['접촉', '제안', '계약대기'].includes(l['단계']))
    .filter((l) => ![...진행keys].some((k) => same(k, l['대상'])))
    .map((l) => ({
      고객: l['대상'], 단계: l['단계'],
      예상금액: l['예상금액'] ? num(l['예상금액']) : null,
      staleDays: null as number | null,
    }));
  const 영업keys = new Set(영업중.map((c) => c.고객));

  // 완수: 아카이브 고객 + 매출 입금완료 고객 중, 진행/영업에 없는 곳
  const 완수names = new Set<string>();
  for (const t of 아카이브) { const k = (t['고객'] || t['프로젝트'] || '').trim(); if (k) 완수names.add(k); }
  for (const c of 매출) { if (c['입금상태'] === '입금완료') { const k = (c['클라이언트'] || c['계약명']).trim(); if (k) 완수names.add(k); } }
  const 완수 = [...완수names]
    .filter((k) => ![...진행keys, ...영업keys].some((x) => same(x, k)))
    .map((k) => ({ 고객: k, 계약금액: 계약of(k), 미수: 미수of(k) }))
    .sort((a, b) => (b.계약금액 ?? 0) - (a.계약금액 ?? 0));

  return { 영업중, 진행중, 완수, source: 'sheet' };
}
