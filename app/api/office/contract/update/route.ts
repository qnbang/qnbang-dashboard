import { NextResponse } from 'next/server';
import { logError } from '@/lib/log';
import { invalidateSheets } from '@/lib/sheetCache';
import { sheetsWriteClient } from '@/lib/sheets';
import { colLetter } from '@/lib/sheetUtil';

export const dynamic = 'force-dynamic';

const SHEET_ID = process.env.SHEET_ID;
const SA_JSON = process.env.GOOGLE_SA_JSON;

const api = sheetsWriteClient;

// 매출 탭에서 계약명+계약금액으로 행을 찾아 입금 정보(입금액·입금일·입금상태) 수정
export async function PATCH(req: Request) {
  try {
    if (!SHEET_ID || !SA_JSON) return NextResponse.json({ ok: false, error: '설정 누락' }, { status: 500 });
    const { 계약명, 계약금액, 입금액, 입금일, 입금상태 } = await req.json().catch(() => ({}));
    if (!계약명) return NextResponse.json({ ok: false, error: '계약명 필요' }, { status: 400 });

    const sheets = api();
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID!, range: '매출' });
    const rows = res.data.values || [];
    if (!rows.length) return NextResponse.json({ ok: false, error: '매출 탭 비어있음' }, { status: 404 });

    const head = rows[0].map((h) => String(h));
    const idxOf = (n: string) => head.indexOf(n);

    // 계약명 매칭 (금액도 체크해 중복 방지)
    let rowIdx = -1;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (String(r[idxOf('계약명')] ?? '') === 계약명) {
        if (!계약금액 || String(r[idxOf('계약금액')] ?? '') === String(계약금액)) { rowIdx = i; break; }
      }
    }
    if (rowIdx < 0) return NextResponse.json({ ok: false, error: '계약 못 찾음' }, { status: 404 });

    const row = [...rows[rowIdx]];
    // 지정된 칸만 덮어쓰기
    const set = (col: string, val: unknown) => { const i = idxOf(col); if (i >= 0 && val !== undefined && val !== null && val !== '') row[i] = String(val); };
    set('입금액', 입금액);
    set('입금일', 입금일);
    set('입금상태', 입금상태);

    const range = `매출!A${rowIdx + 1}:${colLetter(head.length - 1)}${rowIdx + 1}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID!, range, valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });
    invalidateSheets();
    return NextResponse.json({ ok: true, row: rowIdx + 1 });
  } catch (e) {
    logError('/api/office/contract/update', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
