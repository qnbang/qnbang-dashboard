import { NextResponse } from 'next/server';

// /company 2차 게이트 로그인 — 대시보드 공용 비번(AUTH_TOKEN)과 별개로, 회장 전용 회사지도만 한 번 더 잠근다.
// 패턴은 app/api/login/route.ts와 동일(비번 대조 → httpOnly 쿠키 30일).
export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({ password: '' }));
  if (password && password === process.env.COMPANY_PASSWORD) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set('qnbang_company', process.env.COMPANY_TOKEN!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30일
      path: '/',
    });
    return res;
  }
  return NextResponse.json(
    { ok: false, error: '비밀번호가 올바르지 않습니다.' },
    { status: 401 }
  );
}
