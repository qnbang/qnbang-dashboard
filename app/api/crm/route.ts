import { NextResponse } from 'next/server';
import { buildCRM } from '@/lib/crm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ ok: true, crm: await buildCRM() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
