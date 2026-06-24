'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MonthlyBar, CategoryPie } from './components/charts';
import OfficeBoardView from './components/OfficeBoardView';

type Expense = {
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
  { key: 'projects', label: '프로젝트', ready: true },
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
        {tab === 'projects' && <ProjectsView />}
        {tab === 'finance' && <FinanceView data={data} loading={loading} error={error} />}
        {tab === 'shares' && <SharesView />}
        {tab === 'hubs' && <HubsView />}
        {tab === 'tools' && <ToolsView />}
      </main>
    </div>
  );
}

// 정산 탭 — 지출/매출을 한 곳에서 토글
function FinanceView({ data, loading, error }: { data: DashboardData | null; loading: boolean; error: string }) {
  const [sub, setSub] = useState<'expense' | 'revenue'>('expense');
  return (
    <div className="space-y-5">
      {/* 지출/매출 토글 */}
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
        {([['expense', '지출'], ['revenue', '매출']] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setSub(k)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
              sub === k ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {sub === 'expense' && (
        <>
          {loading && <p className="text-slate-400 text-center py-20">불러오는 중…</p>}
          {error && <p className="text-red-500 text-center py-20">⚠️ {error}</p>}
          {!loading && !error && data && <ExpenseView data={data} />}
        </>
      )}

      {sub === 'revenue' && <RevenueView data={data} />}
    </div>
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

// 영업 보드(P8) — 3단계 파이프라인 + 무응답 노화. "물어보고 까먹음"을 빨강으로 잡아줌.
type Lead = {
  id: string; 대상: string; 단계: string; 다음액션: string;
  예상금액: number | null; 마지막접촉일: string; 비고: string;
  staleDays: number | null; stale: boolean;
};
type SalesD = { leads: Lead[]; followups: Lead[]; 예상매출: number; 협의전: number; 단계수: Record<string, number>; source: string };
const STAGE_META = [
  { key: '접촉', label: '🌱 접촉', hint: '문의·첫연락', cls: 'border-violet-200 bg-violet-50' },
  { key: '제안', label: '📤 제안', hint: '견적 보냄', cls: 'border-sky-200 bg-sky-50' },
  { key: '계약대기', label: '✍️ 계약대기', hint: '사인·착수금', cls: 'border-amber-200 bg-amber-50' },
];
const 금액텍스트 = (v: number | null) => (v === null ? '협의 전' : won(v));
const 접촉텍스트 = (d: number | null) => (d === null ? '' : d === 0 ? '오늘' : `${d}일 전`);

function LeadCard({ l, onWin, winning }: { l: Lead; onWin: (id: string, 대상: string) => void; winning: boolean }) {
  return (
    <div className={`bg-white rounded-lg px-3 py-2.5 border ${l.stale ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200'}`}>
      <div className="flex items-center gap-1">
        <div className="text-[13px] font-bold text-slate-800 leading-snug flex-1 truncate">{l.대상}</div>
        <button onClick={() => onWin(l.id, l.대상)} disabled={winning} title="계약 완료 → 사무실 과업 + 매출 등록"
          className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500 text-white shrink-0 disabled:opacity-40">계약✓</button>
      </div>
      {l.다음액션 && <div className="text-[12px] text-slate-700 font-medium mt-0.5 truncate">▸ {l.다음액션}</div>}
      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
        <span className={`text-[11px] px-1.5 py-0.5 rounded border ${l.예상금액 === null ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{금액텍스트(l.예상금액)}</span>
        {l.stale
          ? <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 font-medium">🔴 {l.staleDays}일째 무응답</span>
          : <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{접촉텍스트(l.staleDays)}</span>}
      </div>
    </div>
  );
}

function SalesView() {
  const [sales, setSales] = useState<SalesD | null>(null);
  const [err, setErr] = useState('');
  const [addLine, setAddLine] = useState('');
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');
  const load = () => fetch('/api/sales').then((r) => r.json())
    .then((j) => { if (j.ok) setSales(j.sales); else setErr(j.error || '불러오기 실패'); })
    .catch((e) => setErr(String(e)));
  useEffect(() => { load(); }, []);
  const [winning, setWinning] = useState('');
  const win = async (id: string, 대상: string) => {
    if (winning || !confirm(`"${대상}" 계약 완료? → 사무실 과업 + 매출 원장에 등록되고 영업 보드에서 빠집니다.`)) return;
    setWinning(id); setMsg('');
    try {
      const r = await fetch('/api/sales/win', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const j = await r.json();
      if (j.ok) { setMsg('🎉 ' + j.msg); load(); } else setMsg('⚠️ ' + (j.error || '실패'));
    } catch (e) { setMsg('⚠️ ' + String(e)); } finally { setWinning(''); }
  };
  const add = async () => {
    if (!addLine.trim() || adding) return;
    setAdding(true); setMsg('');
    try {
      const r = await fetch('/api/sales/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ line: addLine }) });
      const j = await r.json();
      if (j.ok) { setAddLine(''); setMsg(`✓ 추가: ${j.행.대상} (${j.행.단계})`); load(); } else setMsg('⚠️ ' + (j.error || '실패'));
    } catch (e) { setMsg('⚠️ ' + String(e)); } finally { setAdding(false); }
  };
  if (err) return <p className="text-red-500 text-center py-10">⚠️ {err}</p>;
  if (!sales) return <p className="text-slate-400 text-center py-10">영업 불러오는 중…</p>;
  const 총 = sales.leads.length;

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-3 gap-3">
        <Scorecard label="영업 중" value={`${총}건`} sub={STAGE_META.map((s) => `${s.key.replace('계약대기', '계약')} ${sales.단계수[s.key] || 0}`).join(' · ')} />
        <Scorecard label="🔴 지금 팔로업" value={`${sales.followups.length}건`} sub="무응답 임계 넘음" tone="text-rose-600" />
        <Scorecard label="예상 매출(영업 중)" value={won(sales.예상매출)} sub={sales.협의전 ? `+ 협의전 ${sales.협의전}건` : '가격 정해진 것만'} tone="text-emerald-600" />
      </section>

      {sales.followups.length > 0 && (
        <section className="bg-rose-50 border border-rose-200 rounded-xl p-3">
          <div className="text-sm font-bold text-rose-700 mb-2">🔴 지금 한 번 더 찌를 대상 (먼저 보세요)</div>
          <div className="space-y-1.5">
            {sales.followups.map((l) => (
              <div key={l.id} className="flex items-center gap-2 text-sm bg-white rounded-lg px-3 py-2 border border-rose-200">
                <span className="font-medium flex-1 truncate">{l.대상} <span className="text-slate-400 text-xs">· {l.단계}</span></span>
                <span className="text-emerald-600 text-xs shrink-0">{금액텍스트(l.예상금액)}</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 font-medium shrink-0">{l.staleDays}일째</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex items-center gap-2">
        <input value={addLine} onChange={(e) => setAddLine(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          placeholder="영업 대상 추가 — 예: 망원카페 브랜딩 제안 200만 (금액 빼면 협의전)"
          className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-emerald-300 focus:outline-none" />
        <button onClick={add} disabled={adding || !addLine.trim()} className="text-sm px-3 py-2 rounded-lg bg-emerald-500 text-white font-medium disabled:opacity-40">{adding ? '추가 중…' : '+ 추가'}</button>
      </div>
      {msg && <div className={`text-[11px] ${msg.startsWith('⚠️') ? 'text-rose-500' : 'text-emerald-600'}`}>{msg}</div>}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {STAGE_META.map((st) => {
          const items = sales.leads.filter((l) => l.단계 === st.key);
          return (
            <div key={st.key} className={`rounded-xl border p-3 min-h-[160px] ${st.cls}`}>
              <div className="flex items-baseline justify-between mb-2">
                <div className="font-bold text-sm">{st.label}</div>
                <div className="text-[11px] text-slate-400">{st.hint} · {items.length}</div>
              </div>
              <div className="space-y-2">
                {items.length === 0 && <div className="text-xs text-slate-300 py-3 text-center">비어 있음</div>}
                {items.map((l) => <LeadCard key={l.id} l={l} onWin={win} winning={winning === l.id} />)}
              </div>
            </div>
          );
        })}
      </section>
      <div className="text-[11px] text-slate-400 text-center">계약+착수금 들어오면 사무실(대행 과업)으로 옮기고 매출 원장에 등록하세요. (자동 전환은 다음 단계)</div>
    </div>
  );
}

// 고객 관리 CRM(#5) — 영업/과업/매출을 고객 기준으로 묶은 생애주기 overview(읽기 중심).
type CRMClient = { 고객: string; 단계?: string; 예상금액?: number | null; 과업수?: number; 공위치?: string[]; 담당?: string[]; 계약금액?: number; 미수?: number; 프로젝트들?: string[] };
type CRMD = { 영업중: CRMClient[]; 진행중: CRMClient[]; 완수: CRMClient[]; source: string };
function CRMView() {
  const [crm, setCrm] = useState<CRMD | null>(null);
  const [openClient, setOpenClient] = useState<string | null>(null); // 고객 클릭→프로젝트 펼침
  const [err, setErr] = useState('');
  useEffect(() => {
    fetch('/api/crm').then((r) => r.json()).then((j) => { if (j.ok) setCrm(j.crm); else setErr(j.error || '불러오기 실패'); }).catch((e) => setErr(String(e)));
  }, []);
  if (err) return <p className="text-red-500 text-center py-10">⚠️ {err}</p>;
  if (!crm) return <p className="text-slate-400 text-center py-10">고객 불러오는 중…</p>;
  const cols = [
    { key: 'active', label: '🔨 계약 진행중', hint: '납품 중', cls: 'border-emerald-200 bg-emerald-50', items: crm.진행중 },
    { key: 'done', label: '✅ 완수 고객', hint: '끝난 고객', cls: 'border-slate-200 bg-slate-50', items: crm.완수 },
  ];
  return (
    <div className="space-y-6">
      {/* 영업 = 고객 생애주기의 첫 단계. 영업 탭을 여기로 흡수(리드·팔로업·계약완료까지) */}
      <div>
        <div className="text-sm font-bold text-slate-700 mb-2">📣 영업 중 <span className="font-normal text-slate-400">— 리드·팔로업·계약 완료</span></div>
        <SalesView />
      </div>
      <div className="text-sm font-bold text-slate-700 border-t pt-5 -mb-1">🤝 고객 <span className="font-normal text-slate-400">— 계약 진행 → 완수</span></div>
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                      {x.프로젝트들.map((p) => <div key={p} className="text-[12px] text-slate-600 flex items-center gap-1.5"><span className="text-slate-300">▸</span>{p}</div>)}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

// 정산 매출 화면(P4) — money 데이터(계약목록·미수금·월별)로 스코어카드+손익+월별차트+미수금 계약테이블.
// 미수금↔과업 연결: 각 미수 계약에 그 돈 받을 과업이 사무실에 있는지 매칭해 보여줌.
type RevContract = {
  계약일: string; 계약명: string; 클라이언트: string;
  계약금액: number; 부가세: number; 공급가: number; 입금액: number; 미수금: number;
  입금상태: string; 입금예정일: string; 미수종류: '받을예정' | '단순미수' | ''; 순매출: number;
};
type RevMoney = {
  순매출누계: number; 미수금합: number; 받을예정합: number; 단순미수합: number;
  고정비월합: number; 계약건수: number;
  월별: { 월: string; 순매출: number; 계약액: number; 실현: number }[];
  계약목록: RevContract[];
};
function RevenueView({ data }: { data: DashboardData | null }) {
  const [money, setMoney] = useState<RevMoney | null>(null);
  const [tasks, setTasks] = useState<{ project: string; task: string; ball: string }[]>([]);
  const [err, setErr] = useState('');
  const [listView, setListView] = useState<'due' | 'all'>('due');
  useEffect(() => {
    fetch('/api/office').then((r) => r.json()).then((j) => {
      if (j.ok) {
        setMoney(j.money);
        setTasks((j.office?.rooms || []).flatMap((r: { tasks: { project: string; task: string; ball: string }[] }) => r.tasks));
      } else setErr(j.error || '불러오기 실패');
    }).catch((e) => setErr(String(e)));
  }, []);
  if (err) return <p className="text-red-500 text-center py-10">⚠️ {err}</p>;
  if (!money) return <p className="text-slate-400 text-center py-10">매출 불러오는 중…</p>;

  const 미수 = money.계약목록.filter((c) => c.미수금 > 0).sort((a, b) => b.미수금 - a.미수금);
  const 지출연 = data?.yearTotal ?? 0;
  const 손익 = money.순매출누계 - 지출연;
  const bars = money.월별.filter((m) => m.월).map((m) => ({ month: m.월.slice(2), total: m.순매출 }));
  // 미수금↔과업 매칭은 클라이언트명 양방향 부분일치로만(계약명 단어 매칭은 '디자인/보고서' 같은
  // 일반어로 오매칭되므로 제외). 클라이언트=프로젝트가 서로 포함하거나 과업명에 들어가면 그 과업.
  const matchTask = (c: RevContract) => {
    const cli = (c.클라이언트 || '').trim();
    if (!cli) return undefined;
    return tasks.find((t) => {
      const proj = (t.project || '').trim();
      return (proj && (proj.includes(cli) || cli.includes(proj))) || (t.task || '').includes(cli);
    });
  };

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Scorecard label="순매출 누계" value={won(money.순매출누계)} sub={`계약 ${money.계약건수}건`} tone="text-emerald-600" />
        <Scorecard label="미수금 ●" value={won(money.미수금합)} sub={`받을예정 ${won(money.받을예정합)} · 미정 ${won(money.단순미수합)}`} tone="text-rose-600" />
        <Scorecard label="올해 지출" value={won(지출연)} sub="지출 탭 합계" tone="text-slate-700" />
        <Scorecard label="손익 (순매출−지출)" value={won(손익)} sub={손익 >= 0 ? '흑자' : '적자'} tone={손익 >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-medium text-slate-600 mb-2">월별 순매출(계약일 기준)</div>
        <MonthlyBar data={bars} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-slate-600">계약 내역 · 받을 과업 연결</div>
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs">
            <button onClick={() => setListView('due')} className={`px-2.5 py-1 rounded-md font-medium ${listView === 'due' ? 'bg-rose-500 text-white' : 'text-slate-500'}`}>미수만 {미수.length}</button>
            <button onClick={() => setListView('all')} className={`px-2.5 py-1 rounded-md font-medium ${listView === 'all' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>전체 {money.계약목록.length}</button>
          </div>
        </div>
        {(() => {
          const list = listView === 'due' ? 미수
            : [...money.계약목록].sort((a, b) => (b.미수금 - a.미수금) || (a.계약일 < b.계약일 ? 1 : -1));
          if (list.length === 0) return <p className="text-sm text-slate-400 py-4 text-center">미수금 없음 — 다 입금됐어요 👍</p>;
          return (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-slate-400 text-left border-b border-slate-100">
                    <th className="py-1 font-normal">클라이언트</th><th className="font-normal">계약</th>
                    <th className="font-normal text-right">계약금액</th><th className="font-normal text-right">입금</th>
                    <th className="font-normal text-right">미수</th><th className="font-normal pl-2">예정일</th><th className="font-normal pl-2">상태</th><th className="font-normal pl-2">받을 과업</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((c, i) => {
                    const mt = c.미수금 > 0 ? matchTask(c) : undefined;
                    return (
                      <tr key={i} className={`border-b border-slate-50 ${c.미수금 > 0 ? '' : 'text-slate-400'}`}>
                        <td className="py-1.5 font-medium truncate max-w-[7rem]">{c.클라이언트 || '—'}</td>
                        <td className="text-[12px] truncate max-w-[11rem]">{c.계약명}</td>
                        <td className="text-right tabular-nums">{won(c.계약금액)}</td>
                        <td className="text-right tabular-nums text-slate-400">{won(c.입금액)}</td>
                        <td className={`text-right tabular-nums ${c.미수금 > 0 ? 'text-rose-600 font-semibold' : ''}`}>{c.미수금 > 0 ? won(c.미수금) : '–'}</td>
                        <td className="pl-2 text-[11px] whitespace-nowrap">
                          {c.미수종류 === '받을예정' ? <span className="text-emerald-600">📅 {c.입금예정일}</span>
                            : c.미수종류 === '단순미수' ? <span className="text-amber-500">미정</span> : ''}
                        </td>
                        <td className="pl-2"><span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 whitespace-nowrap">{c.입금상태 || '–'}</span></td>
                        <td className="pl-2 text-[11px]">{c.미수금 > 0 ? (mt ? <span className="text-emerald-600">▸ {mt.task}</span> : <span className="text-amber-500">⚠️ 없음</span>) : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function ExpenseView({ data }: { data: DashboardData }) {
  const [sel, setSel] = useState<'all' | number>('all');

  const monthsWithData = Array.from(new Set(data.expenses.map((e) => e.month))).sort(
    (a, b) => a - b
  );

  const filtered = sel === 'all' ? data.expenses : data.expenses.filter((e) => e.month === sel);
  const total = filtered.reduce((s, e) => s + e.cost, 0);

  const catMap: Record<string, number> = {};
  for (const e of filtered) {
    const k = e.category || '미분류';
    catMap[k] = (catMap[k] || 0) + e.cost;
  }
  const byCategory = Object.entries(catMap)
    .map(([category, t]) => ({ category, total: t }))
    .sort((a, b) => b.total - a.total);

  const list = [...filtered].sort((a, b) => (a.date < b.date ? 1 : -1));

  const periodLabel = sel === 'all' ? '올해 누적 지출' : `${sel}월 지출`;

  return (
    <div className="space-y-6">
      {/* 월 선택창 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">기간 선택</span>
        <select
          value={String(sel)}
          onChange={(e) => setSel(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-500"
        >
          <option value="all">전체 (올해 누적)</option>
          {monthsWithData.map((m) => (
            <option key={m} value={m}>
              {m}월
            </option>
          ))}
        </select>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label={periodLabel} value={won(total)} accent />
        <SummaryCard label="기록 건수" value={`${filtered.length}건`} />
        <SummaryCard label="카테고리 수" value={`${byCategory.length}개`} />
      </div>

      {/* 차트 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="월별 지출 (전체 비교)">
          <MonthlyBar data={data.monthly} />
        </Card>
        <Card title={sel === 'all' ? '카테고리별 지출 (전체)' : `카테고리별 지출 (${sel}월)`}>
          {byCategory.length ? (
            <CategoryPie data={byCategory} />
          ) : (
            <p className="text-slate-400 text-center py-20">데이터 없음</p>
          )}
        </Card>
      </div>

      {/* 지출 내역 */}
      <Card title={sel === 'all' ? '지출 내역 (전체)' : `${sel}월 지출 내역`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="py-2 pr-3 font-medium">날짜</th>
                <th className="py-2 pr-3 font-medium">카테고리</th>
                <th className="py-2 pr-3 font-medium">내용</th>
                <th className="py-2 pr-3 font-medium text-right">금액</th>
                <th className="py-2 font-medium">비고</th>
              </tr>
            </thead>
            <tbody>
              {list.map((e, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">{e.dateLabel}</td>
                  <td className="py-2 pr-3">
                    <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {e.category}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-slate-700">{e.content}</td>
                  <td className="py-2 pr-3 text-right font-medium text-slate-800 whitespace-nowrap">
                    {won(e.cost)}
                  </td>
                  <td className="py-2 text-slate-400 text-xs">{e.note}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    이 기간에는 지출이 없어요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
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
function inlineHtml(s: string): string {
  let h = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  h = h
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="px-1 bg-slate-100 rounded text-[0.85em]">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="text-indigo-600 underline">$1</a>');
  return h;
}

// 마크다운 문서를 읽기 좋게 렌더 (제목·목록·표·인용·구분선)
function renderMarkdown(md: string): React.ReactNode[] {
  const lines = md.split('\n');
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    // 표
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const head = line.split('|').slice(1, -1).map((c) => c.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()));
        i++;
      }
      out.push(
        <div key={key++} className="overflow-x-auto my-3">
          <table className="text-sm border-collapse">
            <thead>
              <tr>{head.map((h, j) => <th key={j} className="border border-slate-200 bg-slate-50 px-2 py-1 text-left font-semibold text-slate-600" dangerouslySetInnerHTML={{ __html: inlineHtml(h) }} />)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} className="border border-slate-200 px-2 py-1 text-slate-700" dangerouslySetInnerHTML={{ __html: inlineHtml(c) }} />)}</tr>)}
            </tbody>
          </table>
        </div>
      );
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^(#{1,6})/)![1].length;
      const text = line.replace(/^#{1,6}\s/, '');
      const cls = level <= 1 ? 'text-lg font-bold text-slate-800 mt-4 mb-2'
        : level === 2 ? 'text-base font-bold text-indigo-700 mt-4 mb-1'
        : 'text-sm font-semibold text-slate-700 mt-3 mb-1';
      out.push(<p key={key++} className={cls} dangerouslySetInnerHTML={{ __html: inlineHtml(text) }} />);
      i++; continue;
    }
    if (/^---+\s*$/.test(line)) { out.push(<hr key={key++} className="my-3 border-slate-100" />); i++; continue; }
    if (/^>\s?/.test(line)) {
      out.push(<blockquote key={key++} className="border-l-2 border-slate-200 pl-3 my-2 text-slate-500 text-sm" dangerouslySetInnerHTML={{ __html: inlineHtml(line.replace(/^>\s?/, '')) }} />);
      i++; continue;
    }
    if (/^\s*([-*]|\d+\.)\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s/, ''));
        i++;
      }
      out.push(
        <ul key={key++} className="list-disc pl-5 my-2 space-y-1">
          {items.map((it, j) => <li key={j} className="text-sm text-slate-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineHtml(it) }} />)}
        </ul>
      );
      continue;
    }
    if (line.trim() === '') { i++; continue; }
    out.push(<p key={key++} className="text-sm text-slate-600 leading-relaxed my-1.5" dangerouslySetInnerHTML={{ __html: inlineHtml(line) }} />);
    i++;
  }
  return out;
}

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

function ProjectsView() {
  const [projects, setProjects] = useState<ProjectRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [officeTasks, setOfficeTasks] = useState<string[]>([]); // 과업들의 프로젝트명 (프로젝트↔과업 연결용)
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterManager, setFilterManager] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('startDate');
  const [selected, setSelected] = useState<ProjectRepo | null>(null);
  const [workLog, setWorkLog] = useState<string | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [statusBoard, setStatusBoard] = useState<string | null>(null);
  const [driveFolderId, setDriveFolderId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showFlow, setShowFlow] = useState(false);
  const [openDoc, setOpenDoc] = useState<{ title: string; content: string; path: string } | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  // 열린 문서의 공유(외부 공개) 상태
  const [share, setShare] = useState<{ loading: boolean; shared: boolean; url: string | null }>({ loading: false, shared: false, url: null });
  const [copied, setCopied] = useState(false);
  // 문서 편집 상태 — sha 는 충돌 방지용(불러올 때 받아 저장 때 되돌려줌)
  const [docSha, setDocSha] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [docSaving, setDocSaving] = useState(false);
  const [docMsg, setDocMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const filteredProjects = projects
    .filter((p) => {
      if (filterStatus !== 'all' && p.progressStatus !== filterStatus) return false;
      if (filterCategory !== 'all' && p.category !== filterCategory) return false;
      if (filterManager !== 'all' && !managerList(p.manager).includes(filterManager)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'startDate') {
        const timeA = a.startDate ? new Date(a.startDate + 'T00:00:00').getTime() : 0;
        const timeB = b.startDate ? new Date(b.startDate + 'T00:00:00').getTime() : 0;
        return timeB - timeA;
      } else {
        const timeA = a.pushedAt ? new Date(a.pushedAt).getTime() : 0;
        const timeB = b.pushedAt ? new Date(b.pushedAt).getTime() : 0;
        return timeB - timeA;
      }
    });

  const daehengProjects = filteredProjects.filter((p) => p.category === '대행');
  const jacheProjects = filteredProjects.filter((p) => p.category !== '대행');
  const managers = Array.from(new Set(projects.flatMap((p) => managerList(p.manager))));

  useEffect(() => {
    fetch('/api/git-projects')
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setProjects(j.projects);
        else setError(j.error || '불러오기 실패');
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));

    fetch('/api/members')
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setMembers(j.members || []);
      })
      .catch(() => {});

    // 사무실(과업) 데이터 → 프로젝트별 과업 수 연결
    fetch('/api/office')
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          const names: string[] = [];
          for (const room of j.office.rooms) for (const t of room.tasks) names.push(t.project);
          setOfficeTasks(names);
        }
      })
      .catch(() => {});
  }, []);

  // 프로젝트명 ↔ 과업 매칭 (공백제거 포함관계)
  const squashName = (s: string) => (s || '').replace(/\s+/g, '');
  const taskCount = (title: string) => {
    const t = squashName(title);
    if (!t) return 0;
    return officeTasks.filter((p) => { const q = squashName(p); return q && (q.includes(t) || t.includes(q)); }).length;
  };

  const openProject = async (p: ProjectRepo) => {
    setSelected(p);
    setWorkLog(null); setCommits([]); setDocs([]); setStatusBoard(null); setDriveFolderId(null);
    setShowFlow(false); setOpenDoc(null);
    setDetailLoading(true);
    try {
      const r = await fetch(`/api/git-projects/${p.repo}`);
      const j = await r.json();
      if (j.ok) {
        setWorkLog(j.workLog);
        setCommits(j.commits || []);
        setDocs(j.docs || []);
        setStatusBoard(j.statusBoard || null);
        setDriveFolderId(j.driveFolderId || null);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const readDoc = async (doc: DocItem) => {
    if (!selected) return;
    setDocLoading(true);
    setCopied(false);
    setEditing(false); setDraft(''); setDocSha(null); setDocMsg(null);
    setShare({ loading: true, shared: false, url: null });
    setOpenDoc({ title: doc.title, content: '', path: doc.path });
    try {
      const r = await fetch(`/api/git-projects/${selected.repo}/doc?path=${encodeURIComponent(doc.path)}`);
      const j = await r.json();
      setOpenDoc({ title: doc.title, content: j.content || '내용을 불러오지 못했어요.', path: doc.path });
      setDocSha(j.sha || null); // sha 가 있으면 편집 가능(없으면 읽기 전용)
    } finally {
      setDocLoading(false);
    }
    // 공유 상태 조회(문서 본문과 별개로 진행)
    try {
      const s = await fetch(`/api/share?repo=${encodeURIComponent(selected.repo)}&path=${encodeURIComponent(doc.path)}`);
      const sj = await s.json();
      setShare({ loading: false, shared: !!sj.shared, url: sj.url || null });
    } catch {
      setShare({ loading: false, shared: false, url: null });
    }
  };

  // 공유 켜기/끄기 토글
  const toggleShare = async () => {
    if (!selected || !openDoc) return;
    const turningOn = !share.shared;
    setShare((s) => ({ ...s, loading: true }));
    setCopied(false);
    try {
      const r = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: selected.repo, path: openDoc.path, title: openDoc.title, action: turningOn ? 'on' : 'off' }),
      });
      const j = await r.json();
      if (j.ok) setShare({ loading: false, shared: !!j.shared, url: j.url || null });
      else setShare((s) => ({ ...s, loading: false }));
    } catch {
      setShare((s) => ({ ...s, loading: false }));
    }
  };

  // 공유 링크 복사
  const copyShareUrl = async () => {
    if (!share.url) return;
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* 무시 */ }
  };

  // 편집 시작 — 지금 보이는 원문을 편집창에 넣는다
  const startEdit = () => {
    if (!openDoc || !docSha) return;
    setDraft(openDoc.content);
    setDocMsg(null);
    setEditing(true);
  };

  // 저장 — sha 와 함께 PUT. 그 사이 바뀌었으면 서버가 409 로 거절 → 경고만 띄우고 안 덮음.
  const saveDoc = async () => {
    if (!selected || !openDoc || !docSha) return;
    setDocSaving(true);
    setDocMsg(null);
    try {
      const r = await fetch(`/api/git-projects/${selected.repo}/doc`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: openDoc.path, content: draft, sha: docSha }),
      });
      const j = await r.json();
      if (j.ok) {
        setOpenDoc({ ...openDoc, content: draft });
        setDocSha(j.sha || docSha);
        setEditing(false);
        setDocMsg({ kind: 'ok', text: '저장됐어요. (로컬 옵시디언에서 이어 작업하려면 먼저 git pull 하세요)' });
        setTimeout(() => setDocMsg(null), 4000);
      } else {
        setDocMsg({ kind: 'error', text: j.error || '저장에 실패했어요.' });
      }
    } catch (e) {
      setDocMsg({ kind: 'error', text: String(e) });
    } finally {
      setDocSaving(false);
    }
  };

  if (loading) return <p className="text-slate-400 text-center py-20">불러오는 중…</p>;
  if (error) return <p className="text-red-500 text-center py-20">⚠️ {error}</p>;

  if (projects.length === 0) {
    return (
      <div className="text-center py-20 text-slate-400">
        <p className="text-lg">아직 연결된 프로젝트가 없어요</p>
        <p className="text-sm mt-2">프로젝트 폴더를 GitHub에 올리면 (qnbang-project 토픽) 자동으로 나타납니다.</p>
      </div>
    );
  }

  // 문서를 주제(그룹)별로 묶고, 폴더 표준 순서(회의→…→계약)로 정렬
  const grouped: Record<string, DocItem[]> = {};
  for (const d of docs) (grouped[d.group] ||= []).push(d);
  const sortedGroups = Object.entries(grouped).sort(
    (a, b) => docGroupRank(a[0]) - docGroupRank(b[0]) || a[0].localeCompare(b[0], 'ko')
  );
  const entries = workLog ? parseWorkLog(workLog) : [];
  const status = statusBoard ? parseStatusBoard(statusBoard) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-sm text-slate-500">워크스페이스 프로젝트가 자동으로 모입니다. 카드를 누르면 흐름과 문서를 볼 수 있어요.</p>
        {members.length > 0 && (
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm shrink-0 self-start sm:self-auto">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">👥 Team</span>
            <div className="flex -space-x-1.5 overflow-hidden">
              {members.map((m) => (
                <a key={m.login} href={m.htmlUrl} target="_blank" rel="noreferrer" title={m.login} className="relative group">
                  <img className="inline-block h-6 w-6 rounded-full ring-2 ring-white hover:scale-110 hover:z-10 transition-all duration-150" src={m.avatarUrl} alt={m.login} />
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition whitespace-nowrap mb-1.5 z-10 pointer-events-none">{m.login}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto p-4" onClick={() => setSelected(null)}>
        <div className="bg-white rounded-2xl w-full max-w-3xl mx-auto my-8 p-5 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
          {/* 상단: 제목 + 드라이브/깃 링크 */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-base font-bold text-slate-800">{selected.title}</h2>
            <div className="flex items-center gap-3">
              {driveFolderId && (
                <a href={`https://drive.google.com/drive/folders/${driveFolderId}`} target="_blank" rel="noreferrer"
                   className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 hover:bg-emerald-100">
                  📁 드라이브 폴더 열기
                </a>
              )}
              <a href={selected.htmlUrl} target="_blank" rel="noreferrer" className="text-xs text-slate-400 hover:text-slate-600">GitHub ↗</a>
              <button onClick={() => setSelected(null)} className="text-xs text-slate-400 hover:text-slate-600">닫기</button>
            </div>
          </div>

          {detailLoading ? (
            <p className="text-slate-400 text-sm py-10 text-center">불러오는 중…</p>
          ) : (
            <>
              {/* 계약·매출은 사무실 카드 💰로 이동(매출 원장 직결). 옛 프로젝트.json 계약폼 제거 — 원장과 따로 놀던 헛폼. */}
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs text-slate-500">
                💼 계약·매출은 이제 <b className="text-slate-700">사무실 → 카드 → 💰 계약 입력</b>에서 넣어요 <span className="text-slate-400">(순매출·미수금 자동 반영)</span>
              </div>

              {/* 진행 현황 — 전체 대비 어디까지 */}
              {status && status.total > 0 && (
                <Card title="📊 진행 현황">
                  <div className="mb-4">
                    <ProgressBar done={status.done} total={status.total} />
                  </div>
                  <div className="space-y-4">
                    {status.sections.map((s) => (
                      <div key={s.name}>
                        <div className="flex items-center gap-3 mb-1.5">
                          <span className="text-sm font-medium text-slate-700 w-28 shrink-0 truncate">{s.name}</span>
                          <div className="flex-1"><ProgressBar done={s.done} total={s.total} /></div>
                        </div>
                        <div className="pl-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
                          {s.items.map((it, j) => (
                            <p key={j} className={`text-sm ${it.state === 'done' ? 'text-slate-400 line-through' : it.state === 'waiting' ? 'text-amber-600' : 'text-slate-600'}`}>
                              {it.state === 'done' ? '✅' : it.state === 'waiting' ? '⏳' : '⬜'} {it.text}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* 작업 흐름 (공지) — 눌러야 펼쳐짐, 줄글 */}
              <div className="rounded-2xl border border-slate-200 bg-white">
                <button onClick={() => setShowFlow((v) => !v)}
                  className="w-full flex items-center justify-between px-5 py-3 text-left">
                  <span className="text-sm font-semibold text-slate-700">📋 작업 흐름</span>
                  <span className="text-xs text-slate-400">{showFlow ? '접기 ▲' : '펼치기 ▾'}</span>
                </button>
                {showFlow && (
                  <div className="px-5 pb-4 border-t border-slate-100 pt-3">
                    {entries.length === 0 ? (
                      <p className="text-slate-400 text-sm">작업로그가 없습니다</p>
                    ) : (
                      <div className="space-y-2">
                        {entries.map((e, idx) => {
                          const isDate = /^\d{4}[-.]\d{1,2}[-.]\d{1,2}/.test(e.date) && e.summary;
                          const line = isDate ? `${e.date} — ${e.summary}` : e.date;
                          return (
                            <p key={idx} className="text-sm text-slate-600 leading-relaxed">{line}</p>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 게시판: 주제별 문서 */}
              {docs.length > 0 && (
                <Card title="📄 문서">
                  <div className="space-y-4">
                    {sortedGroups.map(([group, items]) => (
                      <div key={group}>
                        <p className="text-xs font-semibold text-slate-400 mb-1">{DOC_GROUP_ICON[group] ? `${DOC_GROUP_ICON[group]} ` : ''}{group}</p>
                        <div className="divide-y divide-slate-50">
                          {items.map((d) => (
                            <button key={d.path} onClick={() => readDoc(d)}
                              className="w-full text-left py-2 px-1 text-sm text-slate-700 hover:text-indigo-600 hover:bg-slate-50 rounded flex items-center gap-2">
                              <span className="text-slate-300">›</span>{d.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
        </div>
      )}

      {/* 필터 및 정렬 바 */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          {/* 분류 필터 */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">분류</span>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-500"
            >
              <option value="all">전체</option>
              <option value="대행">대행</option>
              <option value="자체">자체</option>
            </select>
          </div>
          {/* 진행상태 필터 */}
          <div className="flex items-center gap-1.5 border-l border-slate-100 pl-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">진행상태</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-500"
            >
              <option value="all">전체</option>
              {PROGRESS_OPTS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          {/* 담당자 필터 */}
          {managers.length > 0 && (
            <div className="flex items-center gap-1.5 border-l border-slate-100 pl-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">담당자</span>
              <select
                value={filterManager}
                onChange={(e) => setFilterManager(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-500"
              >
                <option value="all">전체</option>
                {managers.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        {/* 정렬 기준 */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">정렬</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-500"
          >
            <option value="startDate">착수일순</option>
            <option value="pushedAt">최근작업순</option>
          </select>
        </div>
      </div>

      {/* 프로젝트 목록 (분류별로 묶어 게시판 형식으로 노출) */}
      <div className="space-y-6">
        {/* 대행 프로젝트 섹션 */}
        {(filterCategory === 'all' || filterCategory === '대행') && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
              <span>💼</span> 대행 프로젝트 ({daehengProjects.length})
            </h3>
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              {/* 대행 테이블 헤더 */}
              <div className="w-full px-4 py-2 flex items-center gap-3 bg-slate-50 border-b border-slate-100 text-[11px] font-semibold text-slate-400 select-none">
                <span className="shrink-0 w-9 text-center">분류</span>
                <span className="flex-1 min-w-0">프로젝트명</span>
                <span className="shrink-0 w-14 text-center hidden sm:block">담당자</span>
                <span className="shrink-0 hidden sm:block w-[76px] text-center">진행상태</span>
                <span className="shrink-0 w-28 text-right hidden md:block">계약 / 입금액</span>
                <span className="shrink-0 w-16 text-right">착수일</span>
                <span className="shrink-0 w-20 text-right">최근작업일</span>
              </div>
              <div className="divide-y divide-slate-50">
                {daehengProjects.map((p) => (
                  <button key={p.repo} onClick={() => openProject(p)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition ${
                      selected?.repo === p.repo ? 'bg-indigo-50' : 'hover:bg-slate-50'
                    }`}>
                    <span className="text-[11px] font-medium rounded px-1.5 py-0.5 shrink-0 w-9 text-center bg-orange-100 text-orange-700">대행</span>
                    <span className="text-sm font-semibold text-slate-800 flex-1 min-w-0 truncate">{p.title}{taskCount(p.title) > 0 && <span className="ml-1.5 text-[10px] font-medium rounded px-1 py-0.5 bg-indigo-50 text-indigo-600 align-middle">과업 {taskCount(p.title)}</span>}</span>
                    <span className="shrink-0 w-14 text-center hidden sm:block">
                      {managerList(p.manager).length ? <span className="flex flex-wrap gap-0.5 justify-center">{managerList(p.manager).map((m) => <span key={m} className={`text-[11px] font-medium rounded-full px-1.5 py-0.5 ${managerColor(m)}`}>{m}</span>)}</span> : <span className="text-slate-300 text-xs">–</span>}
                    </span>
                    <span className="shrink-0 hidden sm:block"><StatusTag value={p.progressStatus} /></span>
                    <span className="text-xs font-semibold text-slate-600 shrink-0 w-28 text-right hidden md:block">
                      {p.amount ? <>{manShort(p.amount)}<span className="text-slate-400 font-normal"> / {manShort(p.paidAmount) || '0'}</span></> : '–'}
                    </span>
                    <span className="text-xs text-slate-400 shrink-0 w-16 text-right">{p.startDate ? p.startDate.slice(2).replace(/-/g, '.') : '–'}</span>
                    <span className="text-xs text-slate-400 shrink-0 w-20 text-right">{timeAgo(p.pushedAt)}</span>
                  </button>
                ))}
                {daehengProjects.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    대행 프로젝트가 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 자체 프로젝트 섹션 */}
        {(filterCategory === 'all' || filterCategory === '자체') && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
              <span>🚀</span> 자체 프로젝트 ({jacheProjects.length})
            </h3>
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              {/* 자체 테이블 헤더 */}
              <div className="w-full px-4 py-2 flex items-center gap-3 bg-slate-50 border-b border-slate-100 text-[11px] font-semibold text-slate-400 select-none">
                <span className="shrink-0 w-9 text-center">분류</span>
                <span className="flex-1 min-w-0">프로젝트명</span>
                <span className="shrink-0 w-14 text-center hidden sm:block">담당자</span>
                <span className="shrink-0 hidden sm:block w-[76px] text-center">진행상태</span>
                <span className="shrink-0 w-28 hidden md:block"></span> {/* 정렬 공간 정합용 공백 */}
                <span className="shrink-0 w-16 text-right">착수일</span>
                <span className="shrink-0 w-20 text-right">최근작업일</span>
              </div>
              <div className="divide-y divide-slate-50">
                {jacheProjects.map((p) => (
                  <button key={p.repo} onClick={() => openProject(p)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition ${
                      selected?.repo === p.repo ? 'bg-indigo-50' : 'hover:bg-slate-50'
                    }`}>
                    <span className="text-[11px] font-medium rounded px-1.5 py-0.5 shrink-0 w-9 text-center bg-violet-100 text-violet-700">자체</span>
                    <span className="text-sm font-semibold text-slate-800 flex-1 min-w-0 truncate">{p.title}{taskCount(p.title) > 0 && <span className="ml-1.5 text-[10px] font-medium rounded px-1 py-0.5 bg-indigo-50 text-indigo-600 align-middle">과업 {taskCount(p.title)}</span>}</span>
                    <span className="shrink-0 w-14 text-center hidden sm:block">
                      {managerList(p.manager).length ? <span className="flex flex-wrap gap-0.5 justify-center">{managerList(p.manager).map((m) => <span key={m} className={`text-[11px] font-medium rounded-full px-1.5 py-0.5 ${managerColor(m)}`}>{m}</span>)}</span> : <span className="text-slate-300 text-xs">–</span>}
                    </span>
                    <span className="shrink-0 hidden sm:block"><StatusTag value={p.progressStatus} /></span>
                    <span className="shrink-0 w-28 hidden md:block"></span>
                    <span className="text-xs text-slate-400 shrink-0 w-16 text-right">{p.startDate ? p.startDate.slice(2).replace(/-/g, '.') : '–'}</span>
                    <span className="text-xs text-slate-400 shrink-0 w-20 text-right">{timeAgo(p.pushedAt)}</span>
                  </button>
                ))}
                {jacheProjects.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    자체 프로젝트가 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 결과가 모두 없을 때 */}
        {filteredProjects.length === 0 && (
          <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl text-slate-400 text-sm shadow-sm">
            조건에 맞는 프로젝트가 없습니다.
          </div>
        )}
      </div>

      {/* 문서 읽기 모달 */}
      {openDoc && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setOpenDoc(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">{openDoc.title}</h3>
              <div className="flex items-center gap-2">
                {editing ? (
                  <>
                    <button onClick={saveDoc} disabled={docSaving}
                      className="text-xs font-semibold rounded-full px-3 py-1 bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50">
                      {docSaving ? '저장 중…' : '저장'}
                    </button>
                    <button onClick={() => { setEditing(false); setDocMsg(null); }} disabled={docSaving}
                      className="text-xs font-semibold rounded-full px-3 py-1 bg-slate-100 text-slate-500 hover:bg-slate-200 transition disabled:opacity-50">
                      취소
                    </button>
                  </>
                ) : (
                  <>
                    {docSha && !docLoading && (
                      <button onClick={startEdit}
                        className="text-xs font-semibold rounded-full px-3 py-1 bg-slate-100 text-slate-500 hover:bg-slate-200 transition">
                        ✏️ 편집
                      </button>
                    )}
                    <button
                      onClick={toggleShare}
                      disabled={share.loading}
                      className={`text-xs font-semibold rounded-full px-3 py-1 transition disabled:opacity-50 ${share.shared ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      {share.loading ? '처리 중…' : share.shared ? '🔗 공유 중 · 끄기' : '🔗 공유'}
                    </button>
                    <button onClick={() => setOpenDoc(null)} className="text-slate-400 hover:text-slate-600 text-sm">닫기 ✕</button>
                  </>
                )}
              </div>
            </div>
            {share.shared && share.url && !editing && (
              <div className="flex items-center gap-2 px-5 py-2 bg-emerald-50 border-b border-emerald-100">
                <span className="text-[11px] text-emerald-600 shrink-0">외부 공개 링크</span>
                <input readOnly value={share.url} onFocus={(e) => e.target.select()}
                  className="flex-1 min-w-0 text-xs text-slate-600 bg-white border border-emerald-200 rounded px-2 py-1" />
                <button onClick={copyShareUrl}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 shrink-0">
                  {copied ? '복사됨 ✓' : '복사'}
                </button>
              </div>
            )}
            {docMsg && (
              <div className={`px-5 py-2 text-xs border-b ${docMsg.kind === 'ok' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                {docMsg.text}
              </div>
            )}
            <div className="overflow-y-auto px-5 py-4">
              {docLoading ? (
                <p className="text-slate-400 text-sm text-center py-10">불러오는 중…</p>
              ) : editing ? (
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  spellCheck={false}
                  className="w-full h-[60vh] resize-none rounded-lg border border-slate-200 p-3 font-mono text-[13px] leading-relaxed text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              ) : (
                renderMarkdown(openDoc.content)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
