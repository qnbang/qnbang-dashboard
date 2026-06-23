import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 로그인 쿠키가 없으면 /login 으로 보낸다. (로그인·정적 파일은 통과)
export function middleware(req: NextRequest) {
  const token = req.cookies.get('qnbang_auth')?.value;
  if (token && token === process.env.AUTH_TOKEN) {
    return NextResponse.next();
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  return NextResponse.redirect(url);
}

export const config = {
  // login, api/login, api/cache(시트 캐시 비우기 — 무해, 외부 쓰기 후 호출용), share(외부 공유 정적페이지), hub(협업 허브 외부공개), 정적 자원, 파비콘은 검사에서 제외
  matcher: ['/((?!login|api/login|api/cache|share|hub|_next/static|_next/image|icon.png|apple-icon.png).*)'],
};
