// 구글시트 값(2차원 배열)을 다루는 공용 헬퍼 — 여러 lib·API 라우트에 중복 구현되던 걸 하나로 모음.

// 시트 열 번호(0-기준) → A1 표기 알파벳(A, B, …, Z, AA, …).
// lib/gitSync.ts·office/sales 라우트 여럿에 같은 로직이 반복돼 있었음.
export function colLetter(n: number): string {
  let s = '';
  for (let i = n; i >= 0; i = Math.floor(i / 26) - 1) s = String.fromCharCode(65 + (i % 26)) + s;
  return s;
}

// 시트 2차원 배열(첫 행=헤더) → 헤더 기준 객체 배열.
// withRow=false(기본): 완전히 빈 행은 걸러내고, 값은 트림된 문자열로 반환(archive.ts·crm.ts·companyMap.ts·
//   app/api/posts·app/api/cron/recurring 방식).
// withRow=true: 각 객체에 _row(실제 시트 행 번호, 헤더=1행 기준)를 추가하고 값은 원본 타입 그대로 둔다(트림 안 함,
//   money.ts 방식 — 필터도 '_row는 무시하고 나머지 칸에 값이 있는지'로 살짝 다르다).
export function sheetToObjects(sheet: unknown[][] | undefined, withRow: true): Record<string, unknown>[];
export function sheetToObjects(sheet: unknown[][] | undefined, withRow?: false): Record<string, string>[];
export function sheetToObjects(sheet: unknown[][] | undefined, withRow = false): Record<string, unknown>[] {
  if (!Array.isArray(sheet) || sheet.length < 2) return [];
  const head = (sheet[0] as unknown[]).map((h) => String(h));

  if (!withRow) {
    return sheet.slice(1)
      .filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''))
      .map((r) => Object.fromEntries(head.map((h, i) => [h, String((r as unknown[])[i] ?? '').trim()])));
  }

  return sheet.slice(1)
    .map((r, i) => {
      const obj: Record<string, unknown> = Object.fromEntries(head.map((h, j) => [h, Array.isArray(r) ? (r as unknown[])[j] : undefined]));
      obj['_row'] = i + 2; // 헤더=1행, 첫 데이터=2행
      return obj;
    })
    .filter((r) => head.some((h) => h !== '_row' && String(r[h] ?? '').trim() !== ''));
}
