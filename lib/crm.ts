// 고객 관리(CRM) — 영업/과업/매출/아카이브를 '고객(회사)' 기준으로 묶어 생애주기로 본다.
//
// 판단 기준:
//   진행중  = 과업 시트에 고객명 있는 활성 과업(완수/보류 제외)이 하나라도 있는 고객
//   영업중  = 영업 리드 시트에만 있고 활성 과업이 없는 신규 고객
//   완수    = 과업이 다 끝나고 진행/영업에도 없는 고객
//
// (계약여부 필드는 판단에 사용하지 않음 — 데이터 입력 여부로 분류가 바뀌던 버그 제거)
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
  단계?: string;
  예상금액?: number | null;
  과업수?: number;
  프로젝트들?: { 이름: string; 금액: number; 미수: number; 단계?: string }[];
  공위치?: string[];
  담당?: string[];
  계약금액?: number;
  미수?: number;
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

  const sq = (s: string) => String(s || '').replace(/\s+/g, '');

  // 프로젝트별 '지금 단계' (할일 첫 미완료 → 다음할일 → 현재상태)
  const stepOf = (t: Record<string, unknown>) => {
    const steps = String(t['할일'] || '').split(';').map((s) => s.trim()).filter(Boolean);
    const undone = steps.find((s) => !s.startsWith('✓'));
    return (undone || String(t['다음할일'] || '').trim() || String(t['현재상태'] || '').trim()).trim();
  };
  const 프로젝트단계: Record<string, string> = {};
  for (const t of 과업) {
    if (t['공위치'] === '완수' || t['공위치'] === '보류') continue;
    const pj = sq(t['프로젝트'] || t['과업명'] || '');
    const st = stepOf(t);
    if (pj && st && !프로젝트단계[pj]) 프로젝트단계[pj] = st;
  }

  const 미수of = (name: string) => 매출.filter((c) => same(name, c['클라이언트'] || c['계약명']))
    .reduce((s, c) => s + Math.max(0, num(c['계약금액']) - num(c['입금액'])), 0);
  const 계약of = (name: string) => 매출.filter((c) => same(name, c['클라이언트'] || c['계약명']))
    .reduce((s, c) => s + num(c['계약금액']), 0);
  const 프로젝트들of = (name: string, 과업이름: string[] = []) => {
    const list = 매출.filter((c) => same(name, c['클라이언트'] || c['계약명']))
      .map((c) => ({ 이름: c['계약명'], 금액: num(c['계약금액']), 미수: Math.max(0, num(c['계약금액']) - num(c['입금액'])), 단계: 프로젝트단계[sq(c['계약명'])] }));
    for (const pj of 과업이름) {
      if (pj && !list.some((x) => x.이름.includes(pj) || pj.includes(x.이름)))
        list.push({ 이름: pj, 금액: 0, 미수: 0, 단계: 프로젝트단계[sq(pj)] });
    }
    return list;
  };

  // ── 진행중: 고객명 있는 활성 과업이 하나라도 있으면 무조건 진행중 ──
  const byClient: Record<string, { 고객: string; 과업수: number; 공위치: string[]; 담당: string[]; 이름들: string[] }> = {};
  for (const t of 과업) {
    const 공 = t['공위치'];
    if (공 === '완수' || 공 === '보류') continue;
    if (t['돈종류'] === '투자') continue; // 내부 투자성 제외 (자체 개발 등)
    const key = t['고객'].trim();
    if (!key) continue; // 고객명 없으면 CRM 제외 (내부 과업)
    const c = (byClient[key] ||= { 고객: key, 과업수: 0, 공위치: [], 담당: [], 이름들: [] });
    c.과업수 += 1;
    const pj = (t['프로젝트'] || t['과업명'] || '').trim();
    if (pj && !c.이름들.includes(pj)) c.이름들.push(pj);
    if (공 && !c.공위치.includes(공)) c.공위치.push(공);
    const o = t['담당자']; if (o && !c.담당.includes(o)) c.담당.push(o);
  }
  const 진행중: CRMClient[] = Object.values(byClient).map((c) => ({
    고객: c.고객, 과업수: c.과업수, 공위치: c.공위치, 담당: c.담당,
    계약금액: 계약of(c.고객), 미수: 미수of(c.고객),
    프로젝트들: 프로젝트들of(c.고객, c.이름들),
  })).sort((a, b) => (b.미수 ?? 0) - (a.미수 ?? 0));
  const 진행keys = new Set(진행중.map((c) => c.고객));

  // ── 영업중: 영업 리드에만 있고 활성 과업 없는 신규 고객만 ──
  const 영업중: CRMClient[] = 영업
    .filter((l) => ['접촉', '제안', '계약대기'].includes(l['단계']))
    .filter((l) => ![...진행keys].some((k) => same(k, l['대상'])))
    .map((l) => ({ 고객: l['대상'], 단계: l['단계'], 예상금액: l['예상금액'] ? num(l['예상금액']) : null, staleDays: null as number | null }));
  const 영업keys = new Set(영업중.map((c) => c.고객));

  // ── 완수: 아카이브·입금완료 고객 중 진행/영업에 없는 곳 ──
  const 완수names = new Set<string>();
  for (const t of 아카이브) { const k = (t['고객'] || t['프로젝트'] || '').trim(); if (k) 완수names.add(k); }
  for (const c of 매출) { if (c['입금상태'] === '입금완료') { const k = (c['클라이언트'] || c['계약명']).trim(); if (k) 완수names.add(k); } }
  const 완수: CRMClient[] = [...완수names]
    .filter((k) => ![...진행keys, ...영업keys].some((x) => same(x, k)))
    .map((k) => ({ 고객: k, 계약금액: 계약of(k), 미수: 미수of(k), 프로젝트들: 프로젝트들of(k) }))
    .sort((a, b) => (b.계약금액 ?? 0) - (a.계약금액 ?? 0));

  return { 영업중, 진행중, 완수, source: 'sheet' };
}
