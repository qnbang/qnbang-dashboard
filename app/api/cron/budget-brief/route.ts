import { NextResponse } from 'next/server';
import { logError } from '@/lib/log';
import { fetchBudget } from '@/lib/budget';
import { fetchMoneyData } from '@/lib/money';

// 월 예산 브리핑 — 매달 9일 오전 9시(KST) 라크 웹훅 발송 (vercel.json 크론).
// 10일이 집행일(인건비·부가세 적립·고정비)이라 그 전날 확정용:
// 이번달 예산(써도 되는 돈·상여 권장) + 통장 실잔고 vs 10일 나갈 돈 대조 + 미수금 독촉 목록.
// 예산 재원은 통장 잔고가 아니라 전월 실입금(잔고엔 부가세 적립분·비상금이 섞여 과대계상됨).
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
      lines.push(`· 상여 권장: 최대 ${won(b.상여권장)} — 확정은 회장 금고(/company) [상여 확정] 버튼`);
      lines.push(`= 이번달 써도 되는 돈: ${won(b.써도되는돈)} (남은 한도 ${won(b.남은한도)})`);
    }

    // ── 내일(10일) 집행 점검 — 통장 실잔고 vs 나갈 돈 ──
    const 대기인건비 = (money.인건비목록 || []).filter((l) => l.지급상태 !== '지급완료').reduce((s, l) => s + l.실지급, 0);
    const 십일고정비 = money.고정비목록.filter((f) => Number(String(f.납부일).replace(/[^0-9]/g, '')) === 10).reduce((s, f) => s + f.금액, 0);
    const 나갈돈 = 대기인건비 + b.부가세적립 + 십일고정비;
    lines.push(`── 10일 집행 점검: 나갈 돈 ${won(나갈돈)} (인건비 ${won(대기인건비)} + 부가세 적립 ${won(b.부가세적립)} + 10일 고정비 ${won(십일고정비)})`);
    lines.push(`통장 ${won(money.잔고.통장잔고)} (${money.잔고.업데이트 || '기준일 미상'} 기준) · 세이프박스 ${won(money.잔고.세이프박스)} · 비상금 ${won(b.비상금잔액)}`);
    const 기준일 = new Date(`${money.잔고.업데이트}T00:00:00+09:00`);
    const 잔고나이 = isNaN(기준일.getTime()) ? 999 : Math.floor((Date.now() - 기준일.getTime()) / 86400000);
    if (잔고나이 > 3) lines.push(`⚠️ 잔고가 ${잔고나이}일 전 숫자입니다 — 통장 확인 후 잔고 탭부터 갱신하고 판단하세요.`);
    if (money.잔고.통장잔고 < 나갈돈) lines.push(`🚨 통장이 10일 나갈 돈보다 ${won(나갈돈 - money.잔고.통장잔고)} 부족합니다 — 미수금 회수 또는 비상금 인출이 필요합니다.`);

    const 미수 = money.계약목록.filter((c) => c.미수금 > 0).sort((a, z) => z.미수금 - a.미수금);
    if (미수.length) {
      lines.push(`💰 받을 돈 ${won(money.미수금합)} (${미수.length}건) — 회수 연락 목록:`);
      for (const c of 미수.slice(0, 8)) lines.push(`  · ${c.클라이언트 || c.계약명} ${won(c.미수금)}${c.입금예정일 ? ` (예정 ${c.입금예정일})` : ' (예정일 없음❗)'}`);
    }
    for (const c of b.코멘트) lines.push(`💬 ${c}`);
    lines.push(`회장 금고 → dashboard.qnbang.com/company`);
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
