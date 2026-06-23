import { NextResponse } from 'next/server';
import { invalidateSheets } from '@/lib/sheetCache';

export const dynamic = 'force-dynamic';

// 카드 💰 계약 입력 → 매출/정기매출 단일 원장에 기록(자금기록기 Apps Script append).
// 단일 스펙: .지침서/업무시스템-단일화-결정.md §11. 키=계약명(프로젝트)+클라이언트(고객).
const WRITE_URL = process.env.SHEET_WRITE_URL
  || 'https://script.google.com/macros/s/AKfycbxPt24eFUbUP1cPwsv5Gspc3pak_hvqIdGf7T4cbvqJSxKkKimCdEhxdSll0yMPJ5dPAw/exec';
const KEY = process.env.SHEET_KEY || 'qnbang2026';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
const num = (v: unknown) => Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;
async function w(body: Record<string, unknown>) {
  const r = await fetch(WRITE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json().catch(() => ({} as { ok?: boolean; error?: string }));
}

export async function POST(req: Request) {
  try {
    const { 종류, 계약명, 클라이언트, 금액, 입금상태, 입금액, 계약일, 마감일, 시작월, 종료월 } = await req.json().catch(() => ({}));
    if (!계약명 || !금액) return NextResponse.json({ ok: false, error: '계약명·금액 필요' }, { status: 400 });
    const amt = num(금액);

    let 행: Record<string, unknown>;
    let tab: string;
    if (종류 === '정기매출') {
      tab = '정기매출';
      행 = { 항목: 계약명, 클라이언트: 클라이언트 || '', 월금액: amt, 시작월: 시작월 || today().slice(0, 7), 종료월: 종료월 || '', 활성: 'Y' };
    } else {
      tab = '매출';
      행 = { 계약일: 계약일 || today(), 계약명, 클라이언트: 클라이언트 || '', 계약금액: amt, 입금상태: 입금상태 || '입금대기', 입금액: num(입금액), 마감일: 마감일 || '' };
    }
    const u = await w({ key: KEY, 종류: tab, 행 });
    if (!u.ok) return NextResponse.json({ ok: false, error: u.error || '기록 실패' }, { status: 502 });
    invalidateSheets();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
