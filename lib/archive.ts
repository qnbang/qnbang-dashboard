// 프로젝트 아카이브 — 매출(계약 원장)을 '프로젝트(계약명)' 기준으로 묶어 월별 게시판으로 만든다.
// 월 배치 = 계약일(프로젝트 시작 월). 계약일 없는 카드는 id에 박힌 생성일(첫 기록일)로, 그것도 없으면 갱신일로 폴백. 자체/대행 = 매출 시트 '분류' 칸. 작업 내역 = 과업 시트.
// 흐름 체크(년·월별 매출) + 프로젝트별 매출·미수·작업 아카이빙이 목적.

import { getSheets } from './sheetCache';
import { sheetToObjects } from './sheetUtil';

const num = (v: unknown) => Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;

// 계약명에서 (선금)·(잔금)·(N차)·(이름) 같은 꼬리표를 떼 프로젝트 본명으로
function baseName(name: string): string {
  let s = String(name || '').trim();
  s = s.replace(/\s*\((선금|잔금|\d+차|마지막|.*환불.*|실참가|이름.*)\)/g, '').trim();
  s = s.replace(/\s*\(.*?\)\s*$/, '').trim();
  return s || String(name || '').trim();
}

// 날짜 → YYYY-MM (대시·슬래시·점 구분자 모두 처리)
function ym(d: unknown): string {
  const m = String(d ?? '').replace(/[./]/g, '-').match(/(\d{4})-(\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}` : '';
}

// id에 박힌 생성일(dYYMMDD / gitYYMMDD…) → YYYY-MM. 계약일 없는 카드의 '첫 기록일(시작월)'로 씀.
// ponytail: q13 같은 옛 id는 날짜가 없어 빈값 → 호출부에서 갱신일로 폴백.
function idYm(id: unknown): string {
  const m = String(id ?? '').match(/^[a-z]*(\d{2})(\d{2})(\d{2})/);
  return m ? `20${m[1]}-${m[2]}` : '';
}

export interface ArchiveProject {
  name: string;
  client: string;
  분류: '자체' | '대행';
  계약: number;
  입금: number;
  미수: number;
  건: number;
  월: string;          // YYYY-MM (계약일 기준)
  작업: string;        // 과업 시트 할일/현재상태 (작업 내역)
  상태: string;        // 진행 단계
  링크: string;        // 과업 시트 메모 칼럼 (드라이브/피그마 등 URL)
  noRevenue?: boolean; // 매출 시트 기록 없음 — 사무실 완수 카드만 있는 경우
}
export interface ArchiveMonth { 월: string; label: string; 계약: number; 입금: number; 미수: number; projects: ArchiveProject[]; }
export interface ArchiveData {
  months: ArchiveMonth[];
  연도흐름: { 월: string; 입금: number; 미수: number }[];  // 올해 1~12월
  source: 'sheet' | 'unavailable';
}

const objs = sheetToObjects;

export async function buildArchive(): Promise<ArchiveData> {
  let sh: Record<string, unknown[][]>;
  try { sh = await getSheets(); } catch { return { months: [], 연도흐름: [], source: 'unavailable' }; }

  const 매출 = objs(sh['매출']);
  const 과업 = objs(sh['과업']);
  const 아카이브 = objs(sh['아카이브']);

  // 과업: 프로젝트명·고객 → 작업 내역. 매출 프로젝트명/클라이언트와 '핵심 단어'로 매칭(흔한 단어 제외)
  const 과업목록 = 과업.map((t) => ({
    프로젝트: t['프로젝트'] || t['과업명'] || '', 고객: t['고객'] || '',
    작업: t['할일'] || t['다음할일'] || '', 상태: t['현재상태'] || '',
    링크: t['메모'] || '',
  })).filter((t) => t.프로젝트);
  const STOP = new Set(['디자인', '제작', '개발', '작업', '대행', '프로젝트', '보고서', '인쇄', '발주', '정기', '콘텐츠', '브랜딩', '리서치', '키비주얼', '제안서']);
  const toks = (s: string) => (String(s).match(/[가-힣]{2,}|[A-Za-z]{3,}/g) || []).filter((w) => !STOP.has(w));
  const 작업of = (name: string, client: string) => {
    const T = toks(name + ' ' + client);
    for (const t of 과업목록) {
      const P = toks(t.프로젝트 + ' ' + t.고객);
      if (P.some((p) => T.some((x) => x === p || (x.length >= 3 && p.includes(x)) || (p.length >= 3 && x.includes(p))))) {
        return { 작업: t.작업, 상태: t.상태, 링크: t.링크 };
      }
    }
    return { 작업: '', 상태: '', 링크: '' };
  };

  // 매출을 프로젝트(본명)로 묶기
  const map = new Map<string, ArchiveProject>();
  for (const c of 매출) {
    const base = baseName(c['계약명']);
    if (!base) continue;
    const cur = map.get(base) || {
      name: base, client: c['클라이언트'] || '', 분류: (c['분류'] === '자체' ? '자체' : '대행') as '자체' | '대행',
      계약: 0, 입금: 0, 미수: 0, 건: 0, 월: '', 작업: '', 상태: '', 링크: '',
    };
    cur.계약 += num(c['계약금액']);
    cur.입금 += num(c['입금액']);
    cur.건 += 1;
    if (c['분류'] === '자체') cur.분류 = '자체';
    const mm = ym(c['계약일']);
    if (mm && (!cur.월 || mm < cur.월)) cur.월 = mm;  // 가장 이른 계약월
    map.set(base, cur);
  }

  // 매출 안 나는 컨테이너(도구·리서치·자체사업)는 프로젝트 탭 아닌 자체사업 탭·게시판 소관 (2026-07-09 개편)
  const NON_REV = new Set(['도구', '리서치', '자체사업']);

  // 아카이브(완수) 카드 중 매출 없는 것 추가
  for (const a of 아카이브) {
    const status = a['현재상태'] || '';
    if (status.includes('폐기')) continue;
    if (a['출처'] === '단건할일') continue; // 잡일(월세 입금 등) — 프로젝트 아니므로 매출 집계 후보에서 제외
    if (NON_REV.has(a['분류'] || '')) continue;
    if (!a['고객']) continue; // 고객 없는 내부성 카드 — "매출 미입력" 리마인더는 대행 일에만 의미
    const base = baseName(a['프로젝트'] || '');  // 과업명 폴백 제거 — 명시된 프로젝트만
    if (!base) continue;
    // 기존 매출 프로젝트와 토큰 매칭 — 이미 있으면 스킵
    const T = toks(base + ' ' + (a['고객'] || ''));
    const matched = [...map.keys()].some((k) => {
      const K = toks(k); return K.some((kw) => T.some((t) => t === kw || (t.length >= 3 && kw.includes(t)) || (kw.length >= 3 && t.includes(kw))));
    });
    if (matched) continue;
    map.set('__arc__' + base, {
      name: base, client: a['고객'] || '', 분류: (a['고객'] ? '대행' : '자체') as '자체' | '대행',
      계약: 0, 입금: 0, 미수: 0, 건: 0, 월: idYm(a['id']) || ym(a['갱신일']),
      작업: a['다음할일'] || a['할일'] || '', 상태: '완수', 링크: '', noRevenue: true,
    });
  }

  // 과업(진행 중) 중 매출 없는 것 추가 — 완수·보류 제외, 프로젝트명으로 묶어 대표 1행
  const 과업프로젝트 = new Map<string, Record<string, string>>();
  for (const t of 과업) {
    const 공위치 = t['공위치'] || '';
    if (공위치 === '완수' || 공위치 === '보류') continue;
    if (!t['계약여부'] || t['계약여부'] === '영업') continue;  // 계약 없는 운영성 과업 제외
    if (NON_REV.has(t['분류'] || '')) continue;
    if (!t['고객']) continue; // 고객 없는 내부성 과업 — 매출 리마인더 대상 아님
    const base = baseName(t['프로젝트'] || '');  // 과업명 폴백 제거
    if (!base || 과업프로젝트.has(base)) continue;
    과업프로젝트.set(base, t);
  }
  for (const [base, t] of 과업프로젝트) {
    const T = toks(base + ' ' + (t['고객'] || ''));
    const matched = [...map.keys()].some((k) => {
      const K = toks(k.replace(/^__(?:arc|wip)__/, ''));
      return K.some((kw) => T.some((x) => x === kw || (x.length >= 3 && kw.includes(x)) || (kw.length >= 3 && x.includes(kw))));
    });
    if (matched) continue;
    map.set('__wip__' + base, {
      name: base, client: t['고객'] || '', 분류: (t['고객'] ? '대행' : '자체') as '자체' | '대행',
      계약: 0, 입금: 0, 미수: 0, 건: 0, 월: idYm(t['id']) || ym(t['갱신일']),
      작업: t['다음할일'] || t['할일'] || '', 상태: t['공위치'] || '진행 중', 링크: t['메모'] || '', noRevenue: true,
    });
  }

  // 미수·작업 채우기
  const projects = [...map.values()].map((p) => {
    const w = 작업of(p.name, p.client);
    return { ...p, 미수: Math.max(0, p.계약 - p.입금), 작업: w.작업, 상태: w.상태, 링크: w.링크 };
  });

  // 월별 그룹핑 (계약월 없으면 '미정')
  const byMonth = new Map<string, ArchiveProject[]>();
  for (const p of projects) {
    const k = p.월 || '미정';
    (byMonth.get(k) || byMonth.set(k, []).get(k)!).push(p);
  }
  const months: ArchiveMonth[] = [...byMonth.keys()]
    .filter((m) => m !== '미정')
    .sort((a, b) => b.localeCompare(a))  // 최신월 먼저
    .map((m) => {
      const ps = byMonth.get(m)!.sort((a, b) => b.계약 - a.계약);
      const yy = m.slice(0, 4), mm = parseInt(m.slice(5, 7));
      return {
        월: m, label: yy === String(new Date().getFullYear()) ? `${mm}월` : `${yy.slice(2)}.${mm}월`,
        계약: ps.reduce((s, p) => s + p.계약, 0),
        입금: ps.reduce((s, p) => s + p.입금, 0),
        미수: ps.reduce((s, p) => s + p.미수, 0),
        projects: ps,
      };
    });
  const 미정 = byMonth.get('미정');
  if (미정 && 미정.length) {
    months.push({ 월: '미정', label: '날짜 미정', 계약: 미정.reduce((s, p) => s + p.계약, 0), 입금: 미정.reduce((s, p) => s + p.입금, 0), 미수: 미정.reduce((s, p) => s + p.미수, 0), projects: 미정 });
  }

  // 올해 1~12월 흐름
  const yr = String(new Date().getFullYear());
  const 연도흐름 = Array.from({ length: 12 }, (_, i) => {
    const key = `${yr}-${String(i + 1).padStart(2, '0')}`;
    const mm = months.find((x) => x.월 === key);
    return { 월: key, 입금: mm?.입금 ?? 0, 미수: mm?.미수 ?? 0 };
  });

  return { months, 연도흐름, source: 'sheet' };
}
