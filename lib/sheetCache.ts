// 구글시트(Apps Script) 읽기 공용 캐시 — 그 엔드포인트가 호출당 6~8초라, 매번 부르면 느리다.
// 모든 탭을 한 번 받아 짧게 캐시하고, 동시에 들어온 요청은 한 fetch로 합친다(office가 과업+돈 2번 부르던 것도 1번으로).
// 쓰기(add/complete) 후엔 invalidateSheets()로 즉시 무효화.

const SHEET_URL = process.env.SHEET_URL;
const SHEET_KEY = process.env.SHEET_KEY;
const TTL_MS = 30_000; // 30초 재사용(탭 전환·중복호출 흡수). 쓰기 후엔 무효화로 즉시 반영.

type Sheets = Record<string, unknown[][]>;
let cache: { at: number; sheets: Sheets } | null = null;
let inflight: Promise<Sheets> | null = null;

export async function getSheets(): Promise<Sheets> {
  if (!SHEET_URL || !SHEET_KEY) throw new Error('SHEET_URL/KEY 미설정');
  if (cache && Date.now() - cache.at < TTL_MS) return cache.sheets;
  if (inflight) return inflight; // 동시 요청은 진행 중인 fetch 하나에 합류(중복 6~8초 방지)
  inflight = (async () => {
    try {
      const res = await fetch(`${SHEET_URL}?key=${encodeURIComponent(SHEET_KEY)}`, { cache: 'no-store' });
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

export function invalidateSheets() {
  cache = null;
}
