import { NextResponse } from 'next/server';
import { updateProjectMeta, META_KEYS } from '@/lib/github';

// POST /api/git-projects/[repo]/meta — 프로젝트 정보(계약·입금·금액·진행상태) 저장
// body: { field: 'progressStatus'|'contractStatus'|'paymentStatus'|'amount'|'paidAmount'|'contractUrl', value }
export async function POST(req: Request, { params }: { params: Promise<{ repo: string }> }) {
  try {
    const { repo } = await params;
    const { field, value } = await req.json();
    const key = META_KEYS[field];
    if (!key) return NextResponse.json({ ok: false, error: '알 수 없는 항목' }, { status: 400 });
    await updateProjectMeta(repo, { [key]: value });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
