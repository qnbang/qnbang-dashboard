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
  프로젝트들?: { 이름: string; 금액: number; 미수: number }[];   // 고객의 프로젝트별 금액 — 카드 클릭 펼침용
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
  // 고객의 프로젝트별 {이름·금액·미수} — 매출 계약 우선, 매출 없는 과업(작업)은 금액 0으로 추가.
  const 프로젝트들of = (name: string, 과업이름: string[] = []) => {
    const list = 매출.filter((c) => same(name, c['클라이언트'] || c['계약명']))
      .map((c) => ({ 이름: c['계약명'], 금액: num(c['계약금액']), 미수: Math.max(0, num(c['계약금액']) - num(c['입금액'])) }));
    for (const pj of 과업이름) {
      if (pj && !list.some((x) => x.이름.includes(pj) || pj.includes(x.이름))) list.push({ 이름: pj, 금액: 0, 미수: 0 });
    }
    return list;
  };

  // 활성 과업을 '고객(회사)' 기준으로 묶고, 계약여부로 진행/영업 구분.
  const byClient: Record<string, CRMClient & { _진행?: boolean; _과업이름?: string[] }> = {};
  for (const t of 과업) {
    const 공 = t['공위치'];
    if (공 === '보류' || 공 === '완수') continue;
    if (t['돈종류'] === '투자' || t['계약여부'] === '내부') continue;   // 내부는 고객 아님
    const key = (t['고객'] || t['프로젝트'] || '').trim();
    if (!key) continue;
    const c = (byClient[key] ||= { 고객: key, 과업수: 0, 공위치: [], 담당: [], _과업이름: [], _진행: false });
    c.과업수! += 1;
    const pj = (t['프로젝트'] || t['과업명'] || '').trim();
    if (pj && !c._과업이름!.includes(pj)) c._과업이름!.push(pj);
    if (공 && !c.공위치!.includes(공)) c.공위치!.push(공);
    const o = t['담당자']; if (o && !c.담당!.includes(o)) c.담당!.push(o);
    if (t['계약여부'] === '진행' || t['계약여부'] === '완료') c._진행 = true;  // 한 건이라도 계약됐으면 진행
  }
  const 진행중: CRMClient[] = [];
  const 과업영업: CRMClient[] = [];
  for (const c of Object.values(byClient)) {
    const { _진행, _과업이름, ...rest } = c;
    if (_진행) 진행중.push({ ...rest, 계약금액: 계약of(c.고객), 미수: 미수of(c.고객), 프로젝트들: 프로젝트들of(c.고객, _과업이름) });
    else 과업영업.push({ 고객: c.고객, 단계: (c.공위치 && c.공위치[0]) || '제안', 예상금액: null, 담당: c.담당, 프로젝트들: 프로젝트들of(c.고객, _과업이름) });
  }
  진행중.sort((a, b) => (b.미수 ?? 0) - (a.미수 ?? 0));
  const 진행keys = new Set(진행중.map((c) => c.고객));

  // 영업중 = 영업 보드 리드 + 계약여부=영업인 과업(금문도·제주). 진행중과 중복 제외.
  const 영업리드 = 영업.filter((l) => ['접촉', '제안', '계약대기'].includes(l['단계']))
    .filter((l) => ![...진행keys].some((k) => same(k, l['대상'])))
    .map((l) => ({ 고객: l['대상'], 단계: l['단계'], 예상금액: l['예상금액'] ? num(l['예상금액']) : null, staleDays: null as number | null }));
  const 영업중 = [...영업리드, ...과업영업];
  const 영업keys = new Set(영업중.map((c) => c.고객));

  // 완수: 아카이브 고객 + 매출 입금완료 고객 중, 진행/영업에 없는 곳
  const 완수names = new Set<string>();
  for (const t of 아카이브) { const k = (t['고객'] || t['프로젝트'] || '').trim(); if (k) 완수names.add(k); }
  for (const c of 매출) { if (c['입금상태'] === '입금완료') { const k = (c['클라이언트'] || c['계약명']).trim(); if (k) 완수names.add(k); } }
  const 완수 = [...완수names]
    .filter((k) => ![...진행keys, ...영업keys].some((x) => same(x, k)))
    .map((k) => ({ 고객: k, 계약금액: 계약of(k), 미수: 미수of(k), 프로젝트들: 프로젝트들of(k) }))
    .sort((a, b) => (b.계약금액 ?? 0) - (a.계약금액 ?? 0));

  return { 영업중, 진행중, 완수, source: 'sheet' };
}
