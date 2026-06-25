import { NextResponse } from 'next/server';
import { invalidateSheets } from '@/lib/sheetCache';

export const dynamic = 'force-dynamic';

// 과업 완료(P5) — id로 과업 1건을 '완수' 처리해 아카이브 탭으로 이동.
// 자금기록기 엔드포인트는 단일행 수정이 없어: 과업 탭을 읽어 그 행만 빼고 '덮어쓰기'로 다시 쓰고,
// 뺀 행은 아카이브에 append. (솔로 사용 기준 안전.) 날짜는 ISO 왕복 손상 막게 KST YYYY-MM-DD로 정규화.
const READ_URL = process.env.SHEET_URL;
const WRITE_URL = process.env.SHEET_WRITE_URL
  || 'https://script.google.com/macros/s/AKfycbxPt24eFUbUP1cPwsv5Gspc3pak_hvqIdGf7T4cbvqJSxKkKimCdEhxdSll0yMPJ5dPAw/exec';
const KEY = process.env.SHEET_KEY || 'qnbang2026';
const HEADER = ['id', '프로젝트', '과업명', '담당자', '공위치', '현재상태', '다음할일',
  '기한', '고객', '돈종류', '할일', '판정근거', '갱신일', '출처', '계약여부'];
const 공위치_LIST = ['시작전', '내작업', '내회신', '고객대기', '보류', '완수'];
const 돈종류_LIST = ['매출', '투자'];

// ISO 날짜 셀(2026-07-03T15:00:00.000Z)을 KST YYYY-MM-DD로. 그 외 문자열은 그대로.
function normCell(v: unknown): string {
  const s = String(v ?? '');
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  }
  return s;
}
function todayKST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

async function postSheet(body: object) {
  const res = await fetch(WRITE_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return res.json().catch(() => ({}));
}

export async function POST(req: Request) {
  try {
    const { id, 사유 } = await req.json().catch(() => ({})); // 사유='폐기' 등 — 있으면 아카이브 행 현재상태에 표시(완수와 구분)
    if (!id || !READ_URL) return NextResponse.json({ ok: false, error: 'id 필요' }, { status: 400 });

    const j = await (await fetch(`${READ_URL}?key=${encodeURIComponent(KEY)}`, { cache: 'no-store' })).json();
    const rows: unknown[][] = j?.sheets?.['과업'];
    if (!Array.isArray(rows) || rows.length < 2) return NextResponse.json({ ok: false, error: '과업 탭 못읽음' }, { status: 502 });

    const head = (rows[0] as unknown[]).map((h) => String(h));
    const idIdx = head.indexOf('id');
    const data = rows.slice(1).filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''));
    // 안전장치: 읽기가 비정상적으로 적게 돌아오면 전체 덮어쓰기 중단 — 대량 유실 방지.
    if (data.length < 5) return NextResponse.json({ ok: false, error: `과업이 ${data.length}건만 읽혀 저장을 막았어요(읽기 오류 의심). 잠시 후 다시 시도하세요.` }, { status: 503 });
    const target = data.find((r) => String(r[idIdx]) === String(id));
    if (!target) return NextResponse.json({ ok: false, error: '해당 과업 없음: ' + id }, { status: 404 });

    // 남길 active 행들 — ⚠️ 실제 시트 헤더(head) 전체 폭으로 보존. HEADER(15칸)로 자르면 분류·메모(16·17칸)가 매 완수마다 날아감.
    const active = data.filter((r) => String(r[idIdx]) !== String(id))
      .map((r) => head.map((_, i) => normCell(r[i])));

    // 완수 행(객체) — 실제 헤더 기준, 공위치=완수, 갱신일=오늘
    const done: Record<string, string> = {};
    head.forEach((h, i) => { done[h] = normCell(target[i]); });
    done['공위치'] = '완수';
    if (사유) done['현재상태'] = String(사유); // 폐기(접음)면 사유로 덮어 — 아카이브에서 완수/폐기 구분
    done['갱신일'] = todayKST();

    // 과업 탭 = active만 다시(덮어쓰기) — 실제 헤더로 써서 칼럼 보존 → 아카이브에 완수행 append
    const r1 = await postSheet({ key: KEY, 종류: '과업', 헤더: head, 행들: active, 드롭다운: { 공위치: 공위치_LIST, 돈종류: 돈종류_LIST }, 덮어쓰기: true });
    const r2 = await postSheet({ key: KEY, 종류: '아카이브', 헤더: HEADER, 행: done });
    if (!r1.ok || !r2.ok) return NextResponse.json({ ok: false, error: '이동 실패', r1, r2 }, { status: 502 });
    invalidateSheets(); // 이동 즉시 반영
    return NextResponse.json({ ok: true, archived: done['과업명'] || done['프로젝트'], 과업남음: active.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
