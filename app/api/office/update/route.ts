import { NextResponse } from 'next/server';
import { invalidateSheets } from '@/lib/sheetCache';

export const dynamic = 'force-dynamic';

// 과업 수정/삭제(P9).
// 수정 = '수정' 라우트(셀 하나만, 읽기 없음 → 빠름). 삭제만 읽기→해당 행 빼고 덮어쓰기(드물어 그대로).
const READ_URL = process.env.SHEET_URL;
const WRITE_URL = process.env.SHEET_WRITE_URL
  || 'https://script.google.com/macros/s/AKfycbxPt24eFUbUP1cPwsv5Gspc3pak_hvqIdGf7T4cbvqJSxKkKimCdEhxdSll0yMPJ5dPAw/exec';
const KEY = process.env.SHEET_KEY || 'qnbang2026';
const HEADER = ['id', '프로젝트', '과업명', '담당자', '공위치', '현재상태', '다음할일',
  '기한', '고객', '돈종류', '할일', '판정근거', '갱신일', '출처', '계약여부'];
const PATCHABLE = ['프로젝트', '과업명', '담당자', '공위치', '현재상태', '다음할일', '기한', '고객', '돈종류', '할일', '메모'];

function normCell(v: unknown): string {
  const s = String(v ?? '');
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  }
  return s;
}
function todayKST() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }); }
async function w(body: Record<string, unknown>) {
  const r = await fetch(WRITE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json().catch(() => ({} as { ok?: boolean; error?: string }));
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id, patch, delete: del } = body;
    if (!id) return NextResponse.json({ ok: false, error: 'id 필요' }, { status: 400 });

    // ── 수정: 읽기 없이 셀만 고침(빠름) ──
    if (!del) {
      if (!patch || typeof patch !== 'object') return NextResponse.json({ ok: false, error: 'patch 필요' }, { status: 400 });
      const 값: Record<string, string> = {};
      for (const k of PATCHABLE) if (k in patch) 값[k] = String(patch[k] ?? '');
      값['갱신일'] = todayKST();
      const u = await w({ key: KEY, 종류: '과업', 수정: { id, 값 } });
      if (!u.ok) return NextResponse.json({ ok: false, error: u.error || '저장 실패' }, { status: 502 });
      invalidateSheets();
      return NextResponse.json({ ok: true, action: 'updated' });
    }

    // ── 삭제: 읽기→해당 행 빼고 덮어쓰기(가드: 비정상적으로 적게 읽히면 중단) ──
    if (!READ_URL) return NextResponse.json({ ok: false, error: 'READ 미설정' }, { status: 500 });
    const j = await (await fetch(`${READ_URL}?key=${encodeURIComponent(KEY)}`, { cache: 'no-store' })).json();
    const rows: unknown[][] = j?.sheets?.['과업'];
    if (!Array.isArray(rows) || rows.length < 2) return NextResponse.json({ ok: false, error: '과업 탭 못읽음' }, { status: 502 });
    const head = (rows[0] as unknown[]).map((h) => String(h));
    const idIdx = head.indexOf('id');
    const data = rows.slice(1).filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''));
    if (data.length < 5) return NextResponse.json({ ok: false, error: `과업이 ${data.length}건만 읽혀 저장을 막았어요.` }, { status: 503 });
    if (!data.some((r) => String(r[idIdx]) === String(id))) return NextResponse.json({ ok: false, error: '해당 과업 없음: ' + id }, { status: 404 });
    // ⚠️ 실제 헤더(head) 전체 폭으로 보존 — HEADER(15칸)로 자르면 분류·메모(16·17칸)가 삭제 때마다 날아감.
    const 행들 = data.filter((r) => String(r[idIdx]) !== String(id)).map((r) => head.map((_, i) => normCell(r[i] ?? '')));
    const res = await w({ key: KEY, 종류: '과업', 헤더: head, 행들, 드롭다운: { 공위치: ['받은일', '시작전', '내작업', '내회신', '고객대기', '보류', '완수'], 돈종류: ['매출', '투자'] }, 덮어쓰기: true });
    if (!res.ok) return NextResponse.json({ ok: false, error: res.error || '삭제 실패' }, { status: 502 });
    invalidateSheets();
    return NextResponse.json({ ok: true, action: 'deleted' });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
