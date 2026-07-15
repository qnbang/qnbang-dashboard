import { listProjectRepos, updateProjectMeta } from './github';
import { getSheets, invalidateSheets } from './sheetCache';
import { sheetsWriteClient } from './sheets';
import { todayKST } from './date';
import { colLetter } from './sheetUtil';

// 깃 → 시트 자동 등록(클라우드 동기화) — "푸시하면 곧 카드가 된다".
// 원칙: 저장소 slug가 시트↔깃의 유일한 열쇠. 이름 추측은 등록 판단에만 쓰고, 결과는 항상 열쇠로 고정.
//  ① 저장소 칸에 이미 있는 repo → 통과
//  ② 이름(프로젝트/고객, 공백 제거)이 정확히 일치하는 행 1개 → 그 행에 저장소 칸만 채움(자가치유 — 소리쉼 사례)
//  ③ 유사 이름이 과업/아카이브에 있으면 → 등록 보류(추측으로 합치지 않음; 깃자동 섹션에 남아 사람이 결정)
//  ④ 아무 데도 없으면 → 새 과업 행 생성(저장소 칸 포함 18칸)
// 완료/폐기/중단/종료 상태 repo는 건너뜀. 멱등 — 두 번 돌려도 같은 결과.

const WRITE_URL = process.env.SHEET_WRITE_URL
  || 'https://script.google.com/macros/s/AKfycbxPt24eFUbUP1cPwsv5Gspc3pak_hvqIdGf7T4cbvqJSxKkKimCdEhxdSll0yMPJ5dPAw/exec';
const KEY = process.env.SHEET_KEY || 'qnbang2026';
const SHEET_ID = process.env.SHEET_ID;

// 프로젝트동기화.py 와 동일한 18칸(단일 진실원은 실제 시트 헤더지만, append는 이 순서로 매핑됨)
const HEADER = ['id', '프로젝트', '과업명', '담당자', '공위치', '현재상태', '다음할일',
  '기한', '고객', '돈종류', '할일', '판정근거', '갱신일', '출처', '계약여부', '분류', '메모', '저장소'];
const 공위치_LIST = ['받은일', '시작전', '내작업', '내회신', '고객대기', '보류', '완수'];
const SKIP_상태 = ['완료', '폐기', '중단', '종료'];
const STOP = new Set(['큐앤뱅', '프로젝트', '브랜딩', '디자인', '제안서']); // 느슨 매칭에서 무시할 일반어

const norm = (s: unknown) => String(s ?? '').replace(/\s+/g, '');
function words(s: unknown): Set<string> {
  return new Set(String(s ?? '').replace(/_/g, ' ').split(/\s+/).filter((w) => w.length >= 2 && !STOP.has(w)));
}
const overlap = (a: Set<string>, b: Set<string>) => [...a].some((w) => b.has(w));
function 공위치_from(진행: string | undefined): string {
  const p = 진행 || '';
  if (p.includes('피드백') || p.includes('대기')) return '고객대기';
  if (p.includes('진행')) return '내작업';
  return '시작전';
}

export type SyncResult = {
  통과: string[]; 연결: string[]; 신규: string[]; 완수처리: string[]; 보류: { repo: string; 사유: string }[];
};

export async function syncGitProjects(dry: boolean): Promise<SyncResult> {
  const repos = await listProjectRepos();
  const sheets = await getSheets();
  const rows = (sheets['과업'] as unknown[][]) || [];
  const head = ((rows[0] as unknown[]) || []).map((h) => String(h));
  const ci = { 프로젝트: head.indexOf('프로젝트'), 고객: head.indexOf('고객'), 저장소: head.indexOf('저장소') };
  if (ci.프로젝트 < 0 || ci.저장소 < 0) throw new Error('과업 시트에 프로젝트/저장소 칸이 없음');

  // 시트 행 인덱스(1-기준 실제 행번호) 함께 보존 — 저장소 칸 채울 때 필요
  const 행들 = rows.slice(1)
    .map((r, i) => ({ sheetRow: i + 2, r: r as unknown[] }))
    .filter(({ r }) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''));
  const 연결됨 = new Set(행들.map(({ r }) => String(r[ci.저장소] ?? '').trim()).filter(Boolean));

  const arc = (sheets['아카이브'] as unknown[][]) || [];
  const arcHead = ((arc[0] as unknown[]) || []).map((h) => String(h));
  const arcPi = arcHead.indexOf('프로젝트'); const arcGi = arcHead.indexOf('고객');
  const 아카이브단어 = arc.slice(1).map((r) => {
    const w = words(arcPi >= 0 ? (r as unknown[])[arcPi] : '');
    if (arcGi >= 0) for (const x of words((r as unknown[])[arcGi])) w.add(x);
    return w;
  }).filter((w) => w.size);
  // 아카이브 정확 일치용(공백 제거 이름) — 완수된 프로젝트의 깃 상태를 자동 정리할 때 사용
  const 아카이브이름 = new Set(arc.slice(1).flatMap((r) => [
    norm(arcPi >= 0 ? (r as unknown[])[arcPi] : ''), norm(arcGi >= 0 ? (r as unknown[])[arcGi] : ''),
  ]).filter(Boolean));

  const out: SyncResult = { 통과: [], 연결: [], 신규: [], 완수처리: [], 보류: [] };
  const today = todayKST();
  let changed = false;

  for (const p of repos) {
    if (SKIP_상태.some((s) => (p.progressStatus || '').includes(s))) continue;
    if (연결됨.has(p.repo)) { out.통과.push(p.repo); continue; }
    const t = norm(p.title);
    if (!t) { out.보류.push({ repo: p.repo, 사유: '프로젝트 이름 없음' }); continue; }

    // ② 정확 일치(프로젝트명 또는 고객명) — 1개면 그 행에 열쇠만 꽂음
    const strict = 행들.filter(({ r }) =>
      norm(r[ci.프로젝트]) === t || (ci.고객 >= 0 && norm(r[ci.고객]) === t && t !== ''));
    if (strict.length === 1) {
      if (!dry) {
        const api = sheetsWriteClient();
        await api.spreadsheets.values.update({
          spreadsheetId: SHEET_ID!, range: `과업!${colLetter(ci.저장소)}${strict[0].sheetRow}`,
          valueInputOption: 'RAW', requestBody: { values: [[p.repo]] },
        });
        changed = true;
      }
      out.연결.push(`${p.repo} → ${String(strict[0].r[ci.프로젝트])}`);
      연결됨.add(p.repo);
      continue;
    }
    if (strict.length > 1) { out.보류.push({ repo: p.repo, 사유: '같은 이름 행이 여러 개 — 사람이 골라야 함' }); continue; }

    // ③-1 아카이브 정확 일치 = 이미 완수한 프로젝트인데 깃 상태만 낡음 → 깃 프로젝트.json 진행상태를 완료로 자동 정리(화면에서 사라짐)
    if (아카이브이름.has(t)) {
      if (!dry) {
        try { await updateProjectMeta(p.repo, { 진행상태: '완료' }); }
        catch { out.보류.push({ repo: p.repo, 사유: '완수인데 깃 상태 정리 실패(다음 크론 재시도)' }); continue; }
      }
      out.완수처리.push(`${p.repo} → ${p.title} (아카이브 완수와 일치)`);
      continue;
    }
    // ③-2 느슨 매칭(단어 겹침) — 걸리면 추측 등록 금지, 보류
    const tw = words(p.title);
    if (아카이브단어.some((w) => overlap(tw, w))) { out.보류.push({ repo: p.repo, 사유: '아카이브에 유사 이름(완수 부활 방지)' }); continue; }
    const 유사 = 행들.find(({ r }) => overlap(tw, words(r[ci.프로젝트])) || (ci.고객 >= 0 && overlap(tw, words(r[ci.고객]))));
    if (유사) { out.보류.push({ repo: p.repo, 사유: `유사 이름 과업 있음(${String(유사.r[ci.프로젝트])}) — 확인 필요` }); continue; }

    // ④ 신규 등록 — 태어날 때부터 저장소 열쇠를 달고 등록
    const 행: Record<string, string> = {
      id: 'g' + today.replace(/-/g, '').slice(2) + '-' + p.repo.slice(-8),
      프로젝트: p.title, 과업명: '(프로젝트 등록)', 담당자: p.manager || '신종호',
      공위치: 공위치_from(p.progressStatus), 현재상태: p.progressStatus || '',
      다음할일: '', 기한: p.endDate || '', 고객: p.category === '대행' ? p.title : '',
      돈종류: p.category === '자체' ? '투자' : '매출', 할일: '', 판정근거: '',
      갱신일: today, 출처: '깃동기화', 계약여부: p.category === '대행' ? '영업' : '', // 새 대행은 영업 단계로 시작 → 영업중 칸에 뜸(계약되면 사람이 '진행'으로 변경)
      분류: p.category === '대행' ? '대행' : '', // 보드 분류 어휘(대행·도구·리서치·자체사업·내부)에 없는 '자체'는 기록 안 함(칩 필터 미아 방지)
      메모: '', 저장소: p.repo,
    };
    if (!dry) {
      const res = await fetch(WRITE_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: KEY, 종류: '과업', 헤더: HEADER, 행, 드롭다운: { 공위치: 공위치_LIST, 돈종류: ['매출', '투자'] } }),
      });
      const j = await res.json().catch(() => ({}));
      if (!j.ok) { out.보류.push({ repo: p.repo, 사유: '기록 실패: ' + (j.error || '?') }); continue; }
      changed = true;
    }
    out.신규.push(`${p.repo} → ${p.title}`);
    연결됨.add(p.repo);
  }

  if (changed) invalidateSheets();
  return out;
}
