// KST(한국시간) 기준 오늘 날짜 — 여러 API 라우트·lib/gitSync.ts에 똑같이 중복 구현되던 걸 하나로 모음.
// 반환 형식은 그대로: YYYY-MM-DD (en-CA 로케일이 그 형식을 만듦).
export function todayKST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}
