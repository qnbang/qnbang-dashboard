import { NextResponse } from 'next/server';
import { logError } from '@/lib/log';
import { invalidateSheets } from '@/lib/sheetCache';
import { todayKST } from '@/lib/date';

export const dynamic = 'force-dynamic';

// 과업 빠른추가(P3a) — 대시보드 입력칸 → 서버에서 자금기록기 '과업' 탭에 한 줄 기록.
// 쓰기 엔드포인트는 read와 다름(자금기록기). env 우선, 없으면 알려진 전체 URL(시스템지도·memory에 저장됨).
const WRITE_URL = process.env.SHEET_WRITE_URL
  || 'https://script.google.com/macros/s/AKfycbxPt24eFUbUP1cPwsv5Gspc3pak_hvqIdGf7T4cbvqJSxKkKimCdEhxdSll0yMPJ5dPAw/exec';
const KEY = process.env.SHEET_KEY || 'qnbang2026';

// 과업POST.py·gitSync.ts HEADER 와 동일한 18칸(단일 진실원) — 분류·메모·저장소까지 한 번에 써져야 팀원 입력도 신종호 경로(과업POST.py)와 같아짐
const HEADER = ['id', '프로젝트', '과업명', '담당자', '공위치', '현재상태', '다음할일',
  '기한', '고객', '돈종류', '할일', '판정근거', '갱신일', '출처', '계약여부', '분류', '메모', '저장소'];
const 공위치_LIST = ['받은일', '시작전', '내작업', '내회신', '고객대기', '보류', '완수']; // 받은일 포함 — 드래그로 받은일 이동한 셀이 드롭다운 경고 안 뜨게(office.ts POS2BALL과 동일 어휘)
const 돈종류_LIST = ['매출', '투자'];

// 한 줄에서 공위치 단어(한글/영문/약어) → 표준 라벨
const POS_WORDS: Record<string, string> = {
  '시작전': '시작전', start: '시작전', '착수전': '시작전',
  '내작업': '내작업', mywork: '내작업', '작업': '내작업',
  '내회신': '내회신', myreply: '내회신', '회신': '내회신',
  '고객대기': '고객대기', client: '고객대기', '고객': '고객대기', '대기': '고객대기',
  '보류': '보류', hold: '보류',
  '완수': '완수', done: '완수', '완료': '완수',
};

// "소리쉼 시안 client 6/20" 같은 한 줄을 과업 필드로 약식 파싱.
// 규칙: 공위치 단어 1개 + 날짜(YYYY-MM-DD 또는 M/D) 1개를 빼내고, 남은 토큰의 첫 단어=프로젝트, 나머지=과업명.
function parseLine(line: string) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  let ball = '', due = '';
  const rest: string[] = [];
  for (const tk of tokens) {
    const low = tk.toLowerCase();
    if (!ball && POS_WORDS[tk]) { ball = POS_WORDS[tk]; continue; }
    if (!ball && POS_WORDS[low]) { ball = POS_WORDS[low]; continue; }
    const iso = tk.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    const md = tk.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (!due && iso) { due = `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`; continue; }
    if (!due && md) { due = `2026-${md[1].padStart(2, '0')}-${md[2].padStart(2, '0')}`; continue; }
    rest.push(tk);
  }
  return { 프로젝트: rest[0] || '', 과업명: rest.slice(1).join(' ') || '', 공위치: ball || '내작업', 기한: due };
}

export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    // 구조 입력(폼) 우선, 없으면 line 약식 파싱
    // 받은일(inbox)은 빈 공위치로 저장(office.ts 규칙: unset=받은일 바구니). 그 외는 라벨 그대로.
    const ball0 = b.ball === '받은일' || b.ball === 'inbox' ? '' : (b.ball || '내작업');
    const p = b.line ? parseLine(String(b.line)) : {
      프로젝트: b.project || '', 과업명: b.task || '', 공위치: ball0, 기한: b.due || '',
    };
    if (!p.프로젝트 && !p.과업명) {
      return NextResponse.json({ ok: false, error: '프로젝트나 과업명 중 하나는 있어야 해요' }, { status: 400 });
    }
    const today = todayKST();
    const 행: Record<string, string> = {
      id: 'd' + today.replace(/-/g, '').slice(2) + '-' + Math.random().toString(36).slice(2, 7),
      프로젝트: p.프로젝트 || p.과업명,
      과업명: p.과업명 || p.프로젝트,
      담당자: b.owner || '신종호',
      공위치: p.공위치,
      현재상태: b.status || '',
      다음할일: b.nextStep || '',
      기한: p.기한 || '',
      고객: b.customer || '',
      돈종류: b.money || '매출',
      할일: String(b.할일 || b.steps || ''), // 액션플랜(단계 @날짜, ;로 구분) — 새프로젝트 등록 시 한 번에
      판정근거: '',
      갱신일: today,
      출처: String(b.출처 || '대시보드'),
      분류: String(b.category || ''),  // 도구·리서치 등 — 분류=도구면 자체사업 탭 카드로 자동 합류
      메모: String(b.memo || ''),      // 첫 줄=카드 설명, https 줄=열기 버튼
      저장소: String(b.repo || ''),    // 깃 repo slug — git-sync 크론과의 이중등록 방지 열쇠
    };
    // '처리됨으로(완수)'는 과업 탭이 아니라 아카이브 탭에 직행 — 과업 탭의 완수 행은 화면 어디에도 안 그려져 증발함(complete 라우트와 같은 목적지)
    const 탭 = p.공위치 === '완수' ? '아카이브' : '과업';
    const res = await fetch(WRITE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: KEY, 종류: 탭, 헤더: HEADER, 행,
        드롭다운: { 공위치: 공위치_LIST, 돈종류: 돈종류_LIST } }),
    });
    const out = await res.json().catch(() => ({}));
    if (!out.ok) return NextResponse.json({ ok: false, error: out.error || '기록 실패', 행 }, { status: 502 });
    invalidateSheets(); // 방금 쓴 게 바로 보이게 캐시 무효화
    return NextResponse.json({ ok: true, 행 });
  } catch (e) {
    logError('/api/office/add', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
