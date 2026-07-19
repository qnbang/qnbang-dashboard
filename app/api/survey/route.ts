// 설문 응답 접수 → Resend로 info@qnbang.com 메일 발송 (로그인 없이 외부에서 제출).
// 표준: 앞으로 모든 마크다운 설문(/survey/<slug>)이 이 라우트로 응답을 보낸다.
// RESEND_API_KEY 는 코드에 안 박고 Vercel 환경변수로 넣는다(큐앤뱅 홈 문의폼과 동일 키).
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface Answer { label: string; value: string }

export async function POST(req: Request) {
  let body: { slug?: string; title?: string; name?: string; answers?: Answer[]; replyTo?: string; botcheck?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 }); }

  if (body.botcheck) return NextResponse.json({ ok: true }); // 스팸 봇: 조용히 무시

  const title = (body.title || '설문').toString().trim();
  const name = (body.name || '').toString().trim();
  const replyTo = (body.replyTo || '').toString().trim();
  const answers = Array.isArray(body.answers) ? body.answers : [];

  const lines = answers
    .filter((a) => a && a.value != null && String(a.value).trim())
    .map((a) => `■ ${a.label}\n${String(a.value).trim()}`);
  if (name) lines.unshift(`■ 작성자\n${name}`);

  if (lines.length === 0) return NextResponse.json({ ok: false, error: '빈 응답' }, { status: 400 });

  const text = `"${title}" 설문 응답이 접수되었습니다.\n\n${lines.join('\n\n')}\n`;

  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ ok: false, error: '메일 설정(RESEND_API_KEY)이 아직 없습니다.' }, { status: 500 });

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: '큐앤뱅 설문 <no-reply@qnbang.com>',
        to: ['info@qnbang.com'],
        subject: `[설문 응답] ${title}`,
        text,
        ...(replyTo && /.+@.+\..+/.test(replyTo) ? { reply_to: replyTo } : {}),
      }),
    });
    if (!r.ok) return NextResponse.json({ ok: false, error: await r.text() }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
