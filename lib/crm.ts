// 고객 관리(CRM) — 영업/과업/매출/아카이브를 '고객(회사)' 기준으로 묶어 생애주기로 본다.
//
// 판단 기준:
//   영업중  = 계약여부='영업'인 활성 과업 고객 + 영업 리드 시트(진행중과 중복 제외)
//   진행중  = 그 외 활성 과업(완수/보류 제외, 고객명 있음, 자체 제외) 고객
//   완수    = 과업이 다 끝나고 진행/영업에도 없는 고객
//
// 영업↔진행 판정: ①계약여부에 '진행/완료' 등 명시값 → 진행중  ②매출 탭에 계약금 잡힘 → 진행중(자동)  ③그 외(계약여부='영업' 또는 빈칸+매출없음) → 영업중.
// 새 대행은 gitSync가 계약여부='영업'으로 등록해 영업중에서 시작하고, 계약금이 매출에 잡히는 순간 자동으로 진행중이 된다(계약여부 수동수정 불필요).
// 계약여부 빈칸(사람이 영업/진행을 명시 안 함)인 고객은 미표시 플래그가 붙어 화면에 '미표시' 배지로 드러난다.
import { getSheets } from './sheetCache';
import { sheetToObjects } from './sheetUtil';

const num = (v: unknown) => Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;
const objs = sheetToObjects;

// 고객명 매칭 — 공백 무시 + 접미 차이 흡수(소리쉼↔소리쉼티, 김창수 위스키↔김창수위스키증류소, 사단법인점프↔사단법인 점프).
// 짧은 쪽(3글자 이상)이 긴 쪽에 포함되면 같은 고객. 2글자 과병합 방지 가드.
function same(a: string, b: string): boolean {
  a = (a || '').replace(/\s+/g, ''); b = (b || '').replace(/\s+/g, '');
  if (!a || !b) return false;
  if (a === b) return true;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  return s.length >= 3 && l.includes(s);
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
  미표시?: boolean; // 계약여부 칸이 빈칸 = 사람이 영업/진행을 명시 안 함(매출로 자동 추정된 상태)
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

  // ── 활성 과업을 고객 기준으로 묶기 ──
  // 고객명 비어있으면 CRM 제외(내부 과업). 계약여부로 진행중/영업중 구분.
  const byClient: Record<string, { 고객: string; 과업수: number; 공위치: string[]; 담당: string[]; 이름들: string[]; _진행: boolean; _표시됨: boolean }> = {};
  for (const t of 과업) {
    const 공 = t['공위치'];
    if (공 === '완수' || 공 === '보류') continue;
    if (t['돈종류'] === '투자' || t['분류'] === '자체' || t['고객'] === '자체') continue; // 자체 프로젝트(반보 등)는 고객 아님 → CRM 제외. 고객 칸에 '자체'라 직접 적힌 오염 행도 방어.
    const key = t['고객'].trim();
    if (!key) continue; // 고객명 없으면 CRM 제외
    const c = (byClient[key] ||= { 고객: key, 과업수: 0, 공위치: [], 담당: [], 이름들: [], _진행: false, _표시됨: false });
    c.과업수 += 1;
    const pj = (t['프로젝트'] || t['과업명'] || '').trim();
    if (pj && !c.이름들.includes(pj)) c.이름들.push(pj);
    if (공 && !c.공위치.includes(공)) c.공위치.push(공);
    const o = t['담당자']; if (o && !c.담당.includes(o)) c.담당.push(o);
    // 계약여부에 '영업' 아닌 명시값(진행/완료 등) → 확정 진행. 빈칸은 아래에서 매출로 자동 판정.
    if (t['계약여부'] && t['계약여부'] !== '영업') c._진행 = true;
    if (t['계약여부']) c._표시됨 = true; // 사람이 영업/진행을 직접 표시함(빈칸이면 미표시 → 매출로 추정)
  }

  const 진행중: CRMClient[] = [];
  const 과업영업: CRMClient[] = []; // 과업 있지만 계약 전(영업 단계)
  for (const c of Object.values(byClient)) {
    const 계약 = 계약of(c.고객);
    const 미표시 = !c._표시됨;
    if (c._진행 || 계약 > 0) { // 명시 진행값 or 매출(계약금) 잡힘 → 진행중 자동 판정
      진행중.push({ 고객: c.고객, 과업수: c.과업수, 공위치: c.공위치, 담당: c.담당, 계약금액: 계약, 미수: 미수of(c.고객), 프로젝트들: 프로젝트들of(c.고객, c.이름들), 미표시 });
    } else {
      과업영업.push({ 고객: c.고객, 단계: c.공위치[0] || '제안', 담당: c.담당, 프로젝트들: 프로젝트들of(c.고객, c.이름들), 미표시 });
    }
  }
  진행중.sort((a, b) => (b.미수 ?? 0) - (a.미수 ?? 0));
  const 진행keys = new Set(진행중.map((c) => c.고객));

  // ── 영업중: 영업 리드 + 계약 전 과업 고객 (진행중과 중복 제외) ──
  const 영업리드 = 영업
    .filter((l) => ['접촉', '제안', '계약대기'].includes(l['단계']))
    .filter((l) => ![...진행keys].some((k) => same(k, l['대상'])))
    .map((l) => ({ 고객: l['대상'], 단계: l['단계'], 예상금액: l['예상금액'] ? num(l['예상금액']) : null, staleDays: null as number | null }));
  const 영업중 = [...영업리드, ...과업영업.filter((c) => ![...진행keys].some((k) => same(k, c.고객)))];
  const 영업keys = new Set(영업중.map((c) => c.고객));

  // ── 완수: 아카이브·입금완료 고객 중 진행/영업에 없는 곳 ──
  const 완수names = new Set<string>();
  // 고객명 있는 것만 = 완수 '고객'. 프로젝트명 폴백 제거(고객 없는 내부 프로젝트가 가짜 고객으로 둔갑하던 버그).
  // 폐기·보류로 접힌 건은 완수가 아님(2026-07-12: 금문도 "폐기(접음)"가 완수 고객으로 둔갑하던 버그 —
  // 아카이브의 공위치는 넘길 때 관행상 "완수"로 오염돼 있어 자유텍스트 현재상태로 거른다).
  for (const t of 아카이브) {
    const k = (t['고객'] || '').trim();
    if (!k) continue;
    if (/폐기|보류|드롭|접음|중단/.test(t['현재상태'] || '')) continue;
    완수names.add(k);
  }
  for (const c of 매출) { if (c['입금상태'] === '입금완료' && c['분류'] !== '자체') { const k = (c['클라이언트'] || '').trim(); if (k) 완수names.add(k); } }
  const 완수후보 = [...완수names]
    .filter((k) => !/^_|테스트|삭제예정|검증/.test(k)) // 테스트·삭제예정 등 잡 데이터 제외
    .filter((k) => ![...진행keys, ...영업keys].some((x) => same(x, k)));
  // 완수 안에서도 같은 고객 다른 표기(사단법인점프↔사단법인 점프) 합치기 — 먼저 들어온 표기 유지
  const 완수keys: string[] = [];
  for (const k of 완수후보) if (!완수keys.some((x) => same(x, k))) 완수keys.push(k);
  const 완수: CRMClient[] = 완수keys
    .map((k) => ({ 고객: k, 계약금액: 계약of(k), 미수: 미수of(k), 프로젝트들: 프로젝트들of(k) }))
    .sort((a, b) => (b.계약금액 ?? 0) - (a.계약금액 ?? 0));

  return { 영업중, 진행중, 완수, source: 'sheet' };
}
