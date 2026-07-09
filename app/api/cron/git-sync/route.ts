import { NextResponse } from 'next/server';
import { logError } from '@/lib/log';
import { syncGitProjects } from '@/lib/gitSync';

// 깃 → 시트 자동 등록 크론(매일) — 어느 컴퓨터에서 푸시했든 클라우드가 시트에 등록.
// 수동 실행: /api/cron/git-sync?key=...  미리보기: &dry=1 (아무것도 안 쓰고 계획만 반환)
export const dynamic = 'force-dynamic';

const KEY = 'qnbang2026';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const isVercelCron = req.headers.get('x-vercel-cron') !== null;
  if (url.searchParams.get('key') !== KEY && !isVercelCron) {
    return NextResponse.json({ ok: false, error: '권한 없음' }, { status: 401 });
  }
  try {
    const dry = url.searchParams.get('dry') === '1';
    const result = await syncGitProjects(dry);
    return NextResponse.json({ ok: true, dry, ...result });
  } catch (e) {
    logError('/api/cron/git-sync', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
