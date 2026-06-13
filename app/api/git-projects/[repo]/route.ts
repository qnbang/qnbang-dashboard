import { NextResponse } from 'next/server';
import { getWorkLog, getCommits, listProjectDocs, getStatusBoard, getProjectMeta } from '@/lib/github';

// GET /api/git-projects/[repo] — 진행현황 + 작업로그(흐름) + 문서 목록 + 계약 메타(일정 포함)
export async function GET(_req: Request, { params }: { params: Promise<{ repo: string }> }) {
  try {
    const { repo } = await params;
    const [workLog, commits, meta, docs, statusBoard] = await Promise.all([
      getWorkLog(repo),
      getCommits(repo),
      getProjectMeta(repo),
      listProjectDocs(repo),
      getStatusBoard(repo),
    ]);
    return NextResponse.json({ ok: true, workLog, commits, driveFolderId: meta.driveFolderId, meta, docs, statusBoard });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
