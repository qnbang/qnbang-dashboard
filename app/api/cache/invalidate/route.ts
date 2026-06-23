import { NextResponse } from 'next/server';
import { invalidateSheets } from '@/lib/sheetCache';

export const dynamic = 'force-dynamic';

// 시트 캐시 비우기 — 외부(과업POST.py 등)가 자금기록기로 시트에 '직접' 쓴 뒤 이걸 호출하면,
// 대시보드의 다음 읽기가 120초 SWR을 기다리지 않고 최신을 가져온다.
// 무해(데이터를 바꾸지 않고 캐시 메모리만 비움)해서 미들웨어 예외로 공개한다 —
// office 데이터 자체는 여전히 로그인 보호 뒤에 있다.
function handle() {
  invalidateSheets();
  return NextResponse.json({ ok: true, invalidated: true });
}
export async function POST() { return handle(); }
export async function GET() { return handle(); }
