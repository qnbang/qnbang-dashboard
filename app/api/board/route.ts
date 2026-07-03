// 회의 게시판 편집 — 로그인한 사람만 회의를 추가/삭제한다(외부 파트너는 읽기전용).
// 안전장치: (1) 쿠키 qnbang_auth === AUTH_TOKEN 검사(비로그인 401),
//           (2) HUB 에 등록되고 nav 에 board:<key> 항목이 있는 키로만 쓴다(임의 저장 차단),
//           (3) 상태 전용 repo(qnbang-dashboard-data)의 boards/<key>.json 에만 기록(코드 repo 무관).
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { HUB } from '@/lib/hubs';
import { getBoard, saveBoard, type BoardEntry } from '@/lib/boards';

export const dynamic = 'force-dynamic';

// 이 키가 회의 게시판을 가진 허브인지(nav 에 board:<key> 존재).
function allowed(key: string): boolean {
  const cfg = HUB[key];
  return !!cfg && cfg.nav.some((n) => n.src === `board:${key}`);
}

export async function POST(req: Request) {
  const jar = await cookies();
  if (jar.get('qnbang_auth')?.value !== process.env.AUTH_TOKEN) {
    return NextResponse.json({ ok: false, error: '로그인이 필요합니다' }, { status: 401 });
  }

  let body: { key?: string; action?: 'add' | 'delete'; entry?: BoardEntry; index?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 }); }
  const { key, action } = body;
  if (!key || !allowed(key)) return NextResponse.json({ ok: false, error: 'unknown board' }, { status: 404 });

  const { entries } = await getBoard(key);

  if (action === 'add') {
    const e = body.entry;
    const title = (e?.title || '').trim();
    if (!title) return NextResponse.json({ ok: false, error: '제목은 필수예요' }, { status: 400 });
    const entry: BoardEntry = {
      title,
      desc: (e?.desc || '').trim(),
      date: (e?.date || '').trim(),
      href: (e?.href || '').trim() || undefined,
      tag: (e?.tag || '회의록').trim() || undefined,
    };
    entries.push(entry);
  } else if (action === 'delete') {
    const i = body.index;
    if (typeof i !== 'number' || i < 0 || i >= entries.length) {
      return NextResponse.json({ ok: false, error: 'bad index' }, { status: 400 });
    }
    entries.splice(i, 1);
  } else {
    return NextResponse.json({ ok: false, error: 'bad action' }, { status: 400 });
  }

  // 저장 시각(KST). 스크립트 밖에서 new Date() 사용 OK(런타임 서버).
  await saveBoard(key, entries, new Date().toISOString());
  return NextResponse.json({ ok: true });
}
