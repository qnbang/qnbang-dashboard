import { NextResponse } from 'next/server';
import { issueTaxInvoice, type IssueInput } from '@/lib/popbill';

export const dynamic = 'force-dynamic';

// 화면(발행 폼)에서 보낸 정보로 세금계산서를 발행합니다.
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<IssueInput>;

    // 필수값 점검
    if (!body.buyerCorpNum || !body.buyerCorpName || !body.buyerCeoName) {
      return NextResponse.json(
        { ok: false, message: '거래처 사업자번호·상호·대표자명은 필수입니다.' },
        { status: 400 }
      );
    }
    if (!body.itemName || !body.supplyCost || body.supplyCost <= 0) {
      return NextResponse.json(
        { ok: false, message: '품목명과 공급가액(0보다 큰 값)을 입력하세요.' },
        { status: 400 }
      );
    }

    const result = await issueTaxInvoice(body as IssueInput);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (e) {
    return NextResponse.json({ ok: false, message: String(e) }, { status: 500 });
  }
}
