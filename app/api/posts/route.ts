// 통합 게시판 API — 회의록·아이디어·리서치를 한 목록으로.
// GET: ① 전역 글(boards/posts.json) ② 허브 회의 게시판들(board:<key>) ③ 과업 시트 분류=리서치 행을 합쳐 최신순 반환.
// POST: 전역 글만 추가/삭제(로그인 필요). 허브 회의는 /board/<key>에서, 시트 리서치는 시트/사무실뷰 칩에서 관리.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { HUB } from '@/lib/hubs';
import { getBoard, saveBoard, type BoardEntry } from '@/lib/boards';
import { getSheets } from '@/lib/sheetCache';
import { logError } from '@/lib/log';

export const dynamic = 'force-dynamic';

const GLOBAL_KEY = 'posts'; // 전역 글 저장 파일 = qnbang-dashboard-data/boards/posts.json

// 화면에 주는 글 한 줄. source=post 만 이 API로 삭제 가능(idx = posts.json 안 원본 인덱스).
export type Post = {
  tag: string;           // 회의록 | 아이디어 | 리서치
  title: string;
  desc: string;
  body?: string;
  date: string;          // YYYY-MM-DD (모르면 빈값)
  href?: string;
  project?: string;      // 어느 프로젝트에 달린 글인지(없으면 독립 글)
  source: 'post' | 'hub' | 'sheet';
  idx?: number;
};

// 시트 2차원 배열 → 헤더 기반 객체 배열 (archive.ts와 같은 소형 헬퍼)
function objs(sheet: unknown[][] | undefined): Record<string, string>[] {
  if (!Array.isArray(sheet) || sheet.length < 2) return [];
  const head = (sheet[0] as unknown[]).map((h) => String(h));
  return sheet.slice(1)
    .filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''))
    .map((r) => Object.fromEntries(head.map((h, i) => [h, String((r as unknown[])[i] ?? '').trim()])));
}

// 날짜 문자열에서 YYYY-MM-DD만 (파싱 실패는 빈값 — 정렬 시 뒤로)
function ymd(s: string): string {
  const m = String(s || '').replace(/[./]/g, '-').match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : '';
}

export async function GET() {
  try {
    const posts: Post[] = [];

    // ① 전역 글 — 원본 인덱스를 들고 있어야 삭제가 정확함
    const global = await getBoard(GLOBAL_KEY);
    global.entries.forEach((e, i) => posts.push({
      tag: e.tag || '아이디어', title: e.title, desc: e.desc, body: e.body,
      date: e.date, href: e.href, source: 'post', idx: i,
    }));

    // ② 허브 회의 게시판 — nav에 board:<key> 있는 허브 전부(외부 공유 원본은 그대로, 여기선 합쳐 보기)
    const hubKeys = Object.keys(HUB).filter((k) => HUB[k].nav.some((n) => n.src === `board:${k}`));
    const hubBoards = await Promise.all(hubKeys.map(async (k) => {
      try { return { k, entries: (await getBoard(k)).entries }; } catch { return { k, entries: [] as BoardEntry[] }; }
    }));
    for (const { k, entries } of hubBoards) {
      const project = HUB[k].title.split('—')[0].trim();
      for (const e of entries) posts.push({
        tag: '회의록', title: e.title, desc: e.desc, date: e.date,
        href: e.href || `/board/${k}`, project, source: 'hub',
      });
    }

    // ③ 과업 시트 분류=리서치 — 리서치 풀은 게시판으로만 보인다(원본은 시트 그대로)
    try {
      const sh = await getSheets();
      for (const t of objs(sh['과업'])) {
        if ((t['분류'] || '') !== '리서치') continue;
        const memo = t['메모'] || '';
        posts.push({
          tag: '리서치', title: t['프로젝트'] || t['과업명'] || '(이름 없음)',
          desc: memo.split('\n')[0] || t['현재상태'] || '', body: memo || undefined,
          date: ymd(t['갱신일'] || ''), source: 'sheet',
        });
      }
    } catch { /* 시트 실패해도 게시판 자체는 뜨게 */ }

    posts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return NextResponse.json({ ok: true, posts });
  } catch (e) {
    logError('/api/posts', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const jar = await cookies();
  if (jar.get('qnbang_auth')?.value !== process.env.AUTH_TOKEN) {
    return NextResponse.json({ ok: false, error: '로그인이 필요합니다' }, { status: 401 });
  }
  let body: { action?: 'add' | 'delete'; entry?: BoardEntry; index?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 }); }

  try {
    const { entries } = await getBoard(GLOBAL_KEY);
    if (body.action === 'add') {
      const e = body.entry;
      const title = (e?.title || '').trim();
      if (!title) return NextResponse.json({ ok: false, error: '제목은 필수예요' }, { status: 400 });
      entries.push({
        title,
        desc: (e?.desc || '').trim(),
        body: (e?.body || '').trim() || undefined,
        date: (e?.date || '').trim() || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }),
        href: (e?.href || '').trim() || undefined,
        tag: (e?.tag || '아이디어').trim(),
      });
    } else if (body.action === 'delete') {
      const i = body.index;
      if (typeof i !== 'number' || i < 0 || i >= entries.length) {
        return NextResponse.json({ ok: false, error: 'bad index' }, { status: 400 });
      }
      entries.splice(i, 1);
    } else {
      return NextResponse.json({ ok: false, error: 'bad action' }, { status: 400 });
    }
    await saveBoard(GLOBAL_KEY, entries, new Date().toISOString());
    return NextResponse.json({ ok: true });
  } catch (e) {
    logError('/api/posts', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
