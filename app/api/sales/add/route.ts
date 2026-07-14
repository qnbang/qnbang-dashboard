import { NextResponse } from 'next/server';
import { logError, logAudit } from '@/lib/log';
import { invalidateSheets } from '@/lib/sheetCache';
import { todayKST } from '@/lib/date';

export const dynamic = 'force-dynamic';

// 영업 대상 빠른추가(P8) — 한 줄 → 영업 시트탭 기록.
const WRITE_URL = process.env.SHEET_WRITE_URL
  || 'https://script.google.com/macros/s/AKfycbxPt24eFUbUP1cPwsv5Gspc3pak_hvqIdGf7T4cbvqJSxKkKimCdEhxdSll0yMPJ5dPAw/exec';
const KEY = process.env.SHEET_KEY || 'qnbang2026';
const HEADER = ['id', '대상', '단계', '다음액션', '예상금액', '마지막접촉일', '비고', '갱신일', '출처'];
const 단계_LIST = ['접촉', '제안', '계약대기', '계약', '종료'];

const STAGE_WORDS: Record<string, string> = {
  접촉: '접촉', 문의: '접촉', 리드: '접촉',
  제안: '제안', 견적: '제안',
  계약대기: '계약대기', 계약: '계약대기', 사인: '계약대기', 착수금: '계약대기',
};

// "망원카페 브랜딩 제안 200만" → 대상=망원카페, 단계=제안, 예상금액=2000000, 다음액션=브랜딩
function parseLine(line: string) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  let 단계 = '', 금액 = '';
  const rest: string[] = [];
  for (const tk of tokens) {
    if (!단계 && STAGE_WORDS[tk]) { 단계 = STAGE_WORDS[tk]; continue; }
    const man = tk.match(/^(\d+)만$/);
    const won = tk.match(/^(\d[\d,]{2,})$/);
    if (!금액 && man) { 금액 = String(Number(man[1]) * 10000); continue; }
    if (!금액 && won) { 금액 = won[1].replace(/,/g, ''); continue; }
    rest.push(tk);
  }
  return { 대상: rest[0] || '', 다음액션: rest.slice(1).join(' '), 단계: 단계 || '접촉', 예상금액: 금액 };
}

export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const p = b.line ? parseLine(String(b.line)) : {
      대상: b.대상 || b.target || '', 다음액션: b.다음액션 || '', 단계: b.단계 || '접촉', 예상금액: b.예상금액 || '',
    };
    if (!p.대상) return NextResponse.json({ ok: false, error: '영업 대상 이름이 있어야 해요' }, { status: 400 });
    const today = todayKST();
    const 행: Record<string, string> = {
      id: 's' + today.replace(/-/g, '').slice(2) + '-' + Math.random().toString(36).slice(2, 7),
      대상: p.대상, 단계: p.단계, 다음액션: p.다음액션,
      예상금액: p.예상금액 || '',   // 비우면 협의 전
      마지막접촉일: today, 비고: '', 갱신일: today, 출처: '대시보드',
    };
    const res = await fetch(WRITE_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: KEY, 종류: '영업', 헤더: HEADER, 행, 드롭다운: { 단계: 단계_LIST } }),
    });
    const out = await res.json().catch(() => ({}));
    if (!out.ok) return NextResponse.json({ ok: false, error: out.error || '기록 실패', 행 }, { status: 502 });
    invalidateSheets();
    logAudit('/api/sales/add', '영업대상 추가', { id: 행.id, 대상: 행.대상, 단계: 행.단계, 예상금액: 행.예상금액 });
    return NextResponse.json({ ok: true, 행 });
  } catch (e) {
    logError('/api/sales/add', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
