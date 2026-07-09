import { NextResponse } from 'next/server';
import { logError } from '@/lib/log';
import { listProjectRepos } from '@/lib/github';

// GET /api/git-projects — qnbang-project 토픽이 붙은 프로젝트 repo 목록
export async function GET() {
  try {
    const projects = await listProjectRepos();
    return NextResponse.json({ ok: true, projects });
  } catch (e) {
    logError('/api/git-projects', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
