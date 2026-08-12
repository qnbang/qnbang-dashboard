import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import type { DecisionBatch } from '@/lib/threadsDecisions';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const directory = path.join(process.cwd(), 'data', 'automation-youth', 'material-batches');
    const files = (await fs.readdir(directory)).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort().reverse();
    if (!files.length) return NextResponse.json({ ok: true, batch: null, source: 'local-git' });

    const batch = JSON.parse(await fs.readFile(path.join(directory, files[0]), 'utf8')) as DecisionBatch;
    if (batch.stage !== 'material' || batch.items.length < 1 || batch.items.length > 5) throw new Error('소재 묶음 형식이 올바르지 않습니다.');
    return NextResponse.json({ ok: true, batch, source: 'local-git' });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : '소재 묶음을 읽지 못했습니다.' }, { status: 500 });
  }
}
