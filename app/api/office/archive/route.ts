import { NextResponse } from 'next/server';
import { logError } from '@/lib/log';
import { getSheets } from '@/lib/sheetCache';

export const dynamic = 'force-dynamic';

// 아카이브 탭(완수·폐기 프로젝트) 읽기 — 보드 하단 '아카이브' 섹션이 열 때 호출(온디맨드).
// 완수 vs 폐기 구분 = 현재상태에 '폐기'가 들어가면 폐기, 아니면 완수.
export async function GET() {
  try {
    const sheets = await getSheets();
    const rows = (sheets['아카이브'] as unknown[][]) || [];
    const head = (rows[0] || []).map((h) => String(h));
    const idx = (n: string) => head.indexOf(n);
    const items = rows.slice(1)
      .filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''))
      .map((r) => {
        const status = String(r[idx('현재상태')] ?? '');
        return {
          project: String(r[idx('프로젝트')] ?? ''),
          task: String(r[idx('과업명')] ?? ''),
          owner: String(r[idx('담당자')] ?? ''),
          client: String(r[idx('고객')] ?? ''),
          status,
          date: String(r[idx('갱신일')] ?? ''),
          kind: status.includes('폐기') ? 'discard' : 'done',
        };
      })
      .reverse(); // 최근 것 위로
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    logError('/api/office/archive', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
