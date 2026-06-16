import { NextResponse } from 'next/server';
import { getDocFull, saveDoc } from '@/lib/github';

// GET /api/git-projects/[repo]/doc?path=... — 특정 문서 내용 + sha(편집 충돌 검사용)
export async function GET(req: Request, { params }: { params: Promise<{ repo: string }> }) {
  try {
    const { repo } = await params;
    const path = new URL(req.url).searchParams.get('path');
    if (!path) return NextResponse.json({ ok: false, error: 'path가 필요합니다' }, { status: 400 });
    const doc = await getDocFull(repo, path);
    if (!doc) return NextResponse.json({ ok: true, content: null, sha: null });
    return NextResponse.json({ ok: true, content: doc.content, sha: doc.sha });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// PUT /api/git-projects/[repo]/doc — 문서 저장 (대시보드 편집)
// body: { path, content, sha }  ·  sha 는 불러올 때 받은 값(그 사이 바뀌었으면 충돌로 거절)
export async function PUT(req: Request, { params }: { params: Promise<{ repo: string }> }) {
  try {
    const { repo } = await params;
    const { path, content, sha } = await req.json();
    if (!path || typeof content !== 'string' || !sha) {
      return NextResponse.json({ ok: false, error: 'path·content·sha가 필요합니다' }, { status: 400 });
    }
    const result = await saveDoc(repo, path, content, sha);
    if (result.ok) return NextResponse.json({ ok: true, sha: result.sha });
    if (result.conflict) {
      return NextResponse.json(
        { ok: false, conflict: true, error: '문서를 연 뒤 다른 곳에서 먼저 수정됐어요. 문서를 다시 열어 확인 후 편집해 주세요.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
