import { NextResponse } from 'next/server';
import { getDoc } from '@/lib/github';

// GET /api/git-projects/[repo]/doc?path=... — 특정 문서 내용
export async function GET(req: Request, { params }: { params: Promise<{ repo: string }> }) {
  try {
    const { repo } = await params;
    const path = new URL(req.url).searchParams.get('path');
    if (!path) return NextResponse.json({ ok: false, error: 'path가 필요합니다' }, { status: 400 });
    const content = await getDoc(repo, path);
    return NextResponse.json({ ok: true, content });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
