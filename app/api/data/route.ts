import { NextResponse } from 'next/server';
import { fetchExpenseData } from '@/lib/sheet';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await fetchExpenseData();
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
