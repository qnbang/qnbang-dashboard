import { NextResponse } from 'next/server';
import { getDoc } from '@/lib/github';
import { mdToHtml } from '@/lib/md';
import { getReview, saveReview, type ReviewItem } from '@/lib/review';

// 검토 대상 = 어떤 repo 의 어떤 개선안 md 를 장표별로 검토할지. key 로 고른다.
// 새 검토 대상이 생기면 여기에 한 줄 추가.
const SOURCES: Record<string, { repo: string; path: string; title: string }> = {
  m650: {
    repo: 'qnbang-proj-m650',
    path: '4_작업중/기획문서/장표별_개선안_v1.md',
    title: 'M650 장표별 개선안 — 검토',
  },
};

// 개선안 md 를 ## 헤더 기준으로 장표(섹션) 단위로 쪼갠다.
// 첫 ## 앞부분은 intro(안내문). 각 섹션 id = 헤더 텍스트(코멘트 저장 키로 안정적).
function splitSections(md: string): { intro: string; sections: { id: string; html: string }[] } {
  const lines = md.split('\n');
  const intro: string[] = [];
  const sections: { id: string; body: string[] }[] = [];
  let cur: { id: string; body: string[] } | null = null;
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      if (cur) sections.push(cur);
      cur = { id: m[1].trim(), body: [] };
    } else if (cur) {
      cur.body.push(line);
    } else {
      intro.push(line);
    }
  }
  if (cur) sections.push(cur);
  return {
    intro: mdToHtml(intro.join('\n')),
    sections: sections.map((s) => ({ id: s.id, html: mdToHtml(`## ${s.id}\n${s.body.join('\n')}`) })),
  };
}

// GET /api/review?key=m650 — 개선안 섹션 + 저장된 검토 코멘트
export async function GET(req: Request) {
  try {
    const key = new URL(req.url).searchParams.get('key') || '';
    const src = SOURCES[key];
    if (!src) return NextResponse.json({ ok: false, error: '알 수 없는 검토 대상입니다.' }, { status: 404 });
    const md = await getDoc(src.repo, src.path);
    if (md == null) return NextResponse.json({ ok: false, error: '개선안 문서를 찾지 못했어요.' }, { status: 404 });
    const { intro, sections } = splitSections(md);
    const { data } = await getReview(key);
    return NextResponse.json({ ok: true, title: src.title, intro, sections, review: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// POST /api/review — 검토 저장. body: { key, items: { [sectionId]: {status, comment} } }
export async function POST(req: Request) {
  try {
    const { key, items } = await req.json();
    if (!key || !SOURCES[key]) return NextResponse.json({ ok: false, error: '알 수 없는 검토 대상입니다.' }, { status: 400 });
    if (!items || typeof items !== 'object') return NextResponse.json({ ok: false, error: 'items가 필요합니다.' }, { status: 400 });
    // 들어온 값만 정제(허용 상태값 외엔 빈값)
    const clean: Record<string, ReviewItem> = {};
    for (const [id, v] of Object.entries(items as Record<string, ReviewItem>)) {
      const status = ['ok', 'fix', 'drop'].includes(v?.status) ? v.status : '';
      const comment = typeof v?.comment === 'string' ? v.comment.slice(0, 5000) : '';
      if (status || comment) clean[id] = { status, comment };
    }
    const saved = await saveReview(key, clean, new Date().toISOString());
    return NextResponse.json({ ok: true, review: saved });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
