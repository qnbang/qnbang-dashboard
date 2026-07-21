// 허브 코멘트 남기기 — 외부 허브(로그인 없음)에서 고객·큐앤뱅이 코멘트를 쌓는다.
// 안전장치: (1) 등록된 HUB key 의 statusRepo/코멘트.json 로만 append, (2) 텍스트만 추가(길이 제한), (3) sha 충돌검사.
import { NextResponse } from 'next/server';
import { HUB } from '@/lib/hubs';
import { getDocFull, saveDoc } from '@/lib/github';

export const dynamic = 'force-dynamic';

const PATH = '코멘트.json';

export async function POST(req: Request) {
  let body: { key?: string; who?: string; text?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 }); }
  const { key, who, text } = body;
  if (!key || !text || !text.trim()) return NextResponse.json({ ok: false, error: 'missing fields' }, { status: 400 });

  const cfg = HUB[key];
  if (!cfg || !cfg.statusRepo) return NextResponse.json({ ok: false, error: 'unknown hub' }, { status: 404 });

  const doc = await getDocFull(cfg.statusRepo, PATH);
  if (!doc) return NextResponse.json({ ok: false, error: 'no comment file' }, { status: 404 });
  let list: { who: string; text: string; reply: string; at: string }[];
  try { list = JSON.parse(doc.content); } catch { list = []; }
  if (!Array.isArray(list)) list = [];
  list.push({ who: (who || '').slice(0, 20), text: String(text).slice(0, 2000), reply: '', at: new Date().toISOString() });

  const res = await saveDoc(cfg.statusRepo, PATH, JSON.stringify(list, null, 2), doc.sha);
  if (!res.ok) return NextResponse.json({ ok: false, conflict: res.conflict }, { status: res.conflict ? 409 : 500 });
  return NextResponse.json({ ok: true });
}
