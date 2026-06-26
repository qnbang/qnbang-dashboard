import { NextResponse } from 'next/server';
import { buildArchive } from '@/lib/archive';
import { invalidateSheets } from '@/lib/sheetCache';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get('fresh')) invalidateSheets();
  try {
    return NextResponse.json({ ok: true, archive: await buildArchive() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
