import { NextResponse } from 'next/server';
import { buildOffice } from '@/lib/office';
import { fetchMoneyData } from '@/lib/money';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 사무실(프로젝트 배치)과 돈(매출·미수금·고정비)을 병렬로
    const [office, money] = await Promise.all([buildOffice(), fetchMoneyData()]);
    return NextResponse.json({ ok: true, office, money });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
