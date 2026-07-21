// 산출물 문서 편집 — 사무실(내부, 로그인 필요)에서만. middleware 가 이 경로를 인증 대상으로 둔다.
// slug 로만 접근 → 공유 등록(share-registry)된 문서만 열고 저장(임의 repo·경로 불가). 외부 허브는 열람만.
import { NextResponse } from 'next/server';
import { getShareBySlug } from '@/lib/share';
import { getDoc, getDocFull, saveDoc } from '@/lib/github';

export const dynamic = 'force-dynamic';

// 문서 내용 불러오기
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get('slug');
  if (!slug) return NextResponse.json({ ok: false, error: 'missing slug' }, { status: 400 });
  const e = await getShareBySlug(slug);
  if (!e) return NextResponse.json({ ok: false, error: 'unknown doc' }, { status: 404 });
  const md = await getDoc(e.repo, e.path);
  return NextResponse.json({ ok: true, content: md ?? '', title: e.title });
}

// 문서 저장(덮어쓰기) — sha 충돌검사
export async function POST(req: Request) {
  let body: { slug?: string; content?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 }); }
  const { slug, content } = body;
  if (!slug || typeof content !== 'string') return NextResponse.json({ ok: false, error: 'missing fields' }, { status: 400 });
  const e = await getShareBySlug(slug);
  if (!e) return NextResponse.json({ ok: false, error: 'unknown doc' }, { status: 404 });
  const cur = await getDocFull(e.repo, e.path);
  if (!cur) return NextResponse.json({ ok: false, error: 'no doc' }, { status: 404 });
  const res = await saveDoc(e.repo, e.path, content, cur.sha);
  if (!res.ok) return NextResponse.json({ ok: false, conflict: res.conflict }, { status: res.conflict ? 409 : 500 });
  return NextResponse.json({ ok: true });
}
