import { NextResponse } from 'next/server';
import { getJsonFile, saveJsonFile } from '@/lib/boards';
import { logError, logAudit } from '@/lib/log';

// 회사지도 '정리표시' 큐 — 노드를 "정리해야 함"으로 찜해두는 가벼운 체크리스트.
// 저장 위치는 상태 전용 repo(qnbang-dashboard-data)의 company/정리큐.json (boards.ts와 같은 방식).
// GET ?file=제안 → company/제안.json(AI 제안, 없으면 data:null)을 그대로 돌려준다(companyMap.ts도 같은 파일을 서버에서 직접 읽지만,
//   클라이언트가 새로고침 없이 다시 확인하고 싶을 때를 위한 보조 경로).
export const dynamic = 'force-dynamic';

interface CleanupItem { key: string; 이름: string; 위치: string; at: string; }

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get('file') === '제안') {
      const { data } = await getJsonFile<unknown>('company/제안.json');
      return NextResponse.json({ ok: true, data });
    }
    const { data } = await getJsonFile<CleanupItem[]>('company/정리큐.json');
    return NextResponse.json({ ok: true, queue: Array.isArray(data) ? data : [] });
  } catch (e) {
    logError('/api/company/cleanup GET', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// POST { key, 이름, 위치 } — 이미 큐에 있으면 뺀다(토글), 없으면 넣는다.
export async function POST(req: Request) {
  try {
    const { key, 이름, 위치 } = await req.json();
    if (!key || !이름) return NextResponse.json({ ok: false, error: 'key·이름은 필수예요' }, { status: 400 });
    const { data } = await getJsonFile<CleanupItem[]>('company/정리큐.json');
    const queue = Array.isArray(data) ? data : [];
    const idx = queue.findIndex((q) => q.key === key);
    let flagged: boolean;
    if (idx >= 0) { queue.splice(idx, 1); flagged = false; }
    else { queue.push({ key, 이름, 위치: 위치 || '', at: new Date().toISOString() }); flagged = true; }
    await saveJsonFile('company/정리큐.json', queue);
    logAudit('/api/company/cleanup', flagged ? '정리표시 추가' : '정리표시 해제', { key, 이름 });
    return NextResponse.json({ ok: true, flagged, queue });
  } catch (e) {
    logError('/api/company/cleanup POST', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
