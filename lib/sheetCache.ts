// 구글시트(Apps Script) 읽기 공용 캐시 — 그 엔드포인트가 호출당 6~8초라, 매번 부르면 느리다.
// 모든 탭을 한 번 받아 짧게 캐시하고, 동시에 들어온 요청은 한 fetch로 합친다(office가 과업+돈 2번 부르던 것도 1번으로).
// 쓰기(add/complete) 후엔 invalidateSheets()로 즉시 무효화.

// Apps Script 읽기가 호출당 6~10초라, 캐시 + SWR(stale-while-revalidate)로 첫 1회 빼곤 항상 즉시 응답.
const SHEET_URL = process.env.SHEET_URL;
const SHEET_KEY = process.env.SHEET_KEY;
const TTL_MS = 120_000; // 2분 지나면 '낡음' → 다음 요청에 즉시 응답하면서 뒤에서 갱신(안 기다림)

type Sheets = Record<string, unknown[][]>;
let cache: { at: number; sheets: Sheets } | null = null;
let inflight: Promise<Sheets> | null = null;

function refresh(): Promise<Sheets> {
  if (inflight) return inflight; // 동시 요청 합치기(중복 fetch 방지)
  inflight = (async () => {
    try {
      const res = await fetch(`${SHEET_URL}?key=${encodeURIComponent(SHEET_KEY!)}`, { cache: 'no-store' });
      const json = await res.json();
      const sheets: Sheets = json.sheets || {};
      cache = { at: Date.now(), sheets };
      return sheets;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export async function getSheets(): Promise<Sheets> {
  if (!SHEET_URL || !SHEET_KEY) throw new Error('SHEET_URL/KEY 미설정');
  if (cache) {
    if (Date.now() - cache.at >= TTL_MS) void refresh(); // 낡았으면 백그라운드 갱신(기다리지 않음)
    return cache.sheets;                                  // 캐시 있으면(낡아도) 즉시 반환 → 사용자 대기 0
  }
  return refresh(); // 캐시 전무(서버 첫 기동/무효화 직후)일 때만 기다림
}

export function invalidateSheets() {
  cache = null; // 쓰기 직후엔 비워서 다음 읽기가 확실히 최신을 가져오게(그 1회만 대기)
}
