import { NextResponse } from 'next/server';
import { logError } from '@/lib/log';
import { fetchBudget } from '@/lib/budget';
import { fetchMoneyData } from '@/lib/money';

// 월 예산 브리핑 — 매달 1일 오전 9시(KST) 라크 웹훅 발송 (vercel.json 크론).
// 지난달 마감 + 이번달 예산(써도 되는 돈·상여 권장) + 미수금 독촉 목록.
// ?dry=1 이면 발송 없이 본문만 반환(검수용). 웹훅 미설정이면 안내만 반환.
export const dynamic = 'force-dynamic';

const KEY = 'qnbang2026';
const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const isVercelCron = req.headers.get('x-vercel-cron') !== null;
  if (url.searchParams.get('key') !== KEY && !isVercelCron) {
    return NextResponse.json({ ok: false, error: '권한 없음' }, { status: 401 });
  }
  try {
    const [b, money] = await Promise.all([fetchBudget(), fetchMoneyData()]);
    if (!b) return NextResponse.json({ ok: false, error: '예산 탭 미설정 — 브리핑 건너뜀' });

    const 월 = Number(b.기준월.slice(5));
    const 전월n = Number(b.전월.slice(5));
    const lines: string[] = [];
    lines.push(`📊 큐앤뱅 ${월}월 예산 브리핑`);
    lines.push(`── ${전월n}월 마감: 들어온 돈 ${won(b.재원)} · 나간 돈 ${won(b.전월지출)} · 손익 ${won(b.재원 - b.전월지출)}`);
    lines.push(`── ${월}월 예산 (재원 = ${전월n}월 입금 ${won(b.재원)}, 등급: ${b.등급})`);
    lines.push(`· 부가세 적립 ${won(b.부가세적립)} → 세이프박스로 이체`);
    lines.push(`· 기본급 2인 ${won(b.기본급)} (${월}/10 지급) · 고정비 ${won(b.고정비)} (자동 기록)`);
    if (b.등급 === '적자') {
      lines.push(`⚠️ 적자 달 — 부족분 ${won(b.비상금인출)}은 비상금 또는 미수금 회수로 보전. 상여·저축 없음.`);
    } else {
      lines.push(`· 비상금 적립 ${won(b.비상금적립)} → 비상금통장 (잔액 ${won(b.비상금잔액)}, 목표의 ${b.비상금목표 > 0 ? Math.min(100, Math.round(b.비상금잔액 / b.비상금목표 * 100)) : 0}%)`);
      if (b.저축 > 0) lines.push(`· 저축(투자 여력) ${won(b.저축)}`);
      lines.push(`· 상여 권장: 최대 ${won(b.상여권장)}`);
      lines.push(`= 이번달 써도 되는 돈: ${won(b.써도되는돈)}`);
    }
    lines.push(`잔고: 통장 ${won(money.잔고.통장잔고)} · 세이프박스 ${won(money.잔고.세이프박스)} · 비상금 ${won(b.비상금잔액)}`);

    const 미수 = money.계약목록.filter((c) => c.미수금 > 0).sort((a, z) => z.미수금 - a.미수금);
    if (미수.length) {
      lines.push(`💰 받을 돈 ${won(money.미수금합)} (${미수.length}건) — 회수 연락 목록:`);
      for (const c of 미수.slice(0, 8)) lines.push(`  · ${c.클라이언트 || c.계약명} ${won(c.미수금)}${c.입금예정일 ? ` (예정 ${c.입금예정일})` : ' (예정일 없음❗)'}`);
    }
    for (const c of b.코멘트) lines.push(`💬 ${c}`);
    lines.push(`대시보드 → dashboard.qnbang.com 정산 탭`);
    const text = lines.join('\n');

    if (url.searchParams.get('dry')) return NextResponse.json({ ok: true, dry: true, text });

    const webhook = process.env.LARK_BUDGET_WEBHOOK;
    if (!webhook) return NextResponse.json({ ok: false, error: 'LARK_BUDGET_WEBHOOK 미설정', text });
    const r = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg_type: 'text', content: { text } }),
    });
    const j = await r.json().catch(() => ({}));
    return NextResponse.json({ ok: r.ok, lark: j });
  } catch (e) {
    logError('/api/cron/budget-brief', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
