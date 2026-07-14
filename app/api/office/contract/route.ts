import { NextResponse } from 'next/server';
import { logError } from '@/lib/log';
import { invalidateSheets } from '@/lib/sheetCache';
import { sheetsWriteClient } from '@/lib/sheets';
import { todayKST as today } from '@/lib/date';

export const dynamic = 'force-dynamic';

// 카드 💰 계약 입력 → 매출/정기매출 단일 원장에 시트 API로 직접 append(서비스계정 편집).
// 헤더를 실시간으로 읽어 칸 정렬을 맞춤(자금기록기 하드코딩 헤더가 낡아 칸 밀림이 났던 것 회피).
// 부가세·순매출 자동(관행=계약금액 VAT포함, 공급가=계약금액−부가세). 단일 스펙: 결정문서 §11.
const SHEET_ID = process.env.SHEET_ID;
const SA_JSON = process.env.GOOGLE_SA_JSON;

const num = (v: unknown) => Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;

const api = sheetsWriteClient;

export async function POST(req: Request) {
  try {
    if (!SHEET_ID || !SA_JSON) return NextResponse.json({ ok: false, error: 'SHEET_ID/SA 미설정' }, { status: 500 });
    const { 종류, 계약명, 클라이언트, 금액, 입금상태, 입금액, 계약일, 마감일, 시작월, 종료월 } = await req.json().catch(() => ({}));
    if (!계약명 || !금액) return NextResponse.json({ ok: false, error: '계약명·금액 필요' }, { status: 400 });
    const amt = num(금액);

    let tab: string;
    let 행: Record<string, unknown>;
    if (종류 === '정기매출') {
      tab = '정기매출';
      const vat = Math.round(amt / 11); // 계약금액 VAT포함 관행
      행 = { 항목: 계약명, 클라이언트: 클라이언트 || '', 월금액: amt, 부가세: vat, 시작월: 시작월 || today().slice(0, 7), 종료월: 종료월 || '', 활성: 'Y' };
    } else {
      tab = '매출';
      const vat = Math.round(amt / 11);
      행 = { 계약일: 계약일 || today(), 계약명, 클라이언트: 클라이언트 || '', 계약금액: amt, 부가세: vat, 입금상태: 입금상태 || '입금대기', 입금액: num(입금액), 순매출: amt - vat, 마감일: 마감일 || '' };
    }

    const sheets = api();
    // 실제 헤더 읽어 그 순서대로 행 구성(칸 정렬 보장)
    const head = (await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${tab}!1:1` })).data.values?.[0] || [];
    if (!head.length) return NextResponse.json({ ok: false, error: `${tab} 헤더 못읽음` }, { status: 502 });
    const row = head.map((h) => (h in 행 ? 행[h as string] : ''));
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID, range: `${tab}!A1`, valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row as (string | number)[]] },
    });
    invalidateSheets();
    return NextResponse.json({ ok: true, tab });
  } catch (e) {
    logError('/api/office/contract', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
