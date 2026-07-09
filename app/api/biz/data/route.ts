// 자체사업 운영 데이터 — 읽는다 회차·자동화청년 지표를 상태 전용 repo(qnbang-dashboard-data)의
// biz/<key>.json 에 저장. posts와 같은 패턴(전체 저장, GitHub Contents API + sha).
// middleware가 이 경로를 보호하므로 GET도 로그인 뒤에서만 열린다. POST는 쿠키 재검사(이중 안전).
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getJsonFile, saveJsonFile } from '@/lib/boards';
import { logError } from '@/lib/log';

export const dynamic = 'force-dynamic';

const KEYS = new Set(['ikneunda', 'autoboy']); // 화이트리스트 — 임의 경로 쓰기 차단
const pathOf = (key: string) => `biz/${key}.json`;

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key') || '';
  if (!KEYS.has(key)) return NextResponse.json({ ok: false, error: 'unknown key' }, { status: 404 });
  try {
    const { data } = await getJsonFile<Record<string, unknown>>(pathOf(key));
    return NextResponse.json({ ok: true, data: data || {} });
  } catch (e) {
    logError('/api/biz/data', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const jar = await cookies();
  if (jar.get('qnbang_auth')?.value !== process.env.AUTH_TOKEN) {
    return NextResponse.json({ ok: false, error: '로그인이 필요합니다' }, { status: 401 });
  }
  let body: { key?: string; data?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 }); }
  const key = body.key || '';
  if (!KEYS.has(key)) return NextResponse.json({ ok: false, error: 'unknown key' }, { status: 404 });
  if (!body.data || typeof body.data !== 'object') return NextResponse.json({ ok: false, error: 'bad data' }, { status: 400 });
  try {
    await saveJsonFile(pathOf(key), { ...(body.data as object), updatedAt: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  } catch (e) {
    logError('/api/biz/data', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
