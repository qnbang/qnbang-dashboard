'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MonthlyBar, CategoryPie } from './components/charts';
import OfficeBoardView from './components/OfficeBoardView';
import ProjectArchiveView from './components/ProjectArchiveView';
import ProjectDocs from './components/ProjectDocs';
import BizOps from './components/BizOps';
import { renderMarkdown } from '@/lib/markdown';
import { Loading, ErrorBox } from './components/ui';
import { type WorkTool, BRANDS, WORK_TOOLS, LAB } from './components/bizCatalog';

type Expense = {
  _row: number;
  month: number;
  date: string;
  dateLabel: string;
  category: string;
  content: string;
  cost: number;
  note: string;
};
type DashboardData = {
  monthly: { month: string; total: number }[];
  byCategory: { category: string; total: number }[];
  recent: Expense[];
  expenses: Expense[];
  yearTotal: number;
  thisMonthTotal: number;
  count: number;
};

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

const TABS = [
  { key: 'office', label: '🏢 사무실', ready: true },
  { key: 'tools', label: '🚀 자체사업', ready: true },
  { key: 'archive', label: '📋 프로젝트', ready: true },
  { key: 'posts', label: '📝 게시판', ready: true },
  { key: 'crm', label: '👥 고객·영업', ready: true },
  { key: 'hubs', label: '협업 허브', ready: true },
  { key: 'shares', label: '공유된 문서', ready: true },
  { key: 'finance', label: '정산', ready: true },
];

// 협업 허브 — 협업사·클라이언트에게 건네는 "프로젝트 진행 공유 창구" 모음.
// 각 허브는 그 프로젝트의 종합 공유 페이지(진행 체크리스트 + 공유 문서 + 디자인 시안 묶음).
// 새 협업 프로젝트가 생기면 허브 페이지를 만들어 여기에 한 줄 추가하면 됩니다.
const COLLAB_HUBS = [
  {
    project: '망원 야간 보물찾기',
    client: '망리단길골목형상점가 상인회 협업',
    desc: '마포구 야간·음식문화 지원사업 — 골목 QR 보물찾기 + 영수증 빙고. 회의록·진행 체크리스트를 한 곳에서.',
    url: 'https://dashboard.qnbang.com/hub/mangwon',
    emoji: '🔦',
    color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  },
  {
    project: 'M650 탄광문화축제',
    client: '강원랜드 · 씨투아 협업',
    desc: '제안서 디벨롭 — 석탄이 스토리라인 정렬, 진행 체크리스트·공유 문서·디자인 시안을 한 곳에서.',
    url: 'https://dashboard.qnbang.com/hub/m650',
    reviewKey: 'm650', // 내부 검토(장표별 개선안에 코멘트 달기) — 로그인 필요
    emoji: '⛏️',
    color: 'bg-amber-50 text-amber-600 border-amber-200',
  },
];

// 자체사업 탭 — 브랜드 / 큐앤뱅 서비스(도구) / 실험실 3단. 카탈로그 본체는 bizCatalog.ts(회사지도와 공유).

export default function Home() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('office');

  // 새로고침해도 보던 섹션 유지 — 현재 탭을 URL 해시(#office 등)에 담아 두고, 열 때 그 해시로 복원.
  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (h && TABS.some((t) => t.key === h)) setTab(h);
  }, []);
  const goTab = (key: string) => { setTab(key); window.location.hash = key; };

  useEffect(() => {
    fetch('/api/data')
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j.data);
        else setError(j.error || '데이터를 불러오지 못했습니다.');
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen">
      <header className="glass-header sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-800">큐앤뱅 대시보드</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/tax-invoice"
              className="text-sm font-medium rounded-lg bg-slate-800 text-white px-3 py-1.5 hover:bg-slate-700"
            >
              세금계산서 발행
            </Link>
            <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-800">
              로그아웃
            </button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => goTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                tab === t.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {t.label}
              {!t.ready && <span className="ml-1 text-[10px] text-slate-300">준비중</span>}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {tab === 'office' && <OfficeBoardView />}
        {tab === 'archive' && <ProjectArchiveView />}
        {tab === 'posts' && <PostsView />}
        {tab === 'crm' && <CRMView />}
        {tab === 'finance' && <FinanceView data={data} loading={loading} error={error} />}
        {tab === 'shares' && <SharesView />}
        {tab === 'hubs' && <HubsView />}
        {tab === 'tools' && <BizView />}
      </main>
    </div>
  );
}

type RevContract = {
  _row: number;
  입금일full: string;
  계약일: string; 계약명: string; 클라이언트: string;
  계약금액: number; 부가세: number; 공급가: number; 입금액: number; 미수금: number;
  입금상태: string; 입금일: string; 입금예정일: string; 미수종류: '받을예정' | '단순미수' | ''; 순매출: number;
};
type LaborRow = {
  _row: number;
  월: string; 구분: string; 이름: string;
  세전: number; 공제: number; 실지급: number;
  지급상태: string; 지급일: string; 비고: string;
};
type RevMoney = {
  순매출누계: number; 미수금합: number; 받을예정합: number; 단순미수합: number;
  고정비월합: number; 계약건수: number;
  월별: { 월: string; 순매출: number; 계약액: number; 실현: number }[];
  계약목록: RevContract[];
  고정비목록?: { 항목: string; 금액: number; 납부일: string; 종류: string }[];
  인건비목록?: LaborRow[];
  잔고?: { 통장잔고: number; 세이프박스: number; 보유현금: number; 업데이트: string };
};
type BudgetData = {
  기준월: string; 전월: string; 재원: number; 부가세적립: number; 기본급: number; 고정비: number; 세금적립: number;
  여유: number; 등급: '적자' | '빠듯' | '보통' | '좋음';
  상여권장: number; 비상금적립: number; 저축: number; 써도되는돈: number;
  이미쓴돈: number; 남은한도: number; 비상금인출: number; 비상금잔액: number; 비상금목표: number;
  전월지출: number; 코멘트: string[];
};

const 지출카테고리 = ['실비', '업무비', '식비', '프로그램 사용료', '월세&공과금', '재료비', '세금', '급여'];
// 프리랜서 3.3% 공제 (10원 미만 절사: 소득세 3% + 지방소득세 0.3%)
function 프리랜서공제(세전: number) {
  const 소득세 = Math.floor(세전 * 0.03 / 10) * 10;
  const 지방세 = Math.floor(소득세 * 0.1 / 10) * 10;
  return 소득세 + 지방세;
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseM(d: string) {
  const m = d.replace(/[./]/g, '-').replace(/\s/g, '').match(/\d{4}-(\d{1,2})/);
  return m ? parseInt(m[1]) : 0;
}

// 날짜 문자열 → 폼 input[type=date] 용 ISO (YYYY-MM-DD)
function toISO(s: string) {
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  const n = s.replace(/[/.]/g, '-').replace(/\s/g, '');
  return /^\d{4}-\d{1,2}-\d{1,2}$/.test(n) ? n.split('-').map((v, i) => i === 0 ? v : v.padStart(2, '0')).join('-') : s;
}

// 날짜 문자열 → 짧게 표시 (6/5 또는 6월)
function fmtDate(s: string) {
  if (!s) return '';
  const m = s.replace(/[/.]/g, '-').match(/\d{4}-(\d{1,2})-(\d{1,2})/);
  if (m) return `${parseInt(m[1])}/${parseInt(m[2])}`;
  const m2 = s.replace(/[/.]/g, '-').match(/\d{4}-(\d{1,2})/);
  if (m2) return `${parseInt(m2[1])}월`;
  return s;
}

// 정산 탭 — 매출·지출 통합, 수정 가능
function FinanceView({ data, loading, error }: { data: DashboardData | null; loading: boolean; error: string }) {
  const [money, setMoney] = useState<RevMoney | null>(null);
  const [budget, setBudget] = useState<BudgetData | null>(null);
  const [moneyLoading, setMoneyLoading] = useState(true);
  const [moneyErr, setMoneyErr] = useState('');
  const [localExp, setLocalExp] = useState<Expense[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'rev' | 'exp'>('all');
  const [selMonth, setSelMonth] = useState<'all' | number>('all');
  const [panel, setPanel] = useState<{ isNew: boolean; formType: 'rev' | 'exp' | 'labor'; rowNum?: number; monthStr?: string } | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [openList, setOpenList] = useState<'recv' | 'pay' | null>(null); // 미수금·미지급금 카드 클릭 → 목록 펼침

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const reloadMoney = () => {
    setMoneyLoading(true);
    fetch('/api/office').then(r => r.json()).then(j => {
      if (j.ok) { setMoney(j.money); setBudget(j.budget ?? null); }
    }).catch(console.error).finally(() => setMoneyLoading(false));
  };

  const reloadExp = async () => {
    const j = await fetch('/api/data').then(r => r.json()).catch(() => null);
    if (j?.ok) setLocalExp(j.data.expenses);
  };

  useEffect(() => { reloadMoney(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !data || moneyLoading) return <Loading text="정산 불러오는 중" pad="py-20" />;
  if (error) return <ErrorBox msg={error} pad="py-20" />;

  const expenses = localExp ?? (data.expenses || []);

  type Row = {
    date: string; dateFull: string; label: string; extra: string;
    amount: number; type: 'rev' | 'exp'; month: number;
    _rowNum: number; _monthStr: string; _cat: string; _note: string;
    _client: string; _status: string; _contractDate: string;
  };

  const revRows: Row[] = (money?.계약목록 || [])
    .filter(c => c.입금액 > 0)
    .map(c => ({
      date: fmtDate(c.입금일full || c.입금일),
      dateFull: (c.입금일full || c.입금일).replace(/[./]/g, '-'),
      label: c.계약명, extra: c.클라이언트 || '',
      amount: c.입금액, type: 'rev',
      month: parseM(c.입금일full || c.입금일),
      _rowNum: c._row, _monthStr: '', _cat: '', _note: '',
      _client: c.클라이언트, _status: c.입금상태, _contractDate: c.계약일,
    }));

  const expRows: Row[] = expenses.map(e => ({
    date: fmtDate(e.date) || e.dateLabel,
    dateFull: e.date,
    label: e.content, extra: e.category,
    amount: e.cost, type: 'exp',
    month: e.month,
    _rowNum: e._row, _monthStr: `${e.month}월`, _cat: e.category, _note: e.note,
    _client: '', _status: '', _contractDate: '',
  }));

  const allMonths = Array.from(new Set([
    ...revRows.map(r => r.month), ...expRows.map(r => r.month),
  ].filter(m => m > 0))).sort((a, b) => a - b);

  const filtRev = selMonth === 'all' ? revRows : revRows.filter(r => r.month === selMonth);
  const filtExp = selMonth === 'all' ? expRows : expRows.filter(r => r.month === selMonth);
  const revTotal = filtRev.reduce((s, r) => s + r.amount, 0);
  const expTotal = filtExp.reduce((s, r) => s + r.amount, 0);
  const net = revTotal - expTotal;

  const combined = [...filtRev, ...filtExp].sort((a, b) => b.dateFull.localeCompare(a.dateFull));
  const shown = filter === 'all' ? combined : combined.filter(r => r.type === filter);

  // ── 10일 정산 파생값 ──────────────────────────────────────────────
  // 지급 규칙: 귀속월 M의 인건비는 M+1월 10일에 지급 (예: 6월분 급여 → 7/10 지급)
  const labor = money?.인건비목록 || [];
  const now = new Date();
  const curYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYM = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  // 정산 카드 = 지급 안 된 인건비 전부(귀속월 무관 — 다음 10일에 나갈 돈) + 이번달에 지급 처리된 것(✓)
  const 대기인건비 = labor.filter(l => l.지급상태 !== '지급완료');
  const 최근지급 = labor.filter(l => l.지급상태 === '지급완료' && (l.지급일 || '').startsWith(curYM));
  const cardLabor = [...대기인건비, ...최근지급];
  const 직원분 = cardLabor.filter(l => l.구분 === '직원');
  const 프리분 = cardLabor.filter(l => l.구분 === '프리랜서');
  const 기타분 = cardLabor.filter(l => l.구분 !== '직원' && l.구분 !== '프리랜서');

  // 원천세·근로소득세 등 세금은 세무사 고지대로 매달 납부하며 지출(세금)로 기록 — 대시보드가 따로 계산하지 않음(오판 방지, 2026-07-07 교훈)

  // 미지급금(역미수) = 지급 안 된 인건비 전체 누적
  const 미지급인건비 = labor.filter(l => l.지급상태 !== '지급완료');
  const 미지급금합 = 미지급인건비.reduce((s, l) => s + l.실지급, 0);
  const 예상손익 = net + (money?.미수금합 ?? 0) - 미지급금합;

  // 부가세 적립 권장 = 전월 입금분 부가세 합 (세이프박스 이체용 참고치 — 지출 아님)
  const 부가세권장 = (money?.계약목록 || []).filter(c => c.입금일 === prevYM && c.입금액 > 0).reduce((s, c) => s + c.부가세, 0);

  // 고정비 — 이번달 기록 여부(크론이 납부일에 자동 기록, 비고=자동(고정비))
  const 고정비기록됨 = new Set(expenses.filter(e => e.month === now.getMonth() + 1 && (e.note || '').includes('자동(고정비)')).map(e => e.content));
  const 고정비목록 = (money?.고정비목록 || []).slice().sort((a, b) => {
    const d = (s: string) => /말/.test(s) ? 31 : Number(String(s).replace(/[^0-9]/g, '')) || 99;
    return d(a.납부일) - d(b.납부일);
  });

  const day = now.getDate();
  const dday = day < 10 ? `D-${10 - day}` : day === 10 ? 'D-DAY' : '10일 지남';
  const 십일합계 = 대기인건비.reduce((s, l) => s + l.실지급, 0);

  const reloadAll = () => Promise.all([reloadMoney(), reloadExp()]);

  const payLabor = async (l: LaborRow) => {
    let 카테고리: string | undefined;
    if (l.구분 !== '직원' && l.구분 !== '프리랜서') {
      // ponytail: 기타 항목 카테고리는 prompt로 — 전용 UI는 기타가 잦아지면 그때
      카테고리 = window.prompt(`지출 카테고리 입력:\n${지출카테고리.join(' / ')}`, '업무비') || '';
      if (!카테고리) return;
    }
    if (!confirm(`${l.이름} ${won(l.실지급)} 지급확인할까요?\n(통장에서 실제 이체된 뒤에 눌러주세요 — 오늘 날짜로 지출 기록됩니다)`)) return;
    const res = await fetch('/api/office/labor', { method: 'PATCH', body: JSON.stringify({ action: 'pay', rowNum: l._row, 지급일: todayISO(), 카테고리 }), headers: { 'Content-Type': 'application/json' } });
    const j = await res.json().catch(() => ({ ok: res.ok }));
    if (!res.ok || j.ok === false) { alert('지급확인 실패: ' + (j.error || res.status)); return; }
    await reloadAll();
  };

  const copyRoster = async () => {
    // 귀속월 M은 M+1/10 지급 → 지금 준비할 명단 = 지난달(prevYM) 귀속분
    if (!confirm(`귀속 ${prevYM} 인건비 명단을 만들까요? (그 전달 명단을 복사, 전부 '대기' 상태)`)) return;
    const res = await fetch('/api/office/labor', { method: 'POST', body: JSON.stringify({ action: 'copy', to: prevYM }), headers: { 'Content-Type': 'application/json' } });
    const j = await res.json().catch(() => ({ ok: res.ok }));
    if (!res.ok || j.ok === false) { alert(j.error || '복사 실패'); return; }
    await reloadAll();
  };

  const openAddLabor = () => {
    setForm({ lMonth: prevYM, lType: '프리랜서', lName: '', lGross: '', lDeduct: '', lNote: '' });
    setPanel({ isNew: true, formType: 'labor' });
  };
  const openEditLabor = (l: LaborRow) => {
    setForm({ lMonth: l.월, lType: l.구분, lName: l.이름, lGross: String(l.세전), lDeduct: String(l.공제), lNote: l.비고 });
    setPanel({ isNew: false, formType: 'labor', rowNum: l._row });
  };
  const deleteLabor = async (l: LaborRow) => {
    if (!confirm(`"${l.이름} (${l.월})" 인건비 행을 삭제할까요?`)) return;
    await fetch('/api/office/labor', { method: 'DELETE', body: JSON.stringify({ rowNum: l._row }), headers: { 'Content-Type': 'application/json' } });
    await reloadAll();
  };
  // ────────────────────────────────────────────────────────────────

  const openAdd = (formType: 'rev' | 'exp') => {
    const curM = selMonth === 'all' ? new Date().getMonth() + 1 : selMonth;
    setForm({ monthStr: `${curM}월`, status: '입금완료' });
    setPanel({ isNew: true, formType });
  };

  const openEdit = (row: Row) => {
    setForm({
      date: toISO(row.dateFull || row.date),
      label: row.label, client: row._client,
      amount: String(row.amount), cat: row._cat,
      status: row._status || '입금완료', note: row._note,
      monthStr: row._monthStr,
      contractDate: toISO(row._contractDate),
    });
    setPanel({ isNew: false, formType: row.type, rowNum: row._rowNum, monthStr: row._monthStr });
  };

  const handleSave = async () => {
    if (!panel) return;
    setSaving(true);
    try {
      let res: Response;
      if (panel.formType === 'labor') {
        const 세전 = Number(form.lGross) || 0;
        const 공제 = Number(form.lDeduct) || 0;
        const body: Record<string, string | number> = {
          월: form.lMonth || '', 구분: form.lType || '', 이름: form.lName || '',
          세전, 공제, 실지급: 세전 - 공제, 비고: form.lNote || '',
        };
        if (!panel.isNew) body.rowNum = panel.rowNum!;
        res = await fetch('/api/office/labor', { method: panel.isNew ? 'POST' : 'PATCH', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
      } else if (panel.formType === 'exp') {
        const body: Record<string, string | number> = {
          month: form.monthStr || panel.monthStr || '1월',
          날짜: form.date || '', 카테고리: form.cat || '',
          지출내용: form.label || '', 비용: Number(form.amount) || 0, 비고: form.note || '',
        };
        if (!panel.isNew) body.rowNum = panel.rowNum!;
        res = await fetch('/api/office/expense', { method: panel.isNew ? 'POST' : 'PATCH', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
      } else {
        const body: Record<string, string | number> = {
          계약일: form.contractDate || '', 계약명: form.label || '',
          클라이언트: form.client || '', 입금상태: form.status || '입금완료',
          입금일: form.date || '', 입금액: Number(form.amount) || 0, 비고: form.note || '',
        };
        if (!panel.isNew) body.rowNum = panel.rowNum!;
        res = await fetch('/api/office/revenue', { method: panel.isNew ? 'POST' : 'PATCH', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
      }
      // 저장 성공 확인 후에만 폼 닫기 — 실패면 폼 유지 + 알림(입력값 날아가지 않게)
      const j = await res.json().catch(() => ({ ok: res.ok }));
      if (!res.ok || j.ok === false) { alert('저장 실패: ' + (j.error || res.status)); return; }
      setPanel(null);
      await Promise.all([reloadMoney(), reloadExp()]);
    } catch (e) {
      alert('저장 실패: ' + String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: Row) => {
    if (!confirm(`"${row.label}" 삭제할까요?`)) return;
    if (row.type === 'exp') {
      await fetch('/api/office/expense', { method: 'DELETE', body: JSON.stringify({ month: row._monthStr, rowNum: row._rowNum }), headers: { 'Content-Type': 'application/json' } });
    } else {
      await fetch('/api/office/revenue', { method: 'DELETE', body: JSON.stringify({ rowNum: row._rowNum }), headers: { 'Content-Type': 'application/json' } });
    }
    await Promise.all([reloadMoney(), reloadExp()]);
  };

  return (
    <>
      <div className="space-y-4">
        {/* 상단 스코어카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Scorecard label="순매출" value={won(revTotal)} sub={`${filtRev.length}건`} tone="text-emerald-600" />
          <Scorecard label="순지출" value={won(expTotal)} sub={`${filtExp.length}건`} tone="text-slate-700" />
          <Scorecard label="손익" value={won(net)} sub={`예상 ${won(예상손익)} (받을 돈−줄 돈 반영)`} tone={net >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
          <Scorecard label="보유현금" value={won(money?.잔고?.보유현금 ?? 0)} sub={money?.잔고?.업데이트 ? `${money.잔고.업데이트} 기준` : '잔고 탭에서 업데이트'} tone="text-indigo-600" />
          <Scorecard label="미수금 · 받을 돈" value={won(money?.미수금합 ?? 0)} sub="눌러서 목록 보기" tone="text-sky-600"
            onClick={() => setOpenList(openList === 'recv' ? null : 'recv')} active={openList === 'recv'} />
          <Scorecard label="미지급금 · 줄 돈" value={won(미지급금합)} sub={`${미지급인건비.length}건 · 눌러서 목록 보기`} tone="text-rose-600"
            onClick={() => setOpenList(openList === 'pay' ? null : 'pay')} active={openList === 'pay'} />
        </div>

        {/* 이번달 예산 — 재무팀 브리핑 (재원=전월 실입금, 규칙=시트 예산 탭) */}
        {!budget && (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-400">
            💼 예산 규칙 미설정 — 시트에 &lsquo;예산&rsquo; 탭을 만들면 여기에 이번달 예산이 표시됩니다.
          </div>
        )}
        {budget && (() => {
          const b = budget;
          const 등급색 = b.등급 === '좋음' ? 'bg-emerald-100 text-emerald-700' : b.등급 === '보통' ? 'bg-sky-100 text-sky-700' : b.등급 === '빠듯' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700';
          const 사용률 = b.써도되는돈 > 0 ? Math.min(100, Math.round(b.이미쓴돈 / b.써도되는돈 * 100)) : (b.이미쓴돈 > 0 ? 100 : 0);
          const 바색 = b.남은한도 < 0 ? 'bg-rose-500' : 사용률 >= 80 ? 'bg-amber-400' : 'bg-emerald-500';
          const 비상금달성 = b.비상금목표 > 0 ? Math.min(100, Math.round(b.비상금잔액 / b.비상금목표 * 100)) : 0;
          return (
            <div className="rounded-2xl border border-emerald-200 bg-white overflow-hidden">
              <div className="px-4 py-3 bg-emerald-50 flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-emerald-800 text-sm">💼 이번달 예산 — 재무팀 브리핑 <span className="ml-1 text-xs text-emerald-500 font-normal">{b.기준월} · 재원 = {b.전월} 입금</span></span>
                <span className={`text-xs px-2 py-0.5 rounded-lg font-semibold ${등급색}`}>이번달 등급: {b.등급}</span>
              </div>
              <div className="divide-y divide-slate-100 text-sm">
                <div className="px-4 py-2.5 flex justify-between">
                  <span className="font-medium text-slate-700">들어온 돈 <span className="text-xs text-slate-400 font-normal">{b.전월} 실입금</span></span>
                  <span className="font-semibold text-emerald-600">{won(b.재원)}</span>
                </div>
                <div className="px-4 py-2.5 space-y-0.5">
                  <div className="flex justify-between text-slate-600"><span>− 부가세 적립 <span className="text-xs text-slate-400">세이프박스 이체 (지출 아님)</span></span><span>{won(b.부가세적립)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>− 기본급 2인 <span className="text-xs text-slate-400">10일 지급</span></span><span>{won(b.기본급)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>− 고정비</span><span>{won(b.고정비)}</span></div>
                  {b.세금적립 > 0 && <div className="flex justify-between text-slate-600"><span>− 세금 적립</span><span>{won(b.세금적립)}</span></div>}
                  <div className="flex justify-between pt-1 font-medium text-slate-700"><span>= 여유</span><span className={b.여유 >= 0 ? 'text-slate-800' : 'text-rose-600'}>{won(b.여유)}</span></div>
                </div>
                {b.등급 === '적자' ? (
                  <div className="px-4 py-2.5 bg-rose-50/60 text-rose-700">
                    ⚠️ 지난달 수입으로 필수비용이 부족합니다 — <b>{won(b.비상금인출)}</b>을 비상금에서 보전하거나 미수금을 회수해야 합니다. 이번달 상여·저축은 없습니다.
                  </div>
                ) : (
                  <div className="px-4 py-2.5 space-y-0.5">
                    <div className="flex justify-between text-slate-600 items-center">
                      <span>🎁 상여 권장 <span className="text-xs text-slate-400">기본급 외 추가 지급 여력</span></span>
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{won(b.상여권장)}</span>
                        {b.상여권장 > 0 && (
                          <button onClick={() => {
                            // 확정 = 인건비 원장에 상여 행 등록 → 기존 10일 지급확인 흐름에 합류 (별도 기록경로 안 만듦)
                            setForm({ lMonth: prevYM, lType: '직원', lName: '', lGross: String(b.상여권장), lDeduct: '0', lNote: '상여(예산 권장)' });
                            setPanel({ isNew: true, formType: 'labor' });
                          }} className="text-xs px-2 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">상여 확정</button>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600"><span>🏦 비상금 적립 <span className="text-xs text-slate-400">비상금통장 이체 · 잔액 {won(b.비상금잔액)} / 목표 {won(b.비상금목표)} ({비상금달성}%)</span></span><span className="font-medium">{won(b.비상금적립)}</span></div>
                    {b.저축 > 0 && <div className="flex justify-between text-slate-600"><span>💎 저축 <span className="text-xs text-slate-400">비상금 목표 달성 — 투자 여력으로 전환</span></span><span className="font-medium">{won(b.저축)}</span></div>}
                  </div>
                )}
                <div className="px-4 py-3 bg-emerald-50/50">
                  <div className="flex justify-between mb-1.5">
                    <span className="font-semibold text-emerald-800">✅ 써도 되는 돈</span>
                    <span className="font-bold text-emerald-700">{won(b.써도되는돈)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 overflow-hidden"><div className={`h-full ${바색}`} style={{ width: `${사용률}%` }} /></div>
                  <div className="flex justify-between mt-1 text-xs text-slate-500">
                    <span>이미 씀 {won(b.이미쓴돈)}</span>
                    <span className={b.남은한도 < 0 ? 'text-rose-600 font-semibold' : ''}>{b.남은한도 < 0 ? `한도 초과 ${won(-b.남은한도)}` : `남은 한도 ${won(b.남은한도)}`}</span>
                  </div>
                </div>
                {b.코멘트.length > 0 && (
                  <div className="px-4 py-2.5 bg-amber-50/50 space-y-1">
                    {b.코멘트.map((c, i) => <div key={i} className="text-xs text-amber-800">💬 {c}</div>)}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* 미수금 목록 (카드 클릭 시) */}
        {openList === 'recv' && (
          <div className="rounded-2xl border border-sky-200 bg-white overflow-hidden">
            <div className="px-4 py-2.5 bg-sky-50 text-sm font-semibold text-sky-700">미수금 — 받을 돈 목록</div>
            <table className="w-full text-sm">
              <tbody>
                {(money?.계약목록 || []).filter(c => c.미수금 > 0).map((c, i) => (
                  <tr key={i} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 px-3 text-slate-400 text-xs whitespace-nowrap">{c.계약일 || '—'}</td>
                    <td className="py-2 px-3 text-slate-700">{c.계약명}{c.클라이언트 ? ` · ${c.클라이언트}` : ''}</td>
                    <td className="py-2 px-3"><span className={`text-xs px-1.5 py-0.5 rounded ${c.미수종류 === '받을예정' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'}`}>{c.미수종류 || '미수'}</span></td>
                    <td className="py-2 px-3 text-right font-medium text-sky-600 whitespace-nowrap">{won(c.미수금)}</td>
                  </tr>
                ))}
                {(money?.계약목록 || []).filter(c => c.미수금 > 0).length === 0 && (
                  <tr><td className="py-6 text-center text-slate-400" colSpan={4}>미수금이 없어요. 👍</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 미지급금 목록 (카드 클릭 시) */}
        {openList === 'pay' && (
          <div className="rounded-2xl border border-rose-200 bg-white overflow-hidden">
            <div className="px-4 py-2.5 bg-rose-50 text-sm font-semibold text-rose-700 flex justify-between">
              <span>미지급금 — 줘야 하는데 아직 안 준 돈</span><span>{won(미지급금합)}</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {미지급인건비.map((l) => (
                  <tr key={`l${l._row}`} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 px-3 text-slate-400 text-xs whitespace-nowrap">{l.월}</td>
                    <td className="py-2 px-3 text-slate-700">{l.이름}</td>
                    <td className="py-2 px-3"><span className={`text-xs px-1.5 py-0.5 rounded ${l.구분 === '직원' ? 'bg-indigo-50 text-indigo-700' : l.구분 === '프리랜서' ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-700'}`}>{l.구분}</span></td>
                    <td className="py-2 px-3 text-right font-medium text-rose-600 whitespace-nowrap">{won(l.실지급)}</td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <button onClick={() => payLabor(l)} className="text-xs px-2 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">지급확인</button>
                      <button onClick={() => openEditLabor(l)} className="text-xs text-slate-400 hover:text-indigo-600 ml-1">편집</button>
                    </td>
                  </tr>
                ))}
                {미지급인건비.length === 0 && (
                  <tr><td className="py-6 text-center text-slate-400" colSpan={5}>미지급금이 없어요. 👍</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 이번달 10일 정산 — 나갈 돈 */}
        <div className="rounded-2xl border border-indigo-200 bg-white overflow-hidden">
          <div className="px-4 py-3 bg-indigo-50 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-semibold text-indigo-800 text-sm">💸 이번달 10일 정산 — 나갈 돈</span>
              <span className="ml-2 text-xs text-indigo-400">{curYM} · {dday}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={copyRoster} className="text-xs px-2.5 py-1.5 rounded-lg border border-indigo-300 text-indigo-600 bg-white hover:bg-indigo-50">지난달 명단 복사</button>
              <button onClick={openAddLabor} className="text-xs px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">+ 인건비</button>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {cardLabor.length === 0 && (
              <div className="px-4 py-4 text-sm text-slate-400">지급 대기 인건비가 없어요 — 새 달 명단은 [지난달 명단 복사]로 만드세요.</div>
            )}
            {[['직원', '👤 직원 급여', 직원분], ['프리랜서', '🧑‍💻 프리랜서(외주) · 3.3% 공제 후', 프리분], ['기타', '📎 기타 지급', 기타분]].map(([key, title, list]) => {
              const ls = list as LaborRow[];
              if (ls.length === 0) return null;
              return (
                <div key={key as string} className="px-4 py-2.5">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{title as string} <span className="text-slate-400 font-normal">{ls.length}명</span></span>
                    <span className="font-semibold text-slate-800">{won(ls.reduce((s, l) => s + l.실지급, 0))}</span>
                  </div>
                  <div className="space-y-0.5 pl-4">
                    {ls.map((l) => (
                      <div key={l._row} className={`flex items-center justify-between text-sm py-1 px-1 -mx-1 rounded ${l.지급상태 === '지급완료' ? 'bg-emerald-50/60' : 'hover:bg-slate-50'}`}>
                        <span className="text-slate-600">
                          {l.이름} <span className="text-[10px] px-1 py-0.5 rounded bg-slate-100 text-slate-500 align-middle">{l.월}분</span>{' '}
                          <span className="text-xs text-slate-400">{l.비고 || (l.공제 > 0 ? `세전 ${l.세전.toLocaleString()} − 공제 ${l.공제.toLocaleString()}` : '')}</span>
                        </span>
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          {l.지급상태 === '지급완료' ? (
                            <>
                              <span className="text-slate-400 line-through">{won(l.실지급)}</span>
                              <span className="text-xs px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700">✓ {fmtDate(l.지급일) || '지급완료'}</span>
                            </>
                          ) : (
                            <>
                              <span className="text-slate-700">{won(l.실지급)}</span>
                              <button onClick={() => payLabor(l)} className="text-xs px-2 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">지급확인</button>
                            </>
                          )}
                          <button onClick={() => openEditLabor(l)} className="text-xs text-slate-400 hover:text-indigo-600">편집</button>
                          <button onClick={() => deleteLabor(l)} className="text-xs text-slate-400 hover:text-rose-500">삭제</button>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {/* 세금(원천세·근로소득세)은 세무사 고지대로 납부·지출 기록 — 여기서 계산하지 않음 */}
            {/* 부가세 적립 권장 (지출 아님 — 세이프박스 이체 참고치) */}
            <div className="px-4 py-2.5 flex items-center justify-between text-sm bg-slate-50/60">
              <span className="font-medium text-slate-700">🧾 부가세 적립 권장 <span className="text-slate-400 font-normal">{prevYM} 입금분 부가세 합 — 세이프박스 이체 (지출 아님, 표시만)</span></span>
              <span className="font-semibold text-slate-500">{won(부가세권장)}</span>
            </div>
            {/* 고정비 항목별 (크론이 납부일에 자동 기록) */}
            <div className="px-4 py-2.5 bg-slate-50/60">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-slate-700">📌 이번달 고정비 <span className="text-slate-400 font-normal">납부일에 자동으로 지출 기록됨</span></span>
                <span className="font-semibold text-slate-600">{won(money?.고정비월합 ?? 0)}</span>
              </div>
              <div className="pl-4 space-y-0.5 text-sm">
                {고정비목록.map((f, i) => {
                  const 기록됨 = 고정비기록됨.has(f.항목);
                  return (
                    <div key={i} className="flex justify-between py-0.5">
                      <span className={기록됨 ? 'text-slate-400' : 'text-slate-600'}>{f.항목} <span className="text-xs text-slate-400">{f.납부일 ? `매월 ${f.납부일}${/말/.test(f.납부일) ? '' : '일'}` : '납부일 미정'}{기록됨 ? ' · 기록됨' : ''}</span></span>
                      <span className={기록됨 ? 'text-slate-400' : 'text-slate-600'}>{won(f.금액)}{기록됨 ? ' ✓' : ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* 합계 */}
            <div className="px-4 py-3 flex items-center justify-between bg-indigo-50/50">
              <span className="text-sm font-semibold text-indigo-800">10일 나갈 돈 <span className="text-xs font-normal text-indigo-400">(인건비 대기분 · 세금은 고지서, 적립/고정비 별도)</span></span>
              <span className="text-lg font-bold text-indigo-700">{won(십일합계)}</span>
            </div>
          </div>
        </div>

        {/* 필터 바 + 추가 버튼 */}
        <div className="flex flex-wrap items-center gap-2">
          <select value={String(selMonth)}
            onChange={e => setSelMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-500">
            <option value="all">올해 전체</option>
            {allMonths.map(m => <option key={m} value={m}>{m}월</option>)}
          </select>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            {([['all', '전체'], ['rev', '매출'], ['exp', '지출']] as const).map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${filter === k ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={() => openAdd('rev')} className="text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">+ 매출</button>
            <button onClick={() => openAdd('exp')} className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50">+ 지출</button>
          </div>
        </div>

        {moneyErr && <p className="text-rose-500 text-sm">⚠️ 매출 오류: {moneyErr}</p>}

        {/* 테이블 */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100 bg-slate-50">
                <th className="py-2 px-3 font-medium w-14">날짜</th>
                <th className="py-2 px-3 font-medium">내용</th>
                <th className="py-2 px-3 font-medium">분류</th>
                <th className="py-2 px-3 font-medium text-right">금액</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr><td colSpan={4} className="py-10 text-center text-slate-400">내역이 없어요.</td></tr>
              )}
              {shown.map((r, i) => (
                <tr key={i} className="group border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="py-2 px-3 text-slate-400 text-xs whitespace-nowrap w-14 min-w-[3.5rem]">{r.date || '—'}</td>
                  <td className="py-2 px-3 text-slate-700">{r.label}</td>
                  <td className="py-2 px-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${r.type === 'rev' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {r.type === 'rev' ? '매출' : '지출'}{r.extra ? ` · ${r.extra}` : ''}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right whitespace-nowrap">
                    <span className={`font-medium ${r.type === 'rev' ? 'text-emerald-600' : 'text-slate-700'}`}>
                      {r.type === 'rev' ? '+' : ''}{won(r.amount)}
                    </span>
                    <span className="hidden group-hover:inline-flex gap-1 ml-2 align-middle">
                      <button onClick={() => openEdit(r)} className="text-xs text-slate-400 hover:text-indigo-600 px-1 py-0.5 rounded hover:bg-indigo-50">편집</button>
                      <button onClick={() => handleDelete(r)} className="text-xs text-slate-400 hover:text-rose-500 px-1 py-0.5 rounded hover:bg-rose-50">삭제</button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 편집 패널 */}
      {panel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setPanel(null)} />
          <div className="relative w-72 bg-white h-full shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 text-sm">
                {panel.isNew ? '추가' : '수정'} — {panel.formType === 'rev' ? '매출' : panel.formType === 'labor' ? '인건비' : '지출'}
              </h3>
              <button onClick={() => setPanel(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {panel.formType === 'labor' ? (
                <>
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">귀속월</label>
                    <input type="month" value={form.lMonth || ''} onChange={e => setF('lMonth', e.target.value)}
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">구분</label>
                    <select value={form.lType || '프리랜서'}
                      onChange={e => {
                        const t = e.target.value;
                        setForm(p => ({ ...p, lType: t, lDeduct: t === '프리랜서' ? String(프리랜서공제(Number(p.lGross) || 0)) : p.lDeduct }));
                      }}
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm">
                      {['직원', '프리랜서', '기타'].map(s => <option key={s}>{s}</option>)}
                    </select>
                    {form.lType === '기타' && <p className="text-[11px] text-slate-400 mt-1">기타 = 줘야 할 돈 아무거나 (정산·환불 등). 지급확인 때 카테고리를 고릅니다.</p>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">{form.lType === '기타' ? '항목명' : '이름'}</label>
                    <input type="text" value={form.lName || ''} onChange={e => setF('lName', e.target.value)}
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">세전 금액</label>
                    <input type="number" value={form.lGross || ''}
                      onChange={e => {
                        const g = e.target.value;
                        setForm(p => ({ ...p, lGross: g, lDeduct: p.lType === '프리랜서' ? String(프리랜서공제(Number(g) || 0)) : p.lDeduct }));
                      }}
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">공제 {form.lType === '프리랜서' && <span className="text-indigo-400">자동 3.3% (수정 가능)</span>}</label>
                    <input type="number" value={form.lDeduct || ''} onChange={e => setF('lDeduct', e.target.value)}
                      className={`w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400 ${form.lType === '프리랜서' ? 'bg-indigo-50/50' : ''}`} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">실지급 <span className="text-slate-400">자동 = 세전−공제</span></label>
                    <input disabled value={((Number(form.lGross) || 0) - (Number(form.lDeduct) || 0)).toLocaleString('ko-KR')}
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm bg-slate-50 text-slate-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">비고</label>
                    <input type="text" value={form.lNote || ''} onChange={e => setF('lNote', e.target.value)}
                      placeholder="예: 기본급 1,683,297+식대 200,000"
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400" />
                  </div>
                </>
              ) : panel.formType === 'exp' ? (
                <>
                  {panel.isNew && (
                    <div>
                      <label className="text-xs font-medium text-slate-500 block mb-1">월</label>
                      <select value={form.monthStr || ''} onChange={e => setF('monthStr', e.target.value)}
                        className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                          <option key={m} value={`${m}월`}>{m}월</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {[['date', '날짜', 'date'], ['cat', '카테고리', 'text'], ['label', '내용', 'text'], ['amount', '금액', 'number'], ['note', '비고', 'text']].map(([k, lbl, t]) => (
                    <div key={k}>
                      <label className="text-xs font-medium text-slate-500 block mb-1">{lbl}</label>
                      <input type={t} value={form[k] || ''} onChange={e => setF(k, e.target.value)}
                        className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400" />
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {[['contractDate', '계약일', 'date'], ['label', '계약명', 'text'], ['client', '클라이언트', 'text'], ['date', '입금일', 'date'], ['amount', '입금액', 'number'], ['note', '비고', 'text']].map(([k, lbl, t]) => (
                    <div key={k}>
                      <label className="text-xs font-medium text-slate-500 block mb-1">{lbl}</label>
                      <input type={t} value={form[k] || ''} onChange={e => setF(k, e.target.value)}
                        className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400" />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">입금상태</label>
                    <select value={form.status || '입금완료'} onChange={e => setF('status', e.target.value)}
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm">
                      {['입금완료', '부분입금', '입금대기', '협의중'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 flex gap-2">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 rounded-lg bg-indigo-600 text-white text-sm py-2 font-medium hover:bg-indigo-700 disabled:opacity-50">
                {saving ? '저장 중…' : '저장'}
              </button>
              <button onClick={() => setPanel(null)}
                className="px-3 rounded-lg border border-slate-200 text-slate-500 text-sm hover:bg-slate-50">취소</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Scorecard({ label, value, sub, tone, onClick, active }: { label: string; value: string; sub?: string; tone?: string; onClick?: () => void; active?: boolean }) {
  const inner = (
    <>
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${tone || 'text-slate-800'}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-1">{sub}</div>}
    </>
  );
  if (onClick) {
    return (
      <button onClick={onClick} className={`bg-white rounded-xl border p-4 text-left transition ${active ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'}`}>
        {inner}
      </button>
    );
  }
  return <div className="bg-white rounded-xl border border-slate-200 p-4">{inner}</div>;
}

// 고객 관리 CRM(#5) — 영업/과업/매출을 고객 기준으로 묶은 생애주기 overview(읽기 중심).
type CRMClient = { 고객: string; 단계?: string; 예상금액?: number | null; 과업수?: number; 공위치?: string[]; 담당?: string[]; 계약금액?: number; 미수?: number; 프로젝트들?: { 이름: string; 금액: number; 미수: number; 단계?: string }[] };
type CRMD = { 영업중: CRMClient[]; 진행중: CRMClient[]; 완수: CRMClient[]; source: string };
// 프로젝트 문서 뷰(읽기 전용)는 ./components/ProjectDocs 로 분리 — CRM·아카이브에서 같은 모달 재사용.

function CRMView() {
  const [crm, setCrm] = useState<CRMD | null>(null);
  const [openClient, setOpenClient] = useState<string | null>(null); // 고객 클릭→프로젝트 펼침
  const [projDoc, setProjDoc] = useState<string | null>(null); // 프로젝트 클릭→문서 뷰
  const [err, setErr] = useState('');
  // 자체 프로젝트(깃)는 사무실 탭 "📂 진행 중 프로젝트"로 통합 — 여기선 고객 생애주기만.
  useEffect(() => {
    fetch('/api/crm').then((r) => r.json()).then((j) => { if (j.ok) setCrm(j.crm); else setErr(j.error || '불러오기 실패'); }).catch((e) => setErr(String(e)));
  }, []);
  if (err) return <ErrorBox msg={err} />;
  if (!crm) return <Loading text="고객 불러오는 중" />;
  const cols = [
    { key: 'lead', label: '📣 영업 중', hint: '계약 전', cls: 'border-sky-200 bg-sky-50', items: crm.영업중 },
    { key: 'active', label: '🔨 계약 진행중', hint: '납품 중', cls: 'border-emerald-200 bg-emerald-50', items: crm.진행중 },
    { key: 'done', label: '✅ 완수 고객', hint: '끝난 고객', cls: 'border-slate-200 bg-slate-50', items: crm.완수 },
  ];
  return (
    <div className="space-y-6">
      {/* 고객 생애주기 한 줄기: 영업중(계약 전) → 계약 진행 → 완수. 영업 탭(리드) + 과업영업 합쳐 crm.영업중 한 칸에. */}
      <div className="text-sm font-bold text-slate-700">👥 고객 생애주기 <span className="font-normal text-slate-400">— 영업 중 → 계약 진행 → 완수 · 프로젝트 누르면 문서</span></div>
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cols.map((c) => (
          <div key={c.key} className={`rounded-xl border p-3 min-h-[160px] ${c.cls}`}>
            <div className="flex items-baseline justify-between mb-2"><div className="font-bold text-sm">{c.label}</div><div className="text-[11px] text-slate-400">{c.hint} · {c.items.length}</div></div>
            <div className="space-y-2">
              {c.items.length === 0 && <div className="text-xs text-slate-300 py-3 text-center">없음</div>}
              {c.items.map((x, i) => {
                const ckey = c.key + ':' + x.고객;
                const hasPj = (x.프로젝트들?.length ?? 0) > 0;
                const open = openClient === ckey;
                return (
                <div key={i} className={`bg-white rounded-lg border px-3 py-2 ${hasPj ? 'cursor-pointer hover:border-slate-300' : ''} ${open ? 'border-indigo-300 ring-1 ring-indigo-100' : 'border-slate-200'}`}
                  onClick={() => hasPj && setOpenClient(open ? null : ckey)}>
                  <div className="flex items-center gap-1">
                    <div className="text-[13px] font-bold text-slate-800 truncate flex-1">{x.고객}</div>
                    {hasPj && <span className="text-[10px] text-slate-400 shrink-0">{open ? '▲' : `프로젝트 ${x.프로젝트들!.length} ▾`}</span>}
                  </div>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {x.단계 && <span className="text-[11px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-600">{x.단계}</span>}
                    {x.예상금액 != null && <span className="text-[11px] text-emerald-600">{won(x.예상금액)}</span>}
                    {x.예상금액 === null && x.단계 && <span className="text-[11px] text-amber-500">협의전</span>}
                    {x.과업수 != null && x.과업수 > 0 && <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">과업 {x.과업수}</span>}
                    {x.공위치 && x.공위치.map((p) => <span key={p} className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{p}</span>)}
                    {x.미수 != null && x.미수 > 0 && <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 font-medium">미수 {won(x.미수)}</span>}
                    {c.key === 'done' && x.계약금액 != null && x.계약금액 > 0 && <span className="text-[11px] text-slate-400">{won(x.계약금액)}</span>}
                    {x.담당 && x.담당.filter((o) => o && o !== '신종호').map((o) => <span key={o} className="text-[11px] text-pink-500">{o}</span>)}
                  </div>
                  {open && x.프로젝트들 && (
                    <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                      {x.프로젝트들.map((p) => (
                        <div key={p.이름} className="text-[12px]">
                          <div className="flex items-center justify-between gap-2">
                            <button onClick={(e) => { e.stopPropagation(); setProjDoc(p.이름); }} className="text-slate-600 truncate flex items-center gap-1.5 min-w-0 text-left hover:text-indigo-600"><span className="text-slate-300">▸</span>{p.이름}<span className="text-[10px] text-slate-300 shrink-0">📄</span></button>
                            {p.금액 > 0 && <span className="text-slate-500 shrink-0 tabular-nums">{won(p.금액)}{p.미수 > 0 ? <span className="text-rose-500"> · 미수 {won(p.미수)}</span> : ''}</span>}
                          </div>
                          {p.단계 && <div className="text-[11px] text-indigo-500 pl-3.5 truncate">▶ {p.단계}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>
      {projDoc && <ProjectDocs name={projDoc} onClose={() => setProjDoc(null)} />}
    </div>
  );
}

// 협업 허브 탭 — 협업사에 건네는 프로젝트별 공유 창구를 카드로 모아본다.
function HubsView() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setCopied(url); setTimeout(() => setCopied(null), 1500); } catch { /* 무시 */ }
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        협업사·클라이언트에게 건네는 <b className="text-slate-700">프로젝트 진행 공유 창구</b>입니다. 카드를 누르면 외부 공개 허브가 열려요. 링크를 복사해 상대에게 보내면, 그 안에서 진행상황·문서·시안을 함께 봅니다.
      </p>
      {COLLAB_HUBS.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl text-slate-400 text-sm shadow-sm">
          아직 만든 협업 허브가 없어요.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {COLLAB_HUBS.map((h) => (
            <div key={h.url} className="group rounded-2xl border border-slate-200 bg-white p-5 flex flex-col transition hover:shadow-md hover:-translate-y-0.5">
              <a href={h.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3">
                <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center text-xl shrink-0 ${h.color}`}>{h.emoji}</div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-indigo-600 leading-snug">{h.project}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{h.client}</p>
                </div>
              </a>
              <p className="mt-3 text-xs text-slate-500 leading-relaxed flex-1">{h.desc}</p>
              <div className="mt-4 flex items-center gap-2">
                <a href={h.url} target="_blank" rel="noopener noreferrer"
                  className="flex-1 text-center text-xs font-semibold rounded-lg px-3 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 transition">
                  허브 열기
                </a>
                <button onClick={() => copy(h.url)}
                  className="text-xs font-semibold rounded-lg px-3 py-1.5 bg-slate-100 text-slate-500 hover:bg-slate-200 transition">
                  {copied === h.url ? '복사됨 ✓' : '링크 복사'}
                </button>
              </div>
              {'reviewKey' in h && h.reviewKey && (
                <a href={`/review/${h.reviewKey}`}
                  className="mt-2 text-center text-xs font-semibold rounded-lg px-3 py-1.5 bg-slate-800 text-white hover:bg-slate-700 transition">
                  📝 개선안 검토 (내부)
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 자체사업 탭 카드 하나 — 브랜드/서비스/실험실 공통 모양. 카드 클릭=모달, 링크는 하단 버튼으로 분리.
function BizCard({ t, onOpen }: { t: WorkTool; onOpen: (t: WorkTool) => void }) {
  const links = t.links || (t.href ? [{ label: '열기', href: t.href }] : []);
  return (
    <div onClick={() => onOpen(t)}
      className="group rounded-2xl border border-slate-200 bg-white p-5 flex flex-col items-center text-center transition hover:shadow-md hover:-translate-y-0.5 cursor-pointer">
      <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center overflow-hidden bg-white ${t.color}`}>
        {t.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.logo} alt={t.name} className="w-10 h-10 object-contain" />
        ) : (
          <span className="text-2xl">{t.icon}</span>
        )}
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-800 group-hover:text-indigo-600">
        {t.name}
        {t.owner && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-pink-50 text-pink-500 align-middle">🎨 {t.owner}</span>}
      </p>
      <p className="mt-1 text-xs text-slate-400 leading-snug flex-1">{t.desc}</p>
      {t.status && (
        <span className={`mt-2 text-[11px] font-bold px-2 py-0.5 rounded ${
          t.status === '배포됨' || t.status === '운영 중' ? 'bg-emerald-50 text-emerald-600'
          : t.status === '판정 대기' || t.status === '미정' ? 'bg-amber-50 text-amber-600'
          : 'bg-indigo-50 text-indigo-600'}`}>
          {t.status}
        </span>
      )}
      {links.length > 0 && (
        <div className="mt-3 flex gap-2">
          {links.map((l) => (
            <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
              className="text-xs font-medium px-3 py-1 rounded-lg border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition">
              {l.label} ↗
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// 자체사업 탭 — 1.브랜드 / 2.큐앤뱅 서비스(+시트 분류=도구 자동 합류) / 3.실험실. 카드 클릭=모달(개요·진행사항·운영 뷰).
function BizView() {
  const [sheetTools, setSheetTools] = useState<WorkTool[]>([]);
  const [biz, setBiz] = useState<WorkTool | null>(null); // 열린 카드(모달)
  useEffect(() => {
    // 시트에 분류=도구로 등록된 과업 행 → 서비스 카드로 합류(하드코딩 카드와 이름 겹치면 제외)
    fetch('/api/office').then((r) => r.json()).then((j) => {
      if (!j.ok) return;
      type T = { id: string; project?: string; task?: string; category?: string; memo?: string; status?: string; owner?: string };
      const o = j.office as { rooms?: { tasks: T[] }[]; 자체?: T[]; 언젠가?: T[] };
      const all: T[] = [...(o.rooms || []).flatMap((r) => r.tasks), ...(o.자체 || []), ...(o.언젠가 || [])];
      const norm = (s: string) => s.replace(/\s/g, '').toLowerCase();
      // 시트 행 이름이 하드코딩 카드와 다른 같은 제품 — 별칭으로 중복 차단
      const ALIAS = ['네이버키워드검색기', 'seo상품명작명기'];
      const known = [...BRANDS, ...WORK_TOOLS, ...LAB].map((t) => norm(t.name)).concat(ALIAS.map(norm));
      const seen = new Set<string>();
      const tools: WorkTool[] = [];
      for (const t of all) {
        if ((t.category || '') !== '도구') continue;
        const name = t.project || t.task || '';
        const n = norm(name);
        if (!name || seen.has(n)) continue;
        if (known.some((k) => k.includes(n) || n.includes(k))) continue; // 하드코딩 카드와 중복
        seen.add(n);
        tools.push({
          name,
          desc: (t.memo || '').split('\n')[0] || t.status || '설명 비어있음 — 카드 눌러 문서에 채우면 표시',
          icon: '🧰',
          color: 'bg-teal-50 text-teal-600 border-teal-200',
          status: t.status && t.status.length <= 12 ? t.status : undefined,
          sheetId: t.id,
          memo: t.memo || '',
        });
      }
      setSheetTools(tools);
    }).catch(() => { /* 시트 실패해도 하드코딩 카드는 뜸 */ });
  }, []);

  const Section = ({ no, title, hint, items }: { no: string; title: string; hint: string; items: WorkTool[] }) => (
    <section>
      <div className="flex items-baseline gap-2.5 mb-3 pb-1.5 border-b-2 border-slate-800">
        <span className="text-xs font-extrabold text-slate-400">{no}</span>
        <h3 className="text-base font-bold text-slate-800">{title}</h3>
        <span className="text-xs text-slate-400 ml-auto">{hint}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((t) => <BizCard key={t.name} t={t} onOpen={setBiz} />)}
      </div>
    </section>
  );

  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-500">
        큐앤뱅이 직접 굴리는 것 전부 — <b className="text-slate-700">브랜드 · 서비스(도구) · 실험</b>. 카드를 누르면 개요·진행사항·운영 현황이 열립니다.
      </p>
      <Section no="1" title="브랜드" hint="시장에 정착시키는 이름" items={BRANDS} />
      <Section no="2" title="큐앤뱅 서비스" hint="사면·쓰면 작동하는 도구 — 시트 분류=도구 자동 합류" items={[...WORK_TOOLS, ...sheetTools]} />
      <Section no="3" title="실험실" hint="할지 말지 미정 · 테스트 중" items={LAB} />
      {biz && (
        <ProjectDocs
          name={biz.name}
          onClose={() => setBiz(null)}
          fallbackDesc={biz.desc}
          slot={<BizOps t={biz} />}
        />
      )}
    </div>
  );
}

// 게시판 탭 — 회의록(허브 게시판 합류)·아이디어·리서치(시트 분류=리서치 합류)를 한 목록으로.
type Post = {
  tag: string; title: string; desc: string; body?: string; date: string;
  href?: string; project?: string; source: 'post' | 'hub' | 'sheet'; idx?: number;
  hubKey?: string; sheetId?: string;
};
const POST_BADGE: Record<string, string> = {
  회의록: 'bg-blue-600', 아이디어: 'bg-purple-600', 리서치: 'bg-teal-600',
};

function PostsView() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [err, setErr] = useState('');
  const [tagFilter, setTagFilter] = useState<'all' | string>('all');
  const [form, setForm] = useState({ tag: '아이디어', title: '', body: '' });
  const [busy, setBusy] = useState(false);
  const [openIdx, setOpenIdx] = useState<number | null>(null); // 본문 펼친 글(목록 인덱스)
  const [editIdx, setEditIdx] = useState<number | null>(null); // 편집 중인 글(목록 인덱스)
  const [editForm, setEditForm] = useState({ tag: '아이디어', title: '', body: '' });
  const [frame, setFrame] = useState<Post | null>(null); // 링크 글(회의록 등) 모달
  // 링크 글의 본문 문서(공유 마크다운) — 슬러그를 repo/path로 풀어 sha와 함께 불러오면 폼에서 같이 수정
  const [editDoc, setEditDoc] = useState<null | 'loading' | 'unavailable' | { repo: string; path: string; sha: string; orig: string; draft: string }>(null);

  const openEdit = async (p: Post, i: number) => {
    setEditForm({ tag: p.tag, title: p.title, body: p.source === 'hub' ? (p.desc || '') : (p.body || p.desc || '') });
    setEditIdx(i); setOpenIdx(null); setEditDoc(null);
    const m = (p.href || '').match(/^\/share\/([a-z0-9-]+)$/i); // 정적 .html·외부 링크는 제외
    if (!m) { if (p.source === 'hub' && p.href) setEditDoc('unavailable'); return; }
    setEditDoc('loading');
    try {
      const sj = await fetch('/api/share?all=1').then((r) => r.json());
      const s = (sj.shares || []).find((x: { slug: string }) => x.slug === m[1]);
      if (!s) { setEditDoc('unavailable'); return; }
      const dj = await fetch(`/api/git-projects/${s.repo}/doc?path=${encodeURIComponent(s.path)}`).then((r) => r.json());
      if (dj?.sha) setEditDoc({ repo: s.repo, path: s.path, sha: dj.sha, orig: dj.content || '', draft: dj.content || '' });
      else setEditDoc('unavailable');
    } catch { setEditDoc('unavailable'); }
  };

  const load = () => {
    fetch('/api/posts').then((r) => r.json()).then((j) => {
      if (j.ok) setPosts(j.posts); else setErr(j.error || '불러오기 실패');
    }).catch((e) => setErr(String(e)));
  };
  useEffect(load, []);

  const add = async () => {
    const title = form.title.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', entry: { tag: form.tag, title, desc: form.body.trim().split('\n')[0], body: form.body.trim() } }),
      });
      const j = await r.json();
      if (j.ok) { setForm({ tag: form.tag, title: '', body: '' }); load(); }
      else alert(j.error || '추가 실패');
    } catch (e) { alert(String(e)); } finally { setBusy(false); }
  };

  const del = async (p: Post) => {
    if (p.source !== 'post' || typeof p.idx !== 'number') return;
    if (!confirm(`"${p.title}" 글을 삭제할까요?`)) return;
    setBusy(true);
    try {
      const r = await fetch('/api/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', index: p.idx }),
      });
      const j = await r.json();
      if (j.ok) load(); else alert(j.error || '삭제 실패');
    } catch (e) { alert(String(e)); } finally { setBusy(false); }
  };

  // 수정 — 출처별로 저장 경로가 다르다: 직접 쓴 글=posts.json / 허브 회의록=boards/<key>.json / 시트 리서치=과업 시트(프로젝트·메모)
  // 본문 문서(editDoc)가 열려 있고 고쳐졌으면 그 마크다운도 함께 저장(sha 충돌검사 — 다른 데서 먼저 고쳤으면 거절).
  const saveEdit = async (p: Post) => {
    const title = editForm.title.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      if (editDoc && typeof editDoc === 'object' && editDoc.draft !== editDoc.orig) {
        const r = await fetch(`/api/git-projects/${editDoc.repo}/doc`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: editDoc.path, content: editDoc.draft, sha: editDoc.sha }),
        });
        const j = await r.json().catch(() => ({ ok: r.ok }));
        if (!r.ok || j.ok === false) { alert('본문 저장 실패: ' + (j.error || r.status) + '\n(다른 곳에서 먼저 수정됐으면 수정을 다시 열어주세요)'); setBusy(false); return; }
      }
      let r: Response;
      if (p.source === 'sheet' && p.sheetId) {
        r = await fetch('/api/office/update', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: p.sheetId, patch: { 프로젝트: title, 메모: editForm.body } }),
        });
      } else if (p.source === 'hub' && p.hubKey && typeof p.idx === 'number') {
        r = await fetch('/api/posts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'edit', hubKey: p.hubKey, index: p.idx, entry: { title, desc: editForm.body.trim() } }),
        });
      } else if (p.source === 'post' && typeof p.idx === 'number') {
        r = await fetch('/api/posts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'edit', index: p.idx, entry: { tag: editForm.tag, title, desc: editForm.body.trim().split('\n')[0], body: editForm.body.trim() } }),
        });
      } else return;
      const j = await r.json().catch(() => ({ ok: r.ok }));
      if (j.ok !== false && r.ok) { setEditIdx(null); setEditDoc(null); load(); } else alert(j.error || '수정 실패');
    } catch (e) { alert(String(e)); } finally { setBusy(false); }
  };

  if (err) return <ErrorBox msg={err} pad="py-20" />;
  if (!posts) return <Loading text="게시판 불러오는 중" pad="py-20" />;

  const tags = ['회의록', '아이디어', '리서치'];
  const shown = tagFilter === 'all' ? posts : posts.filter((p) => p.tag === tagFilter);
  const fmtD = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d.replace(/-/g, '. ') : d);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        회의록·아이디어·리서치를 한 곳에서. 허브 회의록과 시트 리서치는 자동으로 합쳐 보이고, 새 글은 여기서 바로 씁니다.
      </p>

      {/* 배지 필터 */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setTagFilter('all')}
          className={`text-xs font-bold px-3.5 py-1.5 rounded-full border transition ${tagFilter === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
          전체
        </button>
        {tags.map((t) => (
          <button key={t} onClick={() => setTagFilter(tagFilter === t ? 'all' : t)}
            className={`text-xs font-bold px-3.5 py-1.5 rounded-full border transition ${tagFilter === t ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-sm mr-1.5 align-middle ${POST_BADGE[t]}`} />{t}
          </button>
        ))}
      </div>

      {/* 새 글 작성 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 flex flex-col gap-2">
        <div className="flex gap-2">
          <select value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500">
            {tags.map((t) => <option key={t}>{t}</option>)}
          </select>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) add(); }}
            placeholder="제목" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
        </div>
        <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
          placeholder="내용 (자유롭게 — 형식 없이 적어도 됩니다)" rows={2}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 resize-y" />
        <button onClick={add} disabled={busy || !form.title.trim()}
          className="self-end text-sm font-bold rounded-lg bg-slate-800 text-white px-4 py-1.5 hover:bg-slate-700 disabled:opacity-40">
          {busy ? '올리는 중…' : '+ 올리기'}
        </button>
      </div>

      {/* 글 목록 */}
      <div className="border-t-2 border-slate-800">
        {shown.length === 0 && <p className="text-slate-400 text-sm py-8 text-center">글이 없어요. 위에서 첫 글을 올려보세요.</p>}
        {shown.map((p, i) => {
          const hasBody = !!(p.body && p.body.trim() && p.body.trim() !== p.desc.trim());
          const isOpen = openIdx === i;
          if (editIdx === i) {
            return (
              <div key={`edit-${i}`} className="border-b border-slate-100 px-1.5 py-3 flex flex-col gap-2 bg-slate-50/60">
                <div className="flex gap-2">
                  {p.source === 'post' ? (
                    <select value={editForm.tag} onChange={(e) => setEditForm({ ...editForm, tag: e.target.value })}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500">
                      {tags.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  ) : (
                    <span className={`self-center shrink-0 text-[11px] font-bold text-white rounded px-2 py-0.5 ${POST_BADGE[p.tag] || 'bg-slate-500'}`}>{p.tag}</span>
                  )}
                  <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
                </div>
                <textarea value={editForm.body} onChange={(e) => setEditForm({ ...editForm, body: e.target.value })} rows={p.source === 'hub' ? 2 : 4}
                  placeholder={p.source === 'hub' ? '한 줄 설명' : '내용'}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 resize-y" />
                {p.source === 'hub' && <p className="text-[11px] text-slate-400">제목·설명은 허브 회의 게시판에도 같이 반영됩니다.</p>}
                {p.source === 'sheet' && <p className="text-[11px] text-slate-400">과업 시트(프로젝트명·메모)에 저장됩니다. 첫 줄이 목록 요약이 돼요.</p>}
                {editDoc === 'loading' && <p className="text-[11px] text-slate-400">📄 본문 문서 불러오는 중…</p>}
                {editDoc === 'unavailable' && <p className="text-[11px] text-amber-500">📄 본문이 옛 정적 파일(또는 외부 링크)이라 여기서는 수정 못 해요 — 새 회의부터는 공유 문서로 연결하면 수정됩니다.</p>}
                {editDoc && typeof editDoc === 'object' && (
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 mb-1">📄 본문 (마크다운 — 저장하면 공유 페이지에 바로 반영)</p>
                    <textarea value={editDoc.draft} onChange={(e) => setEditDoc({ ...editDoc, draft: e.target.value })} rows={12} spellCheck={false}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px] font-mono leading-relaxed outline-none focus:border-indigo-500 resize-y" />
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <button onClick={() => saveEdit(p)} disabled={busy || !editForm.title.trim()}
                    className="text-sm font-bold rounded-lg bg-slate-800 text-white px-4 py-1.5 hover:bg-slate-700 disabled:opacity-40">
                    {busy ? '저장 중…' : '저장'}
                  </button>
                  <button onClick={() => { setEditIdx(null); setEditDoc(null); }} disabled={busy}
                    className="text-sm rounded-lg border border-slate-200 text-slate-500 px-3 py-1.5 hover:bg-slate-50">취소</button>
                </div>
              </div>
            );
          }
          return (
            <div key={`${p.source}-${p.idx ?? ''}-${p.title}-${i}`} className="border-b border-slate-100">
              <div className="flex items-start gap-3 px-1.5 py-3.5 hover:bg-slate-50 transition cursor-pointer"
                onClick={() => hasBody ? setOpenIdx(isOpen ? null : i) : (p.href && setFrame(p))}>
                <span className={`shrink-0 mt-0.5 text-[11px] font-bold text-white rounded px-2 py-0.5 ${POST_BADGE[p.tag] || 'bg-slate-500'}`}>{p.tag}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-slate-800 leading-snug">
                    {p.title}
                    {p.project && <span className="ml-1.5 text-xs font-normal text-slate-400">{p.project}</span>}
                  </p>
                  {p.desc && <p className="text-[13px] text-slate-500 truncate">{p.desc}</p>}
                </div>
                <span className="shrink-0 text-xs text-slate-400 whitespace-nowrap mt-0.5">{fmtD(p.date)}</span>
                <span className="shrink-0 flex gap-0.5">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(p, i); }}
                    disabled={busy} className="text-slate-300 hover:text-indigo-500 text-sm px-1">✏️</button>
                  {p.source === 'post' && (
                    <button onClick={(e) => { e.stopPropagation(); del(p); }} disabled={busy}
                      className="text-slate-300 hover:text-rose-500 text-sm px-1">✕</button>
                  )}
                </span>
              </div>
              {isOpen && hasBody && (
                <div className="mx-1.5 mb-3 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-sm text-slate-700">
                  {renderMarkdown(p.body!)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 링크 글(회의록 등) — 사이트 이동 대신 모달로 띄움 */}
      {frame && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setFrame(null)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl h-[85vh] flex flex-col shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
              <h3 className="text-sm font-bold text-slate-800 truncate pr-3">
                <span className={`inline-block mr-2 text-[11px] font-bold text-white rounded px-2 py-0.5 align-middle ${POST_BADGE[frame.tag] || 'bg-slate-500'}`}>{frame.tag}</span>
                {frame.title}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <a href={frame.href} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-semibold rounded-full px-3 py-1 bg-slate-100 text-slate-500 hover:bg-slate-200 transition">새 창에서 열기</a>
                <button onClick={() => setFrame(null)} className="text-slate-400 hover:text-slate-600 text-sm">닫기 ✕</button>
              </div>
            </div>
            <iframe src={frame.href} title={frame.title} className="flex-1 w-full border-0" />
          </div>
        </div>
      )}
    </div>
  );
}

// 공유된 문서 탭 — 지금 외부 공개(공유 ON)인 문서를 한 곳에 모아 관리한다.
// 용도: 클라이언트 보여주기가 아니라 "어떤 문서가 공개 중인지" 내부 점검·정리·바로 편집.
type ShareRow = { slug: string; repo: string; path: string; title: string; sharedAt: string; url: string };

function SharesView() {
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // 열린 문서(모달) — 읽기/편집을 한 곳에서
  const [open, setOpen] = useState<ShareRow | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [content, setContent] = useState('');
  const [docSha, setDocSha] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [modalCopied, setModalCopied] = useState(false);

  const load = () => {
    setLoading(true);
    fetch('/api/share?all=1')
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setShares(j.shares || []);
        else setError(j.error || '공유 목록을 불러오지 못했어요.');
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* 무시 */ }
  };

  // 공유 끄기 — 레지스트리에서 항목 제거 후 목록 갱신
  const turnOff = async (s: ShareRow, closeModal = false) => {
    if (!confirm(`"${s.title}" 공유를 끌까요?\n끄면 외부 링크가 더 이상 열리지 않습니다.`)) return;
    setBusy(s.slug);
    try {
      const r = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: s.repo, path: s.path, action: 'off' }),
      });
      const j = await r.json();
      if (j.ok) {
        setShares((list) => list.filter((x) => x.slug !== s.slug));
        if (closeModal) setOpen(null);
      }
    } finally {
      setBusy(null);
    }
  };

  // 문서 열기 — 본문 + sha(편집용) 불러오기
  const openDoc = async (s: ShareRow) => {
    setOpen(s);
    setEditing(false); setDraft(''); setMsg(null); setContent(''); setDocSha(null); setModalCopied(false);
    setDocLoading(true);
    try {
      const r = await fetch(`/api/git-projects/${s.repo}/doc?path=${encodeURIComponent(s.path)}`);
      const j = await r.json();
      setContent(j.content || '내용을 불러오지 못했어요.');
      setDocSha(j.sha || null);
    } catch (e) {
      setContent('내용을 불러오지 못했어요: ' + String(e));
    } finally {
      setDocLoading(false);
    }
  };

  // 저장 — sha 와 함께 PUT (그 사이 바뀌었으면 서버가 거절 → 안 덮음)
  const saveDoc = async () => {
    if (!open || !docSha) return;
    setSaving(true); setMsg(null);
    try {
      const r = await fetch(`/api/git-projects/${open.repo}/doc`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: open.path, content: draft, sha: docSha }),
      });
      const j = await r.json();
      if (j.ok) {
        setContent(draft); setDocSha(j.sha || docSha); setEditing(false);
        setMsg({ kind: 'ok', text: '저장됐어요. (로컬 옵시디언에서 이어 작업하려면 먼저 git pull 하세요)' });
        setTimeout(() => setMsg(null), 4000);
      } else {
        setMsg({ kind: 'error', text: j.error || '저장에 실패했어요.' });
      }
    } catch (e) {
      setMsg({ kind: 'error', text: String(e) });
    } finally {
      setSaving(false);
    }
  };

  const copyModal = async () => {
    if (!open) return;
    try { await navigator.clipboard.writeText(open.url); setModalCopied(true); setTimeout(() => setModalCopied(false), 1500); } catch { /* 무시 */ }
  };

  if (loading) return <Loading text="공유 문서 불러오는 중" pad="py-20" />;
  if (error) return <ErrorBox msg={error} pad="py-20" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          지금 외부에 공개(공유 ON)된 문서 <b className="text-slate-700">{shares.length}</b>건입니다. 제목을 누르면 바로 보고·편집할 수 있어요.
        </p>
        <button onClick={load} className="text-xs text-slate-400 hover:text-slate-600 shrink-0">↻ 새로고침</button>
      </div>

      {shares.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl text-slate-400 text-sm shadow-sm">
          아직 공유 켜진 문서가 없어요.<br />
          <span className="text-xs">프로젝트 탭 → 문서 열기 → 🔗 공유 를 누르면 여기 모입니다.</span>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          {/* 헤더 */}
          <div className="w-full px-4 py-2 flex items-center gap-3 bg-slate-50 border-b border-slate-100 text-[11px] font-semibold text-slate-400 select-none">
            <span className="flex-1 min-w-0">문서</span>
            <span className="shrink-0 w-24 text-right hidden sm:block">공유 시작</span>
            <span className="shrink-0 w-[180px] text-right">관리</span>
          </div>
          <div className="divide-y divide-slate-50">
            {shares.map((s) => (
              <div key={s.slug} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition">
                <button onClick={() => openDoc(s)} className="flex-1 min-w-0 text-left">
                  <span className="text-sm font-semibold text-slate-800 hover:text-indigo-600 truncate block">
                    {s.title}
                  </span>
                  <span className="text-[11px] text-slate-400 truncate block">{s.repo} · /share/{s.slug}</span>
                </button>
                <span className="shrink-0 w-24 text-right text-xs text-slate-400 hidden sm:block">{timeAgo(s.sharedAt)}</span>
                <div className="shrink-0 w-[180px] flex items-center justify-end gap-1.5">
                  <button onClick={() => openDoc(s)}
                    className="text-[11px] font-medium rounded-lg px-2 py-1 bg-slate-100 text-slate-500 hover:bg-slate-200 transition">
                    ✏️ 편집
                  </button>
                  <button onClick={() => copy(s.url)}
                    className="text-[11px] font-medium rounded-lg px-2 py-1 bg-slate-100 text-slate-500 hover:bg-slate-200 transition">
                    {copied === s.url ? '복사됨 ✓' : '링크'}
                  </button>
                  <button onClick={() => turnOff(s)} disabled={busy === s.slug}
                    className="text-[11px] font-medium rounded-lg px-2 py-1 bg-red-50 text-red-500 hover:bg-red-100 transition disabled:opacity-50">
                    {busy === s.slug ? '…' : '끄기'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 문서 모달 — 읽기 / 편집 / 링크복사 / 공유끄기 한 곳에서 */}
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setOpen(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 truncate pr-3">{open.title}</h3>
              <div className="flex items-center gap-2 shrink-0">
                {editing ? (
                  <>
                    <button onClick={saveDoc} disabled={saving}
                      className="text-xs font-semibold rounded-full px-3 py-1 bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50">
                      {saving ? '저장 중…' : '저장'}
                    </button>
                    <button onClick={() => { setEditing(false); setMsg(null); }} disabled={saving}
                      className="text-xs font-semibold rounded-full px-3 py-1 bg-slate-100 text-slate-500 hover:bg-slate-200 transition disabled:opacity-50">
                      취소
                    </button>
                  </>
                ) : (
                  <>
                    {docSha && !docLoading && (
                      <button onClick={() => { setDraft(content); setMsg(null); setEditing(true); }}
                        className="text-xs font-semibold rounded-full px-3 py-1 bg-slate-100 text-slate-500 hover:bg-slate-200 transition">
                        ✏️ 편집
                      </button>
                    )}
                    <button onClick={() => turnOff(open, true)} disabled={busy === open.slug}
                      className="text-xs font-semibold rounded-full px-3 py-1 bg-red-50 text-red-500 hover:bg-red-100 transition disabled:opacity-50">
                      🔗 공유 끄기
                    </button>
                    <button onClick={() => setOpen(null)} className="text-slate-400 hover:text-slate-600 text-sm">닫기 ✕</button>
                  </>
                )}
              </div>
            </div>
            {/* 공유 링크 줄 */}
            {!editing && (
              <div className="flex items-center gap-2 px-5 py-2 bg-emerald-50 border-b border-emerald-100">
                <span className="text-[11px] text-emerald-600 shrink-0">외부 공개 링크</span>
                <input readOnly value={open.url} onFocus={(e) => e.target.select()}
                  className="flex-1 min-w-0 text-xs text-slate-600 bg-white border border-emerald-200 rounded px-2 py-1" />
                <button onClick={copyModal} className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 shrink-0">
                  {modalCopied ? '복사됨 ✓' : '복사'}
                </button>
              </div>
            )}
            {msg && (
              <div className={`px-5 py-2 text-xs border-b ${msg.kind === 'ok' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                {msg.text}
              </div>
            )}
            <div className="overflow-y-auto px-5 py-4">
              {docLoading ? (
                <p className="text-slate-400 text-sm text-center py-10">불러오는 중…</p>
              ) : editing ? (
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false}
                  className="w-full h-[60vh] resize-none rounded-lg border border-slate-200 p-3 font-mono text-[13px] leading-relaxed text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200" />
              ) : (
                renderMarkdown(content)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        accent ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200'
      }`}
    >
      <p className={`text-sm ${accent ? 'text-indigo-100' : 'text-slate-400'}`}>{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">{title}</h2>
      {children}
    </div>
  );
}

type Commit = { sha: string; message: string; date: string };
type DocItem = { path: string; title: string; group: string };
type OrgMember = { login: string; avatarUrl: string; htmlUrl: string };

// 상태 태그 색상 (노션 스타일)
const STATUS_COLOR: Record<string, string> = {
  // 진행상태
  '시작 전': 'bg-slate-100 text-slate-500',
  '진행 중': 'bg-blue-100 text-blue-700',
  '피드백 대기': 'bg-amber-100 text-amber-700',
  '보류': 'bg-purple-100 text-purple-700',
  '완료': 'bg-emerald-100 text-emerald-700',
  '중단': 'bg-red-100 text-red-600',
  // 계약상태
  '계약 완료': 'bg-emerald-100 text-emerald-700',
  '구두 계약': 'bg-amber-100 text-amber-700',
  '계약 대기': 'bg-slate-100 text-slate-500',
  // 입금상태
  '완수금': 'bg-emerald-100 text-emerald-700',
  '착수금': 'bg-blue-100 text-blue-700',
  '입금 대기': 'bg-slate-100 text-slate-500',
};

// 항목별 선택지
const PROGRESS_OPTS = ['시작 전', '진행 중', '피드백 대기', '보류', '완료', '중단'];
function StatusTag({ value }: { value?: string }) {
  if (!value) return null;
  const cls = STATUS_COLOR[value] || 'bg-slate-100 text-slate-500';
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{value}</span>;
}
const manwon = (n?: number) => (n && n > 0 ? `${(n / 10000).toLocaleString('ko-KR')}만원` : '');
// 카드용 짧은 금액 (110만)
const manShort = (n?: number) => (n && n > 0 ? `${(n / 10000).toLocaleString('ko-KR')}만` : '');
// 담당자별 색 (이름 해시로 고정 색 배정)
const MANAGER_PALETTE = [
  'bg-rose-100 text-rose-700', 'bg-sky-100 text-sky-700', 'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700', 'bg-violet-100 text-violet-700', 'bg-cyan-100 text-cyan-700',
  'bg-pink-100 text-pink-700', 'bg-lime-100 text-lime-700',
];
function managerColor(name?: string): string {
  if (!name) return 'bg-slate-100 text-slate-400';
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return MANAGER_PALETTE[h % MANAGER_PALETTE.length];
}
// 담당자 칸은 여러 명일 수 있다(쉼표/、로 구분) → 개별 이름 배열로
function managerList(s?: string): string[] {
  return (s || '').split(/[,、]/).map((x) => x.trim()).filter(Boolean);
}

// 문서 그룹(폴더) 표시 순서·아이콘 — 폴더 표준 체계(받은것→작업→완성+회의·계약)와 맞춤.
// 표준 외(제품명 등)는 뒤로.
const DOC_GROUP_ORDER = ['회의', '클라이언트자료', '레퍼런스', '작업중', '디자인소스', '산출물', '계약'];
const DOC_GROUP_ICON: Record<string, string> = {
  회의: '🗓️', 클라이언트자료: '📥', 레퍼런스: '🔖', 작업중: '✍️', 디자인소스: '🎨', 산출물: '📦', 계약: '📑',
};
function docGroupRank(g: string): number {
  const i = DOC_GROUP_ORDER.indexOf(g);
  return i === -1 ? 99 : i;
}
// 마감까지 D-day
function dday(end: string): string {
  const e = new Date(end + 'T00:00:00').getTime();
  const now = new Date(new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Seoul' })).getTime();
  const d = Math.round((e - now) / 86400000);
  if (d === 0) return 'D-day';
  return d > 0 ? `D-${d}` : `D+${-d} (지남)`;
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const min = Math.floor((Date.now() - then) / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

// 인라인 마크다운(굵게·코드·링크)을 안전하게 HTML로
// inlineHtml·renderMarkdown은 lib/md로 이동(보드 리서치 문서뷰와 공용).


// 진행률 막대
function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400 whitespace-nowrap w-20 text-right">{pct}% ({done}/{total})</span>
    </div>
  );
}

