import { NextResponse } from 'next/server';
import { logError } from '@/lib/log';
import { invalidateSheets } from '@/lib/sheetCache';

export const dynamic = 'force-dynamic';

// 여정 패널 — 할일 단계 완료/되돌림 + 🕘 이력 한 줄 기록.
//  { id, 할일?: "✓끝난단계;다음단계", 내용?: "✓ '단계' 완료" }
//  ① 할일 = 과업 행의 '할일' 칸만 수정(수정 라우트). ② 내용 = '이력' 탭에 append(과업id·시각·내용).
const WRITE_URL = process.env.SHEET_WRITE_URL
  || 'https://script.google.com/macros/s/AKfycbxPt24eFUbUP1cPwsv5Gspc3pak_hvqIdGf7T4cbvqJSxKkKimCdEhxdSll0yMPJ5dPAw/exec';
const KEY = process.env.SHEET_KEY || 'qnbang2026';

function nowKST() {
  return new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function todayKST() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }); }
async function w(body: Record<string, unknown>) {
  const r = await fetch(WRITE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json().catch(() => ({} as { ok?: boolean; error?: string }));
}

export async function POST(req: Request) {
  try {
    const { id, 할일, 내용 } = await req.json().catch(() => ({}));
    if (!id) return NextResponse.json({ ok: false, error: 'id 필요' }, { status: 400 });

    if (typeof 할일 === 'string') {
      const u = await w({ key: KEY, 종류: '과업', 수정: { id, 값: { 할일, 갱신일: todayKST() } } });
      if (!u.ok) return NextResponse.json({ ok: false, error: u.error || '할일 저장 실패' }, { status: 502 });
    }
    if (내용) {
      await w({ key: KEY, 종류: '이력', 헤더: ['과업id', '시각', '내용'], 행: { 과업id: String(id), 시각: nowKST(), 내용: String(내용) } });
    }
    invalidateSheets();
    return NextResponse.json({ ok: true });
  } catch (e) {
    logError('/api/office/step', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
