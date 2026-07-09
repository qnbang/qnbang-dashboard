import { NextResponse } from 'next/server';
import { logError } from '@/lib/log';
import { findShare, enableShare, disableShare, listShares } from '@/lib/share';

// 공유 링크는 항상 우리 도메인으로 통일한다. (vercel.app 주소로 접속해 토글해도
// 외부에 나가는 링크는 dashboard.qnbang.com 으로 고정 → 주소가 들쭉날쭉하지 않음)
const SHARE_BASE = (process.env.SHARE_BASE_URL || 'https://dashboard.qnbang.com').replace(/\/$/, '');
function shareUrl(slug: string): string {
  return `${SHARE_BASE}/share/${slug}`;
}

// GET /api/share?all=1            — 지금 공개 중인 문서 전체 목록 (내부 관리용)
// GET /api/share?repo=&path=      — 이 문서가 지금 공개 중인지 조회
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    // 전체 목록 모드 — 공유 켜진 문서를 한눈에 관리하는 화면이 사용한다
    if (sp.get('all')) {
      const entries = await listShares();
      const shares = entries
        .map((e) => ({ ...e, url: shareUrl(e.slug) }))
        .sort((a, b) => (a.sharedAt < b.sharedAt ? 1 : -1)); // 최근 공유 먼저
      return NextResponse.json({ ok: true, shares });
    }
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
    logError('/api/share', e);
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
    logError('/api/share', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
