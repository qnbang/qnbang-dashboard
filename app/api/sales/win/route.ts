import { NextResponse } from 'next/server';
import { invalidateSheets } from '@/lib/sheetCache';

export const dynamic = 'force-dynamic';

// 영업 → 계약 전환(①) — 영업 대상이 계약되면: 과업 생성 + 매출 원장 등록 + 영업 단계=계약(보드서 빠짐).
const READ_URL = process.env.SHEET_URL;
const WRITE_URL = process.env.SHEET_WRITE_URL
  || 'https://script.google.com/macros/s/AKfycbxPt24eFUbUP1cPwsv5Gspc3pak_hvqIdGf7T4cbvqJSxKkKimCdEhxdSll0yMPJ5dPAw/exec';
const KEY = process.env.SHEET_KEY || 'qnbang2026';

const 영업H = ['id', '대상', '단계', '다음액션', '예상금액', '마지막접촉일', '비고', '갱신일', '출처'];
const 과업H = ['id', '프로젝트', '과업명', '담당자', '공위치', '현재상태', '다음할일', '기한', '고객', '돈종류', '할일', '판정근거', '갱신일', '출처', '계약여부'];
const 매출H = ['계약일', '계약명', '클라이언트', '계약금액', '부가세', '입금상태', '입금일', '입금예정일', '입금액', '순매출', '비고'];

const num = (v: unknown) => Number(String(v ?? '').replace(/[^0-9.]/g, '')) || 0;
const todayKST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
function normCell(v: unknown): string {
  const s = String(v ?? '');
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  }
  return s;
}
async function post(body: object) {
  const r = await fetch(WRITE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json().catch(() => ({}));
}

export async function POST(req: Request) {
  try {
    const { id } = await req.json().catch(() => ({}));
    if (!id || !READ_URL) return NextResponse.json({ ok: false, error: 'id 필요' }, { status: 400 });

    const j = await (await fetch(`${READ_URL}?key=${encodeURIComponent(KEY)}`, { cache: 'no-store' })).json();
    const rows: unknown[][] = j?.sheets?.['영업'];
    if (!Array.isArray(rows) || rows.length < 2) return NextResponse.json({ ok: false, error: '영업 탭 못읽음' }, { status: 502 });
    const head = (rows[0] as unknown[]).map((h) => String(h));
    const gi = (n: string) => head.indexOf(n);
    const data = rows.slice(1).filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''));
    const lead = data.find((r) => String(r[gi('id')]) === String(id));
    if (!lead) return NextResponse.json({ ok: false, error: '영업 대상 없음: ' + id }, { status: 404 });

    const 대상 = String(lead[gi('대상')] ?? '').trim();
    const 금액 = num(lead[gi('예상금액')]);
    const 다음 = String(lead[gi('다음액션')] ?? '').trim();
    const today = todayKST();

    // 1. 과업 생성(내작업)
    const 과업res = await post({ key: KEY, 종류: '과업', 헤더: 과업H, 행: {
      id: 'w' + today.replace(/-/g, '').slice(2) + '-' + Math.random().toString(36).slice(2, 6),
      프로젝트: 대상, 과업명: 다음 || '계약 착수', 담당자: '신종호', 공위치: '내작업',
      현재상태: '계약 직후 — 착수', 다음할일: '', 기한: '', 고객: 대상, 돈종류: '매출',
      할일: '', 판정근거: '', 갱신일: today, 출처: '영업전환', 계약여부: '진행',
    }, 드롭다운: { 공위치: ['받은일', '시작전', '내작업', '내회신', '고객대기', '보류', '완수'], 돈종류: ['매출', '투자'] } });

    // 2. 매출 원장 등록(입금대기). 금액 미정이면 비움.
    const 매출res = await post({ key: KEY, 종류: '매출', 헤더: 매출H, 행: {
      계약일: today, 계약명: 대상, 클라이언트: 대상, 계약금액: 금액 || '', 부가세: '',
      입금상태: '입금대기', 입금일: '', 입금예정일: '', 입금액: 0, 순매출: 금액 || '', 비고: '영업보드 계약전환 ' + today,
    } });

    // 3. 영업 단계 = 계약 (보드서 빠짐) — read→rewrite
    const 행들 = data.map((r) => {
      const row = 영업H.map((h) => normCell(r[head.indexOf(h)] ?? ''));
      if (String(r[gi('id')]) === String(id)) {
        row[영업H.indexOf('단계')] = '계약';
        row[영업H.indexOf('갱신일')] = today;
      }
      return row;
    });
    await post({ key: KEY, 종류: '영업', 헤더: 영업H, 행들, 드롭다운: { 단계: ['접촉', '제안', '계약대기', '계약', '종료'] }, 덮어쓰기: true });

    invalidateSheets();
    if (!과업res.ok || !매출res.ok) return NextResponse.json({ ok: false, error: '일부 기록 실패', 과업res, 매출res }, { status: 502 });
    return NextResponse.json({ ok: true, 대상, 금액, msg: `${대상} 계약 → 과업 생성 + 매출 등록(${금액 ? 금액.toLocaleString() + '원' : '금액 미정'})` });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
