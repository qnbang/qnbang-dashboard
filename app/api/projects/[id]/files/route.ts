import { NextResponse } from 'next/server';
import { logError } from '@/lib/log';
import { listProjectFiles } from '@/lib/drive';

// GET /api/projects/[id]/files — 프로젝트 폴더의 파일 목록
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const files = await listProjectFiles(id);
    return NextResponse.json({ ok: true, files });
  } catch (e) {
    logError('/api/projects/[id]/files', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
