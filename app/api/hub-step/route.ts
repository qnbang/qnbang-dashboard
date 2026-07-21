// 허브 지금 할 일 편집 — 외부 허브에서 항목 추가/삭제/수정(현황판.md).
// 안전장치: (1) 등록된 HUB key 의 statusRepo/현황판.md 로만, (2) 체크박스 항목 add/del/edit 만, (3) sha 충돌검사.
import { NextResponse } from 'next/server';
import { HUB, addChecklistItem, removeChecklistItem, editChecklistItem } from '@/lib/hubs';
import { getDocFull, saveDoc } from '@/lib/github';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { key?: string; section?: string; op?: string; text?: string; newText?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 }); }
  const { key, section, op, text, newText } = body;
  if (!key || !section || !op || !text) return NextResponse.json({ ok: false, error: 'missing fields' }, { status: 400 });

  const cfg = HUB[key];
  if (!cfg || !cfg.statusRepo) return NextResponse.json({ ok: false, error: 'unknown hub' }, { status: 404 });
  const path = cfg.statusPath || '현황판.md';
  const doc = await getDocFull(cfg.statusRepo, path);
  if (!doc) return NextResponse.json({ ok: false, error: 'no status board' }, { status: 404 });

  let nm: string | null = null;
  if (op === 'add') nm = addChecklistItem(doc.content, section, text);
  else if (op === 'del') nm = removeChecklistItem(doc.content, section, text);
  else if (op === 'edit') { if (!newText) return NextResponse.json({ ok: false, error: 'no newText' }, { status: 400 }); nm = editChecklistItem(doc.content, section, text, newText); }
  else return NextResponse.json({ ok: false, error: 'bad op' }, { status: 400 });

  if (nm == null) return NextResponse.json({ ok: false, error: 'item/section not found' }, { status: 404 });
  const res = await saveDoc(cfg.statusRepo, path, nm, doc.sha);
  if (!res.ok) return NextResponse.json({ ok: false, conflict: res.conflict }, { status: res.conflict ? 409 : 500 });
  return NextResponse.json({ ok: true });
}
