'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MonthlyBar, CategoryPie } from './components/charts';
import OfficeBoardView from './components/OfficeBoardView';
import { renderMarkdown } from '@/lib/markdown';

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
  { key: 'crm', label: '👥 고객·영업', ready: true },
  { key: 'hubs', label: '협업 허브', ready: true },
  { key: 'shares', label: '공유된 문서', ready: true },
  { key: 'finance', label: '정산', ready: true },
  { key: 'tools', label: '큐앤뱅 서비스', ready: true },
];

// 협업 허브 — 협업사·클라이언트에게 건네는 "프로젝트 진행 공유 창구" 모음.
// 각 허브는 그 프로젝트의 종합 공유 페이지(진행 체크리스트 + 공유 문서 + 디자인 시안 묶음).
// 새 협업 프로젝트가 생기면 허브 페이지를 만들어 여기에 한 줄 추가하면 됩니다.
const COLLAB_HUBS = [
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

// 큐앤뱅이 만든 서비스·업무 도구 목록 — 새 서비스가 생기면 여기에 한 줄 추가하면 됩니다.
// 단일 서비스는 href, 사이트/어드민처럼 갈래가 나뉘면 links에 여러 줄. 로고가 있으면 logo(없으면 icon 이모지).
type WorkTool = {
  name: string;
  desc: string;
  color: string;
  icon?: string;
  logo?: string;
  href?: string;
  links?: { label: string; href: string }[];
};
const WORK_TOOLS: WorkTool[] = [
  {
    name: '키워드 광고 도구',
    desc: '네이버 검색광고 키워드 월간 검색량·연관키워드 조회',
    href: 'https://qnbang-naver-keyword.vercel.app',
    icon: '🔍',
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  },
  {
    name: 'SEO 상품 작명기',
    desc: '네이버 쇼핑 데이터 기반 검색 최적화 상품명 생성',
    href: 'https://qnbang-seo-namer.vercel.app',
    icon: '✏️',
    color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  },
  {
    name: '반보',
    desc: '커뮤니티 모임 대시보드 — 모임 안내·신청과 운영 관리',
    logo: '/logos/banbo.png',
    color: 'bg-orange-50 text-orange-600 border-orange-200',
    links: [
      { label: '사이트', href: 'https://banbo-preview.vercel.app' },
      { label: '어드민', href: 'https://banbo-preview.vercel.app/admin.html' },
    ],
  },
];

export default function Home() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('office');

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
              onClick={() => setTab(t.key)}
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
        {tab === 'crm' && <CRMView />}
        {tab === 'finance' && <FinanceView data={data} loading={loading} error={error} />}
        {tab === 'shares' && <SharesView />}
        {tab === 'hubs' && <HubsView />}
        {tab === 'tools' && <ToolsView />}
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
type RevMoney = {
  순매출누계: number; 미수금합: number; 받을예정합: number; 단순미수합: number;
  고정비월합: number; 계약건수: number;
  월별: { 월: string; 순매출: number; 계약액: number; 실현: number }[];
  계약목록: RevContract[];
  잔고?: { 통장잔고: number; 세이프박스: number; 보유현금: number; 업데이트: string };
};

function parseM(d: string) {
  const m = d.replace(/\./g, '-').replace(/\s/g, '').match(/\d{4}-(\d{1,2})/);
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
  const [moneyLoading, setMoneyLoading] = useState(true);
  const [moneyErr, setMoneyErr] = useState('');
  const [localExp, setLocalExp] = useState<Expense[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'rev' | 'exp'>('all');
  const [selMonth, setSelMonth] = useState<'all' | number>('all');
  const [panel, setPanel] = useState<{ isNew: boolean; formType: 'rev' | 'exp'; rowNum?: number; monthStr?: string } | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const reloadMoney = () => {
    setMoneyLoading(true);
    fetch('/api/office').then(r => r.json()).then(j => {
      if (j.ok) setMoney(j.money);
    }).catch(console.error).finally(() => setMoneyLoading(false));
  };

  const reloadExp = async () => {
    const j = await fetch('/api/data').then(r => r.json()).catch(() => null);
    if (j?.ok) setLocalExp(j.data.expenses);
  };

  useEffect(() => { reloadMoney(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !data || moneyLoading) return <p className="text-slate-400 text-center py-20">불러오는 중…</p>;
  if (error) return <p className="text-red-500 text-center py-20">⚠️ {error}</p>;

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
      dateFull: c.입금일full || c.입금일,
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
      if (panel.formType === 'exp') {
        const body: Record<string, string | number> = {
          month: form.monthStr || panel.monthStr || '1월',
          날짜: form.date || '', 카테고리: form.cat || '',
          지출내용: form.label || '', 비용: Number(form.amount) || 0, 비고: form.note || '',
        };
        if (!panel.isNew) body.rowNum = panel.rowNum!;
        await fetch('/api/office/expense', { method: panel.isNew ? 'POST' : 'PATCH', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
      } else {
        const body: Record<string, string | number> = {
          계약일: form.contractDate || '', 계약명: form.label || '',
          클라이언트: form.client || '', 입금상태: form.status || '입금완료',
          입금일: form.date || '', 입금액: Number(form.amount) || 0, 비고: form.note || '',
        };
        if (!panel.isNew) body.rowNum = panel.rowNum!;
        await fetch('/api/office/revenue', { method: panel.isNew ? 'POST' : 'PATCH', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
      }
      setPanel(null);
      await Promise.all([reloadMoney(), reloadExp()]);
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Scorecard label="순매출" value={won(revTotal)} sub={`${filtRev.length}건`} tone="text-emerald-600" />
          <Scorecard label="순지출" value={won(expTotal)} sub={`${filtExp.length}건`} tone="text-slate-700" />
          <Scorecard label="손익" value={won(net)} sub={net >= 0 ? '흑자' : '적자'} tone={net >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
          <Scorecard label="보유현금" value={won(money?.잔고?.보유현금 ?? 0)} sub={money?.잔고?.업데이트 ? `${money.잔고.업데이트} 기준` : '잔고 탭에서 업데이트'} tone="text-indigo-600" />
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
                {panel.isNew ? '추가' : '수정'} — {panel.formType === 'rev' ? '매출' : '지출'}
              </h3>
              <button onClick={() => setPanel(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {panel.formType === 'exp' ? (
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

function Scorecard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${tone || 'text-slate-800'}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

// 고객 관리 CRM(#5) — 영업/과업/매출을 고객 기준으로 묶은 생애주기 overview(읽기 중심).
type CRMClient = { 고객: string; 단계?: string; 예상금액?: number | null; 과업수?: number; 공위치?: string[]; 담당?: string[]; 계약금액?: number; 미수?: number; 프로젝트들?: { 이름: string; 금액: number; 미수: number; 단계?: string }[] };
type CRMD = { 영업중: CRMClient[]; 진행중: CRMClient[]; 완수: CRMClient[]; source: string };
// 프로젝트 문서 뷰(읽기 전용) — CRM에서 프로젝트 누르면 그 GitHub 저장소의 작업로그·현황·문서를 보여줌(옛 프로젝트 탭 대체).
function ProjectDocs({ name, onClose }: { name: string; onClose: () => void }) {
  const [repo, setRepo] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'notfound' | 'ok'>('loading');
  const [workLog, setWorkLog] = useState<string | null>(null);
  const [statusBoard, setStatusBoard] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [openLog, setOpenLog] = useState<number | null>(null);
  const [openD, setOpenD] = useState<{ title: string; content: string } | null>(null);
  const [outsrc, setOutsrc] = useState(false); // 외주(담당자가 내부팀 아님) — 작업로그 대신 메모 관리
  useEffect(() => {
    (async () => {
      const sq = (s: string) => (s || '').replace(/\s+/g, '');
      const n = sq(name);
      const j = await fetch('/api/git-projects').then((r) => r.json()).catch(() => null);
      const m = j?.ok && (j.projects as ProjectRepo[]).find((p) => { const q = sq(p.title); return !!q && (q.includes(n) || n.includes(q)); });
      if (!m) { setState('notfound'); return; }
      const mgr = String(m.manager || '');
      setOutsrc(!!mgr && !['신종호', '김지영'].some((x) => mgr.includes(x))); // 내부팀 아니면 외주
      setRepo(m.repo);
      const d = await fetch(`/api/git-projects/${m.repo}`).then((r) => r.json()).catch(() => null);
      if (d?.ok) { setWorkLog(d.workLog); setStatusBoard(d.statusBoard || null); setDocs(d.docs || []); }
      setState('ok');
    })();
  }, [name]);
  const readDoc = async (doc: DocItem) => {
    if (!repo) return;
    setOpenD({ title: doc.title, content: '불러오는 중…' });
    const j = await fetch(`/api/git-projects/${repo}/doc?path=${encodeURIComponent(doc.path)}`).then((r) => r.json()).catch(() => null);
    setOpenD({ title: doc.title, content: j?.content || '내용을 불러오지 못했어요.' });
  };
  const entries = workLog ? parseWorkLog(workLog) : [];
  const status = statusBoard ? parseStatusBoard(statusBoard) : null;
  const grouped: Record<string, DocItem[]> = {};
  for (const d of docs) (grouped[d.group] ||= []).push(d);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl mx-auto my-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="text-sm font-bold text-slate-800">📁 {name}</h3>
          <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">닫기 ✕</button>
        </div>
        <div className="p-5 space-y-4">
          {state === 'loading' && <p className="text-slate-400 text-sm text-center py-8">불러오는 중…</p>}
          {state === 'notfound' && <p className="text-slate-400 text-sm text-center py-8">연결된 GitHub 저장소를 못 찾았어요.<br /><span className="text-xs">(프로젝트.json·qnbang-project 토픽 확인)</span></p>}
          {state === 'ok' && (<>
            {status && status.total > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">진행률 {Math.round((status.done / status.total) * 100)}% ({status.done}/{status.total})</div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-400" style={{ width: `${(status.done / status.total) * 100}%` }} /></div>
              </div>
            )}
            {entries.length === 0 && (
              outsrc
                ? <div className="rounded-lg bg-teal-50 border border-teal-200 px-3 py-2 text-[12.5px] text-teal-700">🤝 외주 프로젝트 — 작업로그 대신 <b>메모·할일</b>로 관리해요. 보고 받은 건 보드 카드에 한 줄씩 쌓으면 돼요.</div>
                : <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12.5px] text-amber-700 font-medium">⚠️ 작업로그 누락 — <code className="text-[11px] bg-amber-100 px-1 rounded">0_작업로그.md</code>가 없어요. 이 프로젝트는 작업 기록이 안 쌓이고 있어요.</div>
            )}
            {entries.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-2">🕘 작업로그</div>
                <div className="space-y-1.5">
                  {entries.map((e, i) => (
                    <div key={i} className="border border-slate-100 rounded-lg">
                      <button onClick={() => setOpenLog(openLog === i ? null : i)} className="w-full text-left px-3 py-2 flex items-baseline gap-2">
                        <span className="text-[11px] text-slate-400 shrink-0">{e.date}</span>
                        <span className="text-[12.5px] text-slate-700 font-medium flex-1">{e.summary}</span>
                        <span className="text-[10px] text-slate-300">{openLog === i ? '▲' : '▾'}</span>
                      </button>
                      {openLog === i && e.body && <div className="px-3 pb-2 border-t border-slate-50 pt-2">{renderMarkdown(e.body)}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {docs.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-2">📄 문서</div>
                {Object.entries(grouped).map(([g, items]) => (
                  <div key={g} className="mb-2">
                    <div className="text-[11px] text-slate-400 mb-1">{g}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((d) => <button key={d.path} onClick={() => readDoc(d)} className="text-[12px] px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50">{d.title}</button>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>)}
        </div>
      </div>
      {openD && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setOpenD(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 sticky top-0 bg-white">
              <h3 className="text-sm font-bold text-slate-800">{openD.title}</h3>
              <button onClick={() => setOpenD(null)} className="text-slate-400 hover:text-slate-600 text-sm">닫기 ✕</button>
            </div>
            <div className="p-5">{renderMarkdown(openD.content)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function CRMView() {
  const [crm, setCrm] = useState<CRMD | null>(null);
  const [openClient, setOpenClient] = useState<string | null>(null); // 고객 클릭→프로젝트 펼침
  const [projDoc, setProjDoc] = useState<string | null>(null); // 프로젝트 클릭→문서 뷰
  const [jache, setJache] = useState<ProjectRepo[]>([]); // 고객 없는 자체 프로젝트(GitHub)
  const [err, setErr] = useState('');
  useEffect(() => {
    fetch('/api/crm').then((r) => r.json()).then((j) => { if (j.ok) setCrm(j.crm); else setErr(j.error || '불러오기 실패'); }).catch((e) => setErr(String(e)));
    fetch('/api/git-projects').then((r) => r.json()).then((j) => {
      if (!j.ok) return;
      const raw = (j.projects as ProjectRepo[]).filter((p) => p.category !== '대행').sort((a, b) => (b.pushedAt || '').localeCompare(a.pushedAt || ''));
      const seen = new Set<string>(); // ponytail: 제목 같으면 같은 프로젝트 repo 둘 → 최근 것만(정렬 후 첫 것)
      setJache(raw.filter((p) => { const k = p.title.replace(/\s+/g, ''); if (seen.has(k)) return false; seen.add(k); return true; }));
    }).catch(() => {});
  }, []);
  if (err) return <p className="text-red-500 text-center py-10">⚠️ {err}</p>;
  if (!crm) return <p className="text-slate-400 text-center py-10">고객 불러오는 중…</p>;
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
      {jache.length > 0 && (<>
        <div className="text-sm font-bold text-slate-700 border-t pt-5 -mb-1">🏢 자체 프로젝트 <span className="font-normal text-slate-400">— 고객 없는 큐앤뱅 자체 ({jache.length}) · 최근순 · 누르면 문서</span></div>
        <section className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden bg-white">
          {jache.map((p) => (
            <button key={p.repo} onClick={() => setProjDoc(p.title)} className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-indigo-50">
              <span className="text-[13px] text-slate-700 truncate">{p.title}</span>
              <span className="flex items-center gap-2 shrink-0">
                {p.category && <span className="text-[10px] text-slate-400">{p.category}</span>}
                {p.pushedAt && <span className="text-[10px] text-slate-300 tabular-nums">{p.pushedAt.slice(0, 10)}</span>}
                <span className="text-slate-300 text-[10px]">📄</span>
              </span>
            </button>
          ))}
        </section>
      </>)}
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

function ToolsView() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">큐앤뱅이 만든 서비스·업무 도구 모음입니다. 아이콘을 누르면 새 창에서 열려요.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {WORK_TOOLS.map((t) => {
          // 카드 윗부분(로고/아이콘 + 이름 + 설명) — 단일·다중 링크 카드 공통
          const head = (
            <>
              <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center overflow-hidden bg-white ${t.color}`}>
                {t.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.logo} alt={t.name} className="w-10 h-10 object-contain" />
                ) : (
                  <span className="text-2xl">{t.icon}</span>
                )}
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-800 group-hover:text-indigo-600">{t.name}</p>
              <p className="mt-1 text-xs text-slate-400 leading-snug">{t.desc}</p>
            </>
          );

          // 사이트/어드민처럼 갈래가 나뉜 카드 — 하단에 링크 버튼 여러 개
          if (t.links) {
            return (
              <div
                key={t.name}
                className="group rounded-2xl border border-slate-200 bg-white p-5 flex flex-col items-center text-center transition hover:shadow-md hover:-translate-y-0.5"
              >
                {head}
                <div className="mt-3 flex gap-2">
                  {t.links.map((l) => (
                    <a
                      key={l.label}
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium px-3 py-1 rounded-lg border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition"
                    >
                      {l.label}
                    </a>
                  ))}
                </div>
              </div>
            );
          }

          // 단일 링크 카드 — 카드 전체가 링크
          return (
            <a
              key={t.name}
              href={t.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-2xl border border-slate-200 bg-white p-5 flex flex-col items-center text-center transition hover:shadow-md hover:-translate-y-0.5"
            >
              {head}
            </a>
          );
        })}
      </div>
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

  if (loading) return <p className="text-slate-400 text-center py-20">불러오는 중…</p>;
  if (error) return <p className="text-red-500 text-center py-20">⚠️ {error}</p>;

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

type ProjectRepo = {
  repo: string; title: string; category?: string; manager?: string; startDate?: string; pushedAt: string; htmlUrl: string; driveFolderId?: string;
  progressStatus?: string; contractStatus?: string; paymentStatus?: string; amount?: number; paidAmount?: number;
};
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

// 작업로그를 ## 단위 항목으로 분해 (날짜 + 한 줄 요약 + 본문)
function parseWorkLog(md: string): { date: string; summary: string; body: string }[] {
  const lines = md.split('\n');
  const entries: { date: string; summary: string; body: string }[] = [];
  let cur: { date: string; summary: string; body: string } | null = null;
  for (const line of lines) {
    if (/^##\s/.test(line)) {
      if (cur) entries.push(cur);
      cur = { date: line.replace(/^##\s/, '').trim(), summary: '', body: '' };
    } else if (cur) {
      const b = line.match(/^\*\*(.+?)\*\*$/);
      if (b && !cur.summary) cur.summary = b[1];
      cur.body += line + '\n';
    }
  }
  if (cur) entries.push(cur);
  return entries;
}

type ItemState = 'done' | 'waiting' | 'todo';
type StatusSection = { name: string; items: { text: string; state: ItemState }[]; done: number; total: number };
// 현황판.md 의 ## 단계 + 체크박스(- [x]완료 / - [~]대기 / - [ ]할일)를 진행률로 분해
function parseStatusBoard(md: string): { sections: StatusSection[]; done: number; total: number } {
  const lines = md.split('\n');
  const sections: StatusSection[] = [];
  let cur: StatusSection | null = null;
  for (const line of lines) {
    if (/^##\s/.test(line)) {
      if (cur) sections.push(cur);
      cur = { name: line.replace(/^##\s/, '').trim(), items: [], done: 0, total: 0 };
    } else {
      const m = line.match(/^\s*[-*]\s*\[([ xX~\-])\]\s*(.+)$/);
      if (m && cur) {
        const mark = m[1].toLowerCase();
        const state: ItemState = mark === 'x' ? 'done' : (mark === '~' || mark === '-') ? 'waiting' : 'todo';
        cur.items.push({ text: m[2].trim(), state });
        cur.total++; if (state === 'done') cur.done++;
      }
    }
  }
  if (cur) sections.push(cur);
  const done = sections.reduce((s, x) => s + x.done, 0);
  const total = sections.reduce((s, x) => s + x.total, 0);
  return { sections, done, total };
}

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

