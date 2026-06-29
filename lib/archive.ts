// 프로젝트 아카이브 — 매출(계약 원장)을 '프로젝트(계약명)' 기준으로 묶어 월별 게시판으로 만든다.
// 월 배치 = 계약일(프로젝트 시작 월). 자체/대행 = 매출 시트 '분류' 칸. 작업 내역 = 과업 시트.
// 흐름 체크(년·월별 매출) + 프로젝트별 매출·미수·작업 아카이빙이 목적.

import { getSheets } from './sheetCache';

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

function objs(sheet: unknown[][] | undefined): Record<string, string>[] {
  if (!Array.isArray(sheet) || sheet.length < 2) return [];
  const head = (sheet[0] as unknown[]).map((h) => String(h));
  return sheet.slice(1)
    .filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''))
    .map((r) => Object.fromEntries(head.map((h, i) => [h, String((r as unknown[])[i] ?? '').trim()])));
}

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

  // 아카이브(완수) 카드 중 매출 없는 것 추가
  for (const a of 아카이브) {
    const status = a['현재상태'] || '';
    if (status.includes('폐기')) continue;
    const base = baseName(a['프로젝트'] || a['과업명'] || '');
    if (!base) continue;
    // 기존 매출 프로젝트와 토큰 매칭 — 이미 있으면 스킵
    const T = toks(base + ' ' + (a['고객'] || ''));
    const matched = [...map.keys()].some((k) => {
      const K = toks(k); return K.some((kw) => T.some((t) => t === kw || (t.length >= 3 && kw.includes(t)) || (kw.length >= 3 && t.includes(kw))));
    });
    if (matched) continue;
    map.set('__arc__' + base, {
      name: base, client: a['고객'] || '', 분류: (a['고객'] ? '대행' : '자체') as '자체' | '대행',
      계약: 0, 입금: 0, 미수: 0, 건: 0, 월: ym(a['갱신일']) || '',
      작업: a['다음할일'] || a['할일'] || '', 상태: '완수', 링크: '', noRevenue: true,
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
