import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { appendThreadsPost, listThreadsPosts, patchThreadsPost, type ThreadsStatus } from '@/lib/threadsPublisher';
import { logError } from '@/lib/log';

export const dynamic = 'force-dynamic';

const states = new Set<ThreadsStatus>(['보관함', '예약됨', '발행됨', '오류', '중지됨']);

function 서울날짜(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

async function allowed() {
  return (await cookies()).get('qnbang_auth')?.value === process.env.AUTH_TOKEN;
}

export async function GET() {
  try {
    const posts = await listThreadsPosts();
    const today = 서울날짜();
    const 슬롯 = ['12:00', '15:00', '18:00'].map((time) => {
      const post = posts.find((item) => item.예약시각.replace('T', ' ').startsWith(today) && item.예약시각.replace('T', ' ').slice(11, 16) === time);
      return { time, post: post ? { id: post.콘텐츠ID, title: post.제목, status: post.상태, scheduledAt: post.예약시각 } : null };
    });
    const 판단 = {
      승인필요: posts.filter((post) => post.상태 === '보관함').map((post) => ({ id: post.콘텐츠ID, title: post.제목, reason: '보관함에 있어 발행 여부와 예약 시각을 결정해야 합니다.' })),
      오류: posts.filter((post) => post.상태 === '오류').map((post) => ({ id: post.콘텐츠ID, title: post.제목, reason: post.마지막오류 || '원장에 오류 상태로 기록되어 있습니다.' })),
      예약누락: posts.filter((post) => post.상태 === '예약됨' && !post.예약시각).map((post) => ({ id: post.콘텐츠ID, title: post.제목, reason: '예약됨 상태지만 예약 시각이 비어 있습니다.' })),
      소재부족: { available: false, message: '소재수집 원장이 아직 연결되지 않아 부족 여부를 계산하지 않습니다.' },
      연결이상: posts.filter((post) => post.상태 === '오류' && post.마지막오류).map((post) => ({ id: post.콘텐츠ID, title: post.제목, reason: post.마지막오류 })),
    };
    return NextResponse.json({
      ok: true, posts, slots: 슬롯, 판단,
      adapters: {
        소재수집: { available: false, message: '소재수집 원장 연결 전' },
        실험실: { available: false, message: '실험실 원장 연결 전' },
        성과: { available: false, message: '성과 원장 연결 전' },
        시스템상태: { available: false, message: '맥북 발행기 상태 수신 연결 전' },
      },
    });
  } catch (error) {
    logError('/api/threads', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : '발행 원장을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await allowed())) return NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 });
  try {
    const body = await request.json();
    if (body.action === 'create') {
      const title = String(body.title || '').trim();
      const text = String(body.text || '').trim();
      const status = body.status as ThreadsStatus;
      if (!title || !text || !states.has(status)) return NextResponse.json({ ok: false, error: '제목, 본문, 상태를 확인해주세요.' }, { status: 400 });
      const post = await appendThreadsPost({
        제목: title, 예약시각: String(body.scheduledAt || ''), 본문: text,
        이어쓰기1: String(body.replies?.[0] || ''), 이어쓰기2: String(body.replies?.[1] || ''), 이어쓰기3: String(body.replies?.[2] || ''), 상태: status,
      });
      return NextResponse.json({ ok: true, post });
    }
    if (body.action === 'update') {
      const status = body.status as ThreadsStatus;
      if (!body.id || !states.has(status)) return NextResponse.json({ ok: false, error: '콘텐츠 상태를 확인해주세요.' }, { status: 400 });
      const post = await patchThreadsPost(String(body.id), {
        제목: String(body.title || '').trim(), 예약시각: String(body.scheduledAt || ''), 본문: String(body.text || '').trim(),
        이어쓰기1: String(body.replies?.[0] || ''), 이어쓰기2: String(body.replies?.[1] || ''), 이어쓰기3: String(body.replies?.[2] || ''), 상태: status, 즉시발행: body.immediate ? '요청됨' : '',
      });
      return NextResponse.json({ ok: true, post });
    }
    return NextResponse.json({ ok: false, error: '요청을 이해하지 못했습니다.' }, { status: 400 });
  } catch (error) {
    logError('/api/threads', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : '저장하지 못했습니다.' }, { status: 500 });
  }
}
