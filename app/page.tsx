'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MonthlyBar, CategoryPie } from './components/charts';

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
  { key: 'projects', label: '프로젝트', ready: true },
  { key: 'finance', label: '정산', ready: true },
  { key: 'tools', label: '업무툴', ready: true },
];

// 업무에 쓰는 외부 도구 목록 — 새 도구가 생기면 여기에 한 줄 추가하면 됩니다.
const WORK_TOOLS = [
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
];

export default function Home() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('projects');

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
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200">
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
        {tab === 'projects' && <ProjectsView />}
        {tab === 'finance' && <FinanceView data={data} loading={loading} error={error} />}
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

      {sub === 'revenue' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-400">
          <p className="text-lg">📈 매출</p>
          <p className="text-sm mt-2">매출 입력·집계는 준비 중이에요.</p>
          <p className="text-xs mt-4 text-slate-300">
            계획: 프로젝트 계약금액과 연동 → 매출 자동 집계 →<br />
            세금(부가세·소득세) 차감한 <b>순매출</b>까지 자동 계산
          </p>
        </div>
      )}
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

function ToolsView() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">업무에 쓰는 도구 모음입니다. 아이콘을 누르면 새 창에서 열려요.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {WORK_TOOLS.map((t) => (
          <a
            key={t.name}
            href={t.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-2xl border border-slate-200 bg-white p-5 flex flex-col items-center text-center transition hover:shadow-md hover:-translate-y-0.5"
          >
            <div
              className={`w-14 h-14 rounded-2xl border flex items-center justify-center text-2xl ${t.color}`}
            >
              {t.icon}
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-800 group-hover:text-indigo-600">
              {t.name}
            </p>
            <p className="mt-1 text-xs text-slate-400 leading-snug">{t.desc}</p>
          </a>
        ))}
      </div>
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
const CONTRACT_OPTS = ['계약 대기', '구두 계약', '계약 완료'];
const PAYMENT_OPTS = ['입금 대기', '착수금', '완수금'];
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

// 편집용 드롭다운 (계약·진행·입금 상태)
function EditSelect({ label, value, options, onChange }: { label: string; value?: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-slate-400">{label}</span>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400 ${value ? 'text-slate-700' : 'text-slate-400'}`}
      >
        <option value="">미정</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// 편집용 금액 입력 (만원 단위 입력 → 원으로 저장)
function EditMan({ label, value, onSave }: { label: string; value?: number; onSave: (won: number) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-slate-400">{label} (만원)</span>
      <input
        type="number"
        defaultValue={value ? value / 10000 : ''}
        key={value}
        onBlur={(e) => onSave(Math.round(Number(e.target.value || 0) * 10000))}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        placeholder="0"
        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-400"
      />
    </div>
  );
}

// 편집용 날짜 입력
function EditDate({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-slate-400">{label}</span>
      <input
        type="date"
        defaultValue={value || ''}
        key={value || 'empty'}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-400"
      />
    </div>
  );
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
  // 편집 가능한 계약 정보
  const [meta, setMeta] = useState<{ progressStatus?: string; contractStatus?: string; paymentStatus?: string; amount?: number; paidAmount?: number; startDate?: string; endDate?: string; contractUrl?: string }>({});
  const [saved, setSaved] = useState(false);
  const [showContract, setShowContract] = useState(false);

  const filteredProjects = projects
    .filter((p) => {
      if (filterStatus !== 'all' && p.progressStatus !== filterStatus) return false;
      if (filterCategory !== 'all' && p.category !== filterCategory) return false;
      if (filterManager !== 'all' && p.manager !== filterManager) return false;
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
  const managers = Array.from(new Set(projects.map((p) => p.manager).filter(Boolean))) as string[];

  // 한 항목 저장 → GitHub 프로젝트.json + 로컬·카드 갱신
  const saveMeta = async (field: string, value: string | number) => {
    if (!selected) return;
    setMeta((m) => ({ ...m, [field]: value }));
    setProjects((ps) => ps.map((p) => (p.repo === selected.repo ? { ...p, [field]: value } : p)));
    setSaved(false);
    try {
      const r = await fetch(`/api/git-projects/${selected.repo}/meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value }),
      });
      const j = await r.json();
      if (j.ok) { setSaved(true); setTimeout(() => setSaved(false), 1500); }
    } catch { /* 무시 */ }
  };

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
  }, []);

  const openProject = async (p: ProjectRepo) => {
    setSelected(p);
    setWorkLog(null); setCommits([]); setDocs([]); setStatusBoard(null); setDriveFolderId(null);
    setShowFlow(false); setOpenDoc(null); setSaved(false); setShowContract(false);
    setMeta({ progressStatus: p.progressStatus, contractStatus: p.contractStatus, paymentStatus: p.paymentStatus, amount: p.amount, paidAmount: p.paidAmount });
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
        if (j.meta) setMeta(j.meta);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const readDoc = async (doc: DocItem) => {
    if (!selected) return;
    setDocLoading(true);
    setCopied(false);
    setShare({ loading: true, shared: false, url: null });
    setOpenDoc({ title: doc.title, content: '', path: doc.path });
    try {
      const r = await fetch(`/api/git-projects/${selected.repo}/doc?path=${encodeURIComponent(doc.path)}`);
      const j = await r.json();
      setOpenDoc({ title: doc.title, content: j.content || '내용을 불러오지 못했어요.', path: doc.path });
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

  // 문서를 주제(그룹)별로 묶기
  const grouped: Record<string, DocItem[]> = {};
  for (const d of docs) (grouped[d.group] ||= []).push(d);
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
              {/* 계약 정보 — 눌러야 펼쳐짐, 대시보드에서 직접 편집 (GitHub 저장) */}
              <div className="rounded-2xl border border-slate-200 bg-white">
                <button onClick={() => setShowContract((v) => !v)}
                  className="w-full flex items-center justify-between px-5 py-3 text-left">
                  <span className="text-sm font-semibold text-slate-700">💼 계약 정보</span>
                  <span className="text-xs text-slate-400">{showContract ? '접기 ▲' : '펼치기 ▾'}</span>
                </button>
                {showContract && (
                  <div className="px-5 pb-4 border-t border-slate-100 pt-3 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                      <EditSelect label="진행상태" value={meta.progressStatus} options={PROGRESS_OPTS} onChange={(v) => saveMeta('progressStatus', v)} />
                      <EditSelect label="계약상태" value={meta.contractStatus} options={CONTRACT_OPTS} onChange={(v) => saveMeta('contractStatus', v)} />
                      <EditSelect label="입금상태" value={meta.paymentStatus} options={PAYMENT_OPTS} onChange={(v) => saveMeta('paymentStatus', v)} />
                      <EditMan label="계약금액" value={meta.amount} onSave={(v) => saveMeta('amount', v)} />
                      <EditMan label="받은 금액" value={meta.paidAmount} onSave={(v) => saveMeta('paidAmount', v)} />
                      {!!meta.amount && (
                        <div className="flex flex-col justify-end">
                          <span className="text-[11px] text-slate-400">미수금</span>
                          <span className="text-sm font-semibold text-slate-700">
                            {manwon(Math.max(0, (meta.amount || 0) - (meta.paidAmount || 0))) || '0원'}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* 계약 일정 */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 border-t border-slate-50 pt-3">
                      <EditDate label="착수일" value={meta.startDate} onChange={(v) => saveMeta('startDate', v)} />
                      <EditDate label="마감일" value={meta.endDate} onChange={(v) => saveMeta('endDate', v)} />
                      {meta.endDate && (
                        <div className="flex flex-col justify-end">
                          <span className="text-[11px] text-slate-400">마감까지</span>
                          <span className="text-sm font-semibold text-slate-700">{dday(meta.endDate)}</span>
                        </div>
                      )}
                    </div>
                    {meta.contractUrl && (
                      <a href={meta.contractUrl} target="_blank" rel="noreferrer"
                         className="inline-block text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 hover:bg-emerald-100">
                        📄 계약서 원본 열기
                      </a>
                    )}
                    <p className="text-[11px] text-slate-300 h-3">{saved ? '✓ 저장됨' : ''}</p>
                  </div>
                )}
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
                    {Object.entries(grouped).map(([group, items]) => (
                      <div key={group}>
                        <p className="text-xs font-semibold text-slate-400 mb-1">{group}</p>
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
                    <span className="text-sm font-semibold text-slate-800 flex-1 min-w-0 truncate">{p.title}</span>
                    <span className="shrink-0 w-14 text-center hidden sm:block">
                      {p.manager ? <span className={`text-[11px] font-medium rounded-full px-1.5 py-0.5 ${managerColor(p.manager)}`}>{p.manager}</span> : <span className="text-slate-300 text-xs">–</span>}
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
                    <span className="text-sm font-semibold text-slate-800 flex-1 min-w-0 truncate">{p.title}</span>
                    <span className="shrink-0 w-14 text-center hidden sm:block">
                      {p.manager ? <span className={`text-[11px] font-medium rounded-full px-1.5 py-0.5 ${managerColor(p.manager)}`}>{p.manager}</span> : <span className="text-slate-300 text-xs">–</span>}
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
                <button
                  onClick={toggleShare}
                  disabled={share.loading}
                  className={`text-xs font-semibold rounded-full px-3 py-1 transition disabled:opacity-50 ${share.shared ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                  {share.loading ? '처리 중…' : share.shared ? '🔗 공유 중 · 끄기' : '🔗 공유'}
                </button>
                <button onClick={() => setOpenDoc(null)} className="text-slate-400 hover:text-slate-600 text-sm">닫기 ✕</button>
              </div>
            </div>
            {share.shared && share.url && (
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
            <div className="overflow-y-auto px-5 py-4">
              {docLoading ? <p className="text-slate-400 text-sm text-center py-10">불러오는 중…</p> : renderMarkdown(openDoc.content)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
