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
    }

    // ── 고정비 자동 지출 기록 ── 납부일 오면 그 달 지출탭에 자동 append(멱등). 지금 매달 손으로 넣던 걸 자동화.
    const 고정비 = objs(sheets['고정비']);
    const curMonthTab = `${now.getUTCMonth() + 1}월`;              // 예: '7월'
    const curDay = now.getUTCDate();
    const 월지출 = objs(sheets[curMonthTab]);
    // 이번 달 지출탭에 자동(고정비)로 이미 넣은 항목 집합 — 재실행/중복 방지
    const 이미기록 = new Set(월지출.filter((x) => (x['비고'] || '').includes('자동(고정비)')).map((x) => x['지출 내용']));
    const 지출append: string[][] = [];
    const 지출생성: string[] = [];
    for (const f of 고정비) {
      if ((f['활성'] || 'Y').toUpperCase() === 'N') continue;      // 비활성 고정비 건너뜀
      const day = Number(String(f['납부일'] ?? '').replace(/[^0-9]/g, ''));
      if (!day) continue;                                          // 납부일 없으면 건너뜀(대표가 채워야 함)
      if (curDay < day) continue;                                  // 아직 납부일 전 → 그날 되면 기록
      const 항목 = f['항목'] || '';
      if (!항목 || 이미기록.has(항목)) continue;                    // 이미 이번 달 자동기록됨
      const 금액 = Number(String(f['금액'] ?? '').replace(/[^0-9.-]/g, '')) || 0;
      // 지출 헤더: 날짜, 카테고리, 지출 내용, 비용, 비고, 과업 관리
      지출append.push([`${curYM}-${String(day).padStart(2, '0')}`, f['종류'] || '고정비', 항목, String(금액), '자동(고정비)', '']);
      지출생성.push(항목);
    }
    if (지출append.length) {
      await api().spreadsheets.values.append({
        spreadsheetId: SHEET_ID!, range: `${curMonthTab}!A1`,
        valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS',
        requestBody: { values: 지출append },
      });
    }

    if (toAppend.length || 지출append.length) invalidateSheets();
    return NextResponse.json({ ok: true, 월: curYM, 매출생성: created, 매출건너뜀: skipped.length, 고정비생성: 지출생성 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
