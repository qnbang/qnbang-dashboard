import { NextResponse } from 'next/server';
import { listOrganizationMembers } from '@/lib/github';

// GET /api/members — 조직 멤버 목록 조회
export async function GET() {
  try {
    const members = await listOrganizationMembers();
    return NextResponse.json({ ok: true, members });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
