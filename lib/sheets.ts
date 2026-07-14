// 구글시트 서비스계정 "쓰기" 클라이언트 — office/sales 등 여러 API 라우트에 똑같이 중복
// 구현되던 JWT 인증 생성 코드를 한 곳으로 모음(서버 전용).
// 읽기 전용 클라이언트(캐시 포함)는 lib/sheetCache.ts 가 별도로 관리(스코프가 달라 분리 유지).
import { google } from 'googleapis';

const SA_JSON = process.env.GOOGLE_SA_JSON;

export function sheetsWriteClient() {
  const sa = JSON.parse(SA_JSON!);
  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}
