// 반보 프록시 — 반보(banbo-preview) API의 관리자 키를 서버 env에 숨기고 대시보드에 중계한다.
// 읽기: 프로그램 목록·신청자. 쓰기: 입금 체크(check-paid, 행 단위)만 — programs 전체 덮어쓰기는
// 반보 어드민과 충돌(한쪽 유실)할 수 있어 여기선 안 만든다(모집상태 변경은 어드민에서).
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logError } from '@/lib/log';

export const dynamic = 'force-dynamic';

const BASE = process.env.BANBO_BASE_URL || 'https://banbo-preview.vercel.app';
const KEY = (process.env.BANBO_ADMIN_KEY || '').normalize('NFC'); // 반보가 NFC로 비교 — 한글 키 대비

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const view = sp.get('view') || 'programs';
  try {
    if (view === 'programs') {
      const j = await fetch(`${BASE}/api/programs`, { cache: 'no-store' }).then((r) => r.json());
      return NextResponse.json(j);
    }
    if (view === 'applicants') {
      if (!KEY) return NextResponse.json({ ok: false, error: 'BANBO_ADMIN_KEY 미설정' }, { status: 500 });
      const q = new URLSearchParams({ key: KEY, id: sp.get('id') || '' });
      const tab = sp.get('tab');
      if (tab) q.set('tab', tab);
      const j = await fetch(`${BASE}/api/applicants?${q}`, { cache: 'no-store' }).then((r) => r.json());
      return NextResponse.json(j);
    }
    return NextResponse.json({ ok: false, error: 'unknown view' }, { status: 400 });
  } catch (e) {
    logError('/api/biz/banbo', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const jar = await cookies();
  if (jar.get('qnbang_auth')?.value !== process.env.AUTH_TOKEN) {
    return NextResponse.json({ ok: false, error: '로그인이 필요합니다' }, { status: 401 });
  }
  if (!KEY) return NextResponse.json({ ok: false, error: 'BANBO_ADMIN_KEY 미설정' }, { status: 500 });
  let body: { action?: string; id?: string; rowNum?: number; paid?: boolean; sheetTab?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 }); }
  if (body.action !== 'paid') return NextResponse.json({ ok: false, error: 'bad action' }, { status: 400 });
  try {
    const j = await fetch(`${BASE}/api/check-paid`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: KEY, id: body.id, rowNum: body.rowNum, paid: !!body.paid, sheetTab: body.sheetTab }),
    }).then((r) => r.json());
    return NextResponse.json(j);
  } catch (e) {
    logError('/api/biz/banbo', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
