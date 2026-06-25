import { NextResponse } from 'next/server';
import { buildOffice } from '@/lib/office';
import { fetchMoneyData } from '@/lib/money';
import { invalidateSheets } from '@/lib/sheetCache';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // ?fresh=1 — 방금 수정한 사람이 즉시 최신을 보게: 이 인스턴스 캐시를 비우고 시트 직독(120초 SWR 우회)
  if (new URL(req.url).searchParams.get('fresh')) invalidateSheets();
  // 정직한 신뢰(P1): 한 소스가 죽어도 나머지는 보여준다. 둘을 묶어 500 내지 않음.
  // office 실패=빈 사무실(unavailable), money 실패=null → 화면이 "무엇이 안 되는지" 정직하게 표시.
  const [officeR, moneyR] = await Promise.allSettled([buildOffice(), fetchMoneyData()]);
  const office = officeR.status === 'fulfilled' ? officeR.value : {
    rooms: [], 가동률: {}, 과업수: 0, source: 'unavailable', syncedAt: '',
  };
  const money = moneyR.status === 'fulfilled' ? moneyR.value : null;
  return NextResponse.json({ ok: true, office, money });
}
