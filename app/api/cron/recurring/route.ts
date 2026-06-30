import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSheets, invalidateSheets } from '@/lib/sheetCache';

// 정기(구독) 매출 자동 기록 — 매일 1회 실행(크론).
// '정기매출' 탭에 계약을 한 번만 등록(활성=Y)해두면, 매달 그 달 매출행이 없을 때 '매출' 탭에 자동 생성.
// 매출 탭이 단일원장 그대로(이중계산 없음), 멱등(같은 달 두 번 안 만듦). 자동행은 '입금대기'로 — 입금되면 대표가 입금완료 체크.
export const dynamic = 'force-dynamic';

const SHEET_ID = process.env.SHEET_ID;
const SA_JSON = process.env.GOOGLE_SA_JSON;
const KEY = 'qnbang2026';

function api() {
  const sa = JSON.parse(SA_JSON!);
  const auth = new google.auth.JWT({ email: sa.client_email, key: sa.private_key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}

function objs(rows: unknown[][] | undefined): Record<string, string>[] {
  if (!Array.isArray(rows) || rows.length < 2) return [];
  const h = (rows[0] as unknown[]).map((x) => String(x));
  return rows.slice(1)
    .filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''))
    .map((r) => Object.fromEntries(h.map((k, i) => [k, String((r as unknown[])[i] ?? '').trim()])));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const isVercelCron = req.headers.get('x-vercel-cron') !== null;
  if (url.searchParams.get('key') !== KEY && !isVercelCron) {
    return NextResponse.json({ ok: false, error: '권한 없음' }, { status: 401 });
  }
  if (!SHEET_ID || !SA_JSON) return NextResponse.json({ ok: false, error: '설정 누락' }, { status: 500 });
  try {
    const sheets = await getSheets();
    const recur = objs(sheets['정기매출']);
    const mae = objs(sheets['매출']);
    // KST 현재월 (UTC+9)
    const now = new Date(Date.now() + 9 * 3600 * 1000);
    const curYM = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const 기존계약명 = new Set(mae.map((c) => c['계약명']));
    const toAppend: string[][] = [];
    const created: string[] = [], skipped: string[] = [];
    for (const r of recur) {
      if ((r['활성'] || '').toUpperCase() !== 'Y') continue;          // 비활성/종료 계약 건너뜀
      const s = r['시작월'] || '', e = r['종료월'] || '';
      if (s && curYM < s) continue;                                   // 아직 시작 전
      if (e && curYM > e) continue;                                   // 이미 종료
      const 항목 = r['항목'] || '정기', 클 = r['클라이언트'] || '';
      const 계약명 = `${항목} (정기 ${curYM})`;                        // 멱등 키
      if (기존계약명.has(계약명)) { skipped.push(계약명); continue; }   // 이미 이번 달 행 있음
      const 월금액 = Number(String(r['월금액'] ?? '').replace(/[^0-9.-]/g, '')) || 0;
      // 매출 헤더: 계약일,계약명,클라이언트,계약금액,부가세,입금상태,입금일,입금예정일,입금액,순매출,비고
      toAppend.push([`${curYM}-01`, 계약명, 클, String(월금액), r['부가세'] || '', '입금대기', '', r['입금예정일'] || '', '', String(월금액), '자동(정기매출)']);
      created.push(계약명);
    }
    if (toAppend.length) {
      await api().spreadsheets.values.append({
        spreadsheetId: SHEET_ID!, range: '매출!A1',
        valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS',
        requestBody: { values: toAppend },
      });
      invalidateSheets();
    }
    return NextResponse.json({ ok: true, 월: curYM, 생성: created, 건너뜀: skipped.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
