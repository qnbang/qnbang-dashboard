import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

const 기본캘린더 = 'm95n0amqu9guoq0esbgc90pg54@group.calendar.google.com';

export async function GET() {
  try {
    const serviceAccount = JSON.parse(process.env.GOOGLE_SA_JSON || '{}');
    if (!serviceAccount.client_email || !serviceAccount.private_key) {
      return NextResponse.json({ ok: false, items: [], status: '연결 대기', message: '구글 서비스 계정 연결이 필요합니다.' }, { status: 503 });
    }

    const auth = new google.auth.JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    });
    const calendar = google.calendar({ version: 'v3', auth });
    const today = new Date();
    const timeMin = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString();
    const timeMax = new Date(today.getFullYear(), today.getMonth() + 2, 1).toISOString();
    const response = await calendar.events.list({
      calendarId: process.env.QNB_CALENDAR_ID || 기본캘린더,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    });

    const items = (response.data.items || []).filter((event) => event.status !== 'cancelled').map((event) => ({
      id: event.id || '',
      title: event.summary || '제목 없는 일정',
      start: event.start?.dateTime || event.start?.date || '',
      end: event.end?.dateTime || event.end?.date || '',
      allDay: Boolean(event.start?.date && !event.start?.dateTime),
      location: event.location || '',
      link: event.htmlLink || '',
      source: '구글 캘린더',
    })).filter((event) => event.id && event.start);

    return NextResponse.json({ ok: true, items, status: '연결됨', message: `구글 캘린더 일정 ${items.length}건을 읽었습니다.` });
  } catch (error) {
    console.error('운영OS 캘린더 조회 실패:', error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, items: [], status: '오류', message: '구글 캘린더를 읽지 못했습니다.' }, { status: 500 });
  }
}
