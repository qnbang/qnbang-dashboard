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
  // login, api/login, api/cache, api/cron(크론 — 자체 key로 보호), api/hub-toggle(공개 허브 체크박스 토글 — HUB 설정 repo·체크박스로만 제한),
  // board(공개 회의 게시판 — 읽기전용, 편집 폼은 로그인 시에만·api/board가 자체 쿠키검사), share, hub, 정적 자원, 파비콘은 검사에서 제외
  // survey/api/survey(외부 설문 작성·제출 — 로그인 없이, api/survey는 스팸트랩+빈응답 차단)
  matcher: ['/((?!login|api/login|api/cache|api/cron|api/bank/sms|api/hub-toggle|api/hub-comment|api/hub-step|api/board|api/survey|board|survey|share|hub|_next/static|_next/image|icon.png|apple-icon.png).*)'],
};
