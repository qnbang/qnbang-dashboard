// 허브 체크리스트 공개 토글 — 외부 허브(로그인 없음)에서 체크박스를 켜고 끈다.
// 안전장치: (1) HUB 설정에 등록된 key 의 statusRepo/현황판.md 로만 쓴다(임의 repo·경로 불가),
//           (2) 체크박스 한 칸의 [x]<->[ ] 뒤집기만 한다(본문 내용은 못 건드림),
//           (3) sha 충돌검사로 동시수정 덮어쓰기 방지.
import { NextResponse } from 'next/server';
import { HUB, toggleChecklistItem } from '@/lib/hubs';
import { getDocFull, saveDoc } from '@/lib/github';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { key?: string; sectionName?: string; text?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 }); }
  const { key, sectionName, text } = body;
  if (!key || !sectionName || !text) return NextResponse.json({ ok: false, error: 'missing fields' }, { status: 400 });

  const cfg = HUB[key];
  if (!cfg || !cfg.statusRepo) return NextResponse.json({ ok: false, error: 'unknown hub' }, { status: 404 });
  const path = cfg.statusPath || '현황판.md';

  const doc = await getDocFull(cfg.statusRepo, path);
  if (!doc) return NextResponse.json({ ok: false, error: 'no status board' }, { status: 404 });

  const flipped = toggleChecklistItem(doc.content, sectionName, text);
  if (!flipped) return NextResponse.json({ ok: false, error: 'item not found' }, { status: 404 });

  const res = await saveDoc(cfg.statusRepo, path, flipped.md, doc.sha);
  if (!res.ok) {
    // 그 사이 다른 곳에서 먼저 바뀜 → 클라이언트가 새로고침하도록 409
    return NextResponse.json({ ok: false, conflict: res.conflict }, { status: res.conflict ? 409 : 500 });
  }
  return NextResponse.json({ ok: true, state: flipped.state });
}
