// API 라우트 공용 에러 로거 — catch에서 화면 반환 직전에 호출해 서버 로그를 남긴다.
// ponytail: winston/pino 안 씀. Vercel이 console.error/log를 그대로 함수 로그로 수집하므로
//           표준 console 한 줄이면 충분(설치·설정·전송 코드 전부 불필요).
export function logError(route: string, e: unknown, ctx?: Record<string, unknown>) {
  const err = e as { message?: string; stack?: string };
  console.error(
    `[API ERROR] ${new Date().toISOString()} ${route} — ${err?.message ?? String(e)}`,
    ctx ?? '',
    err?.stack ?? '',
  );
}

// 돈 만지는 write 성공 지점용 감사-라이트 로그(무엇을 바꿨나 한 줄).
// ponytail: 변경자 신원 미기록 — 현재 라우트에 인증/세션 사용자 정보가 없어 "누가"를 못 남긴다.
//           별도 감사 탭은 YAGNI. 신원이 필요해지면 여기 ctx에 user만 얹으면 됨.
export function logAudit(route: string, action: string, ctx?: Record<string, unknown>) {
  console.log(`[AUDIT] ${new Date().toISOString()} ${route} — ${action}`, ctx ?? '');
}
