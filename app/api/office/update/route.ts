import { NextResponse } from 'next/server';
import { invalidateSheets } from '@/lib/sheetCache';

export const dynamic = 'force-dynamic';

// 과업 수정/삭제(P9) — id로 한 건 patch 또는 delete.
// 엔드포인트가 단일행 수정 불가 → 과업 탭 읽어 해당 행만 고치거나 빼고 '덮어쓰기'. 날짜 ISO 왕복 손상 정규화.
const READ_URL = process.env.SHEET_URL;
const WRITE_URL = process.env.SHEET_WRITE_URL
  || 'https://script.google.com/macros/s/AKfycbxPt24eFUbUP1cPwsv5Gspc3pak_hvqIdGf7T4cbvqJSxKkKimCdEhxdSll0yMPJ5dPAw/exec';
const KEY = process.env.SHEET_KEY || 'qnbang2026';
const HEADER = ['id', '프로젝트', '과업명', '담당자', '공위치', '현재상태', '다음할일',
  '기한', '고객', '돈종류', '할일', '판정근거', '갱신일', '출처', '계약여부'];
const 공위치_LIST = ['시작전', '내작업', '내회신', '고객대기', '보류', '완수'];
const 돈종류_LIST = ['매출', '투자'];
const PATCHABLE = ['프로젝트', '과업명', '담당자', '공위치', '현재상태', '다음할일', '기한', '고객', '돈종류', '할일'];

function normCell(v: unknown): string {
  const s = String(v ?? '');
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  }
  return s;
}
function todayKST() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }); }

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id, patch, delete: del } = body;
    if (!id || !READ_URL) return NextResponse.json({ ok: false, error: 'id 필요' }, { status: 400 });

    const j = await (await fetch(`${READ_URL}?key=${encodeURIComponent(KEY)}`, { cache: 'no-store' })).json();
    const rows: unknown[][] = j?.sheets?.['과업'];
    if (!Array.isArray(rows) || rows.length < 2) return NextResponse.json({ ok: false, error: '과업 탭 못읽음' }, { status: 502 });
    const head = (rows[0] as unknown[]).map((h) => String(h));
    const idIdx = head.indexOf('id');
    const data = rows.slice(1).filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''));
    // 안전장치: 읽기가 비정상적으로 적게 돌아오면(일시적 읽기 오류) 전체 덮어쓰기 중단 — 대량 유실 방지.
    if (data.length < 5) return NextResponse.json({ ok: false, error: `과업이 ${data.length}건만 읽혀 저장을 막았어요(읽기 오류 의심). 잠시 후 다시 시도하세요.` }, { status: 503 });
    const exists = data.some((r) => String(r[idIdx]) === String(id));
    if (!exists) return NextResponse.json({ ok: false, error: '해당 과업 없음: ' + id }, { status: 404 });

    // HEADER 순서 행 배열로 정규화(+ 대상 행은 patch 적용)
    const idxOf = (name: string) => head.indexOf(name);
    const 행들 = data
      .filter((r) => del ? String(r[idIdx]) !== String(id) : true)
      .map((r) => {
        const row = HEADER.map((h) => normCell(r[idxOf(h)] ?? ''));
        if (!del && String(r[idIdx]) === String(id) && patch && typeof patch === 'object') {
          for (const k of PATCHABLE) {
            if (k in patch) row[HEADER.indexOf(k)] = String(patch[k] ?? '');
          }
          row[HEADER.indexOf('갱신일')] = todayKST(); // 수정하면 갱신일 갱신(노화 리셋)
        }
        return row;
      });

    const res = await fetch(WRITE_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: KEY, 종류: '과업', 헤더: HEADER, 행들, 드롭다운: { 공위치: 공위치_LIST, 돈종류: 돈종류_LIST }, 덮어쓰기: true }),
    });
    const out = await res.json().catch(() => ({}));
    if (!out.ok) return NextResponse.json({ ok: false, error: out.error || '저장 실패' }, { status: 502 });
    invalidateSheets();
    return NextResponse.json({ ok: true, 과업수: 행들.length, action: del ? 'deleted' : 'updated' });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
