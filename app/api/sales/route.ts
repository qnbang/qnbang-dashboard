import { NextResponse } from 'next/server';
import { buildSales } from '@/lib/sales';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ ok: true, sales: await buildSales() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
