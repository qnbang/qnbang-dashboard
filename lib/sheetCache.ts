// 구글시트 읽기 공용 캐시 — 시트 API(서비스계정)로 직접 읽음(~0.6초). 옛 Apps Script 웹앱(7~9초)에서 교체.
// 모든 탭을 한 번 받아 짧게 캐시 + SWR(stale-while-revalidate). 쓰기 후엔 invalidateSheets()로 즉시 무효화.
import { google } from 'googleapis';

const SHEET_ID = process.env.SHEET_ID;
const SA_JSON = process.env.GOOGLE_SA_JSON; // 서비스계정 키 JSON 통째
const TTL_MS = 120_000; // 2분 지나면 '낡음' → 다음 요청에 즉시 응답하면서 뒤에서 갱신(안 기다림)

type Sheets = Record<string, unknown[][]>;
let cache: { at: number; sheets: Sheets } | null = null;
let inflight: Promise<Sheets> | null = null;
let _api: ReturnType<typeof google.sheets> | null = null;

function api() {
  if (!_api) {
    const sa = JSON.parse(SA_JSON!);
    const auth = new google.auth.JWT({ email: sa.client_email, key: sa.private_key, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
    _api = google.sheets({ version: 'v4', auth });
  }
  return _api;
}

function refresh(): Promise<Sheets> {
  if (inflight) return inflight; // 동시 요청 합치기(중복 호출 방지)
  inflight = (async () => {
    try {
      const sheets = api();
      const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID!, fields: 'sheets.properties.title' });
      const titles = (meta.data.sheets || []).map((s) => s.properties?.title).filter((t): t is string => !!t);
      const res = await sheets.spreadsheets.values.batchGet({ spreadsheetId: SHEET_ID!, ranges: titles, valueRenderOption: 'FORMATTED_VALUE' });
      const out: Sheets = {};
      (res.data.valueRanges || []).forEach((vr, i) => { out[titles[i]] = (vr.values as unknown[][]) || []; });
      cache = { at: Date.now(), sheets: out };
      return out;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export async function getSheets(): Promise<Sheets> {
  if (!SHEET_ID || !SA_JSON) throw new Error('SHEET_ID/GOOGLE_SA_JSON 미설정');
  if (cache) {
    if (Date.now() - cache.at >= TTL_MS) void refresh(); // 낡았으면 백그라운드 갱신(기다리지 않음)
    return cache.sheets;                                  // 캐시 있으면(낡아도) 즉시 반환 → 사용자 대기 0
  }
  return refresh(); // 캐시 전무(서버 첫 기동/무효화 직후)일 때만 기다림 (~0.6초)
}

export function invalidateSheets() {
  cache = null; // 쓰기 직후엔 비워서 다음 읽기가 확실히 최신을 가져오게(그 1회만 대기)
}
