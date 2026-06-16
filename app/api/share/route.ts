import { NextResponse } from 'next/server';
import { findShare, enableShare, disableShare } from '@/lib/share';

// 공유 링크는 항상 우리 도메인으로 통일한다. (vercel.app 주소로 접속해 토글해도
// 외부에 나가는 링크는 dashboard.qnbang.com 으로 고정 → 주소가 들쭉날쭉하지 않음)
const SHARE_BASE = (process.env.SHARE_BASE_URL || 'https://dashboard.qnbang.com').replace(/\/$/, '');
function shareUrl(slug: string): string {
  return `${SHARE_BASE}/share/${slug}`;
}

// GET /api/share?repo=&path= — 이 문서가 지금 공개 중인지 조회
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const repo = sp.get('repo');
    const path = sp.get('path');
    if (!repo || !path) return NextResponse.json({ ok: false, error: 'repo·path가 필요합니다' }, { status: 400 });
    const entry = await findShare(repo, path);
    return NextResponse.json({
      ok: true,
      shared: !!entry,
      url: entry ? shareUrl(entry.slug) : null,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// POST /api/share — 공유 켜기/끄기
// body: { repo, path, title, action: 'on' | 'off' }
export async function POST(req: Request) {
  try {
    const { repo, path, title, action } = await req.json();
    if (!repo || !path) return NextResponse.json({ ok: false, error: 'repo·path가 필요합니다' }, { status: 400 });
    if (action === 'off') {
      await disableShare(repo, path);
      return NextResponse.json({ ok: true, shared: false, url: null });
    }
    const entry = await enableShare(repo, path, title || path, new Date().toISOString());
    return NextResponse.json({ ok: true, shared: true, url: shareUrl(entry.slug) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
