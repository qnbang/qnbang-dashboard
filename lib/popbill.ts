// 팝빌(Popbill)로 전자세금계산서를 발행하는 서버 전용 코드입니다.
// 이 파일은 서버에서만 실행되므로 연동 인증키(SecretKey)가 브라우저에 노출되지 않습니다.

// popbill 패키지는 타입 정의가 없어 require로 불러옵니다.

const popbill = require('popbill');

// --- 환경변수에서 설정값을 읽습니다 ---
const LINK_ID = process.env.POPBILL_LINK_ID!;       // 팝빌 연동회원 LinkID
const SECRET_KEY = process.env.POPBILL_SECRET_KEY!; // 팝빌 연동회원 SecretKey
const IS_TEST = process.env.POPBILL_IS_TEST !== 'false'; // 기본값: 테스트 모드

// 공급자(우리 회사 = 큐앤뱅) 정보. 사업자번호는 '-' 없이 숫자 10자리.
const SUPPLIER = {
  corpNum: (process.env.POPBILL_CORP_NUM || '').replace(/[^0-9]/g, ''),
  corpName: process.env.POPBILL_CORP_NAME || '',
  ceoName: process.env.POPBILL_CEO_NAME || '',
  addr: process.env.POPBILL_ADDR || '',
  bizType: process.env.POPBILL_BIZ_TYPE || '',   // 업태
  bizClass: process.env.POPBILL_BIZ_CLASS || '', // 종목
  contactName: process.env.POPBILL_CONTACT_NAME || '',
  tel: process.env.POPBILL_TEL || '',
  email: process.env.POPBILL_EMAIL || '',
};

// 팝빌 전역 설정 (한 번만 적용)
popbill.config({
  LinkID: LINK_ID,
  SecretKey: SECRET_KEY,
  IsTest: IS_TEST,
  IPRestrictOnOff: true,
  UseStaticIP: false,
  UseLocalTimeYN: true,
});

const taxinvoiceService = popbill.TaxinvoiceService();

// 화면에서 넘어오는 거래처(공급받는 자) + 거래 정보
export interface IssueInput {
  buyerCorpNum: string;   // 공급받는자 사업자번호
  buyerCorpName: string;  // 상호
  buyerCeoName: string;   // 대표자명
  buyerAddr?: string;     // 주소
  buyerBizType?: string;  // 업태
  buyerBizClass?: string; // 종목
  buyerEmail?: string;    // 이메일 (발행 안내 수신)
  itemName: string;       // 품목명
  supplyCost: number;     // 공급가액 (세금 제외 금액)
  purpose?: '영수' | '청구'; // 영수/청구 (기본 청구)
  writeDate?: string;     // 작성일자 YYYYMMDD (기본 오늘)
}

export interface IssueResult {
  ok: boolean;
  mgtKey?: string;     // 우리가 부여한 문서번호
  ntsConfirmNum?: string; // 국세청 승인번호 (발행 성공 시)
  message: string;
}

// 오늘 날짜를 YYYYMMDD(한국시간)로 만듭니다.
function todayKST(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts.replace(/-/g, ''); // 2026-06-08 -> 20260608
}

// 콜백 기반인 팝빌 발행을 Promise로 감싸 await로 쓸 수 있게 합니다.
export function issueTaxInvoice(input: IssueInput): Promise<IssueResult> {
  return new Promise((resolve) => {
    if (!SUPPLIER.corpNum) {
      resolve({ ok: false, message: '공급자(우리 회사) 사업자번호 설정(POPBILL_CORP_NUM)이 비어 있습니다.' });
      return;
    }

    const supplyCost = Math.round(input.supplyCost);
    const tax = Math.round(supplyCost * 0.1); // 부가세 10%
    const total = supplyCost + tax;

    // 문서번호: 같은 번호로 두 번 발행할 수 없으므로 시각 기반으로 고유하게 만듭니다.
    const mgtKey = 'QB' + new Date().getTime();
    const writeDate = input.writeDate || todayKST();

    const Taxinvoice = {
      // 작성 정보
      writeDate,
      chargeDirection: '정과금',     // 정과금(공급자 발행) / 역과금
      issueType: '정발행',
      purposeType: input.purpose || '청구',
      taxType: '과세',

      // 공급자 (우리 회사)
      invoicerCorpNum: SUPPLIER.corpNum,
      invoicerMgtKey: mgtKey,
      invoicerCorpName: SUPPLIER.corpName,
      invoicerCEOName: SUPPLIER.ceoName,
      invoicerAddr: SUPPLIER.addr,
      invoicerBizType: SUPPLIER.bizType,
      invoicerBizClass: SUPPLIER.bizClass,
      invoicerContactName: SUPPLIER.contactName,
      invoicerTEL: SUPPLIER.tel,
      invoicerEmail: SUPPLIER.email,

      // 공급받는 자 (거래처)
      invoiceeType: '사업자',
      invoiceeCorpNum: input.buyerCorpNum.replace(/[^0-9]/g, ''),
      invoiceeCorpName: input.buyerCorpName,
      invoiceeCEOName: input.buyerCeoName,
      invoiceeAddr: input.buyerAddr || '',
      invoiceeBizType: input.buyerBizType || '',
      invoiceeBizClass: input.buyerBizClass || '',
      invoiceeEmail1: input.buyerEmail || '',

      // 금액
      supplyCostTotal: String(supplyCost),
      taxTotal: String(tax),
      totalAmount: String(total),

      // 품목 (1줄)
      detailList: [
        {
          serialNum: 1,
          purchaseDT: writeDate,
          itemName: input.itemName,
          qty: '1',
          supplyCost: String(supplyCost),
          tax: String(tax),
        },
      ],
    };

    // 즉시발행: 작성 + 발행을 한 번에 처리합니다.
    taxinvoiceService.registIssue(
      SUPPLIER.corpNum,
      Taxinvoice,
      function (result: { code?: number; ntsConfirmNum?: string; message?: string }) {
        // 팝빌 성공 응답은 code 가 1 입니다.
        const succeeded = result.code === 1 || result.code === undefined;
        resolve({
          ok: succeeded,
          mgtKey,
          ntsConfirmNum: result.ntsConfirmNum,
          message: result.message || (succeeded ? '세금계산서가 발행되었습니다.' : '발행 결과를 확인하세요.'),
        });
      },
      function (err: { code?: number; message?: string }) {
        resolve({
          ok: false,
          mgtKey,
          message: `발행 실패 (코드 ${err.code ?? '?'}): ${err.message ?? '알 수 없는 오류'}`,
        });
      }
    );
  });
}
