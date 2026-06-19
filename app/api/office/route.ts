import { NextResponse } from 'next/server';
import { buildOffice } from '@/lib/office';
import { fetchMoneyData } from '@/lib/money';

export const dynamic = 'force-dynamic';

export async function GET() {
  // 정직한 신뢰(P1): 한 소스가 죽어도 나머지는 보여준다. 둘을 묶어 500 내지 않음.
  // office 실패=빈 사무실(unavailable), money 실패=null → 화면이 "무엇이 안 되는지" 정직하게 표시.
  const [officeR, moneyR] = await Promise.allSettled([buildOffice(), fetchMoneyData()]);
  const office = officeR.status === 'fulfilled' ? officeR.value : {
    rooms: [], 가동률: {}, 과업수: 0, source: 'unavailable', syncedAt: '',
  };
  const money = moneyR.status === 'fulfilled' ? moneyR.value : null;
  return NextResponse.json({ ok: true, office, money });
}
