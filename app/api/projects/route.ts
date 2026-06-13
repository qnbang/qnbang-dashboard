import { NextResponse } from 'next/server';
import { createProjectFolders } from '@/lib/drive';

// POST /api/projects — 새 프로젝트 드라이브 폴더 생성 (소재/결과물/공유본)
// body: { name: string, type: '대행' | '자체' }
export async function POST(req: Request) {
  try {
    const { name, type } = await req.json();
    if (!name || !type) {
      return NextResponse.json({ ok: false, error: '이름과 유형이 필요합니다' }, { status: 400 });
    }
    const folder = await createProjectFolders(name, type);
    return NextResponse.json({ ok: true, folder });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
