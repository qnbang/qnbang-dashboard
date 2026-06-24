'use client';

// 관제탑 보드 — 시안 I 그대로(리퀴드 글라스). 받은일·처리·작업·대기·예정·언젠가·보류 + 제품.
// 시트의 flat 공위치(ball)를 시안 I 칸으로 매핑해 실데이터로 그린다. 카드 클릭=슬라이드 패널.
import { useEffect, useState, useCallback } from 'react';
import { renderMarkdown } from '@/lib/markdown';

type Task = {
  id: string; project: string; task: string; owner: string;
  money: string; ball: string; due: string; dday: number | null;
  urgent: boolean; client?: string; status?: string; nextStep?: string;
  todos?: string[]; staleDays?: number | null; stale?: boolean;
  category?: string;
  memo?: string;
  history?: { when: string; what: string }[];
};
// 분류별 색·이모지 — 카드 프로젝트명 색, 칩, 포트폴리오 공통.
const CAT: Record<string, { c: string; e: string }> = {
  대행: { c: '#2563eb', e: '🤝' },     // 파랑 — 고객 일(매출)
  도구: { c: '#0d9488', e: '🧰' },     // 청록 — 판매 도구
  리서치: { c: '#9333ea', e: '🔬' },   // 보라 — 탐색·자산
  자체사업: { c: '#ea580c', e: '🚀' }, // 주황 — 시장 벤처
  내부: { c: '#475569', e: '🛠️' },     // 회색 — 내부 인프라
};
// 포트폴리오 분류 = 문서-중심 패널(할일 아닌 내용이 먼저). 분류별 라벨·플레이스홀더.
const DOC_LABEL: Record<string, { t: string; h: string; p: string }> = {
  리서치: { t: '📄 리서치 문서', h: '직접 조사한 내용·링크 (메인)', p: '직접 리서치한 내용, 자료 링크, 전체 정리를 여기에…' },
  자체사업: { t: '📄 사업 개요', h: '어떤 사업·현황', p: '어떤 사업인지, 현재 진행 현황, 다음 방향을…' },
  도구: { t: '📄 도구 설명', h: '어떤 건지·진행상태·사용법', p: '어떤 도구인지, 어디까지 됐는지, 어떻게 쓰는지를…' },
};
// 할일 단계 파싱: "✓텍스트 @6/25" → {done, text, date}
function parseStep(raw: string) {
  const done = raw.startsWith('✓');
  let s = (done ? raw.slice(1) : raw).trim();
  const dm = s.match(/@\s*(\d{1,2}\/\d{1,2})\s*$/);
  const date = dm ? dm[1] : '';
  if (dm) s = s.slice(0, dm.index).trim();
  return { done, text: s, date, raw };
}
// 할일 단계가 비었으면 현재상태를 '지금 단계'로 흐름에 흡수. 손대는 순간(체크·추가) 진짜 단계로 굳어 이력에 쌓임.
function effTodos(t: { todos?: string[]; status?: string }): string[] {
  return t.todos && t.todos.length ? t.todos : (t.status ? [t.status] : []);
}
type Office = { rooms: { tasks: Task[] }[]; 자체?: Task[]; 언젠가?: Task[]; 가동률?: Record<string, number>; 과업수?: number; source?: string; syncedAt?: string };
type Contract = { 계약일: string; 계약명: string; 클라이언트: string; 계약금액: number; 순매출: number; 입금액: number; 미수금: number; 입금상태: string; 입금예정일: string; 미수종류?: string };
type Money = { 순매출누계: number; 미수금합: number; 고정비월합: number; 계약건수: number; 계약목록?: Contract[] };
const won = (n: number) => `${(n || 0).toLocaleString('ko-KR')}원`;

// 공위치(ball) → 시안 I 칸. 내회신=처리(영업·연락·결재류) / 내작업=작업(제작) / 고객대기=대기 / 시작전=예정(날짜)·언젠가(무날짜) / 보류=보류.
const POS_BTN = ['받은일', '시작전', '내작업', '내회신', '고객대기', '보류', '완수'];
const BALL2KO: Record<string, string> = { inbox: '받은일', start: '시작전', mywork: '내작업', myreply: '내회신', client: '고객대기', hold: '보류', done: '완수' };
const KO2BALL: Record<string, string> = { 받은일: 'inbox', 시작전: 'start', 내작업: 'mywork', 내회신: 'myreply', 고객대기: 'client', 보류: 'hold', 완수: 'done' };
const K2F: Record<string, string> = { 공위치: 'ball', 담당자: 'owner', 고객: 'client', 프로젝트: 'project', 과업명: 'task', 현재상태: 'status', 다음할일: 'nextStep', 기한: 'due' };
function toOver(p: Record<string, string>): Partial<Task> { // 한글 patch → Task 필드(낙관적 즉시반영용)
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) { const f = K2F[k]; if (f) o[f] = f === 'ball' ? (KO2BALL[v] || v) : v; }
  return o as Partial<Task>;
}
const WHO: Record<string, string> = { 신종호: '🧑‍💼 종호', 김지영: '🎨 김지영' };

// 🧪 실험실 — 과업 시트가 아닌 고정 참조. (도구 백로그는 분류=도구 행으로 이관됨)
const EXPERIMENTS = [
  { n: '풋살 케어·트레이닝', g: '개인 — v1 출시 판정 대기' },
  { n: '생일 커뮤니티', g: '개인 — 할지 말지 미정' },
];

const CSS = `
.qb{--ink:#1a1e30}
.qb .note0{font-size:12px;color:#6b7088;margin:0 0 14px}
.qb .filters{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.qb .chip{font-size:12.5px;font-weight:700;border:1px solid #e0e3ee;background:#ffffffcc;border-radius:999px;padding:6px 14px;cursor:pointer;color:#5a6078;box-shadow:0 1px 2px #0000000a}
.qb .chip:hover{border-color:#c4c8da;color:#2a2f44}
.qb .chip.on{background:#3a3d44;border-color:#3a3d44;color:#fff;box-shadow:0 6px 18px -4px #3a3d4455}
.qb .room{position:relative;border:1px solid #ffffff7a;border-radius:24px;padding:12px 15px 15px;min-height:84px;background:#ffffff5c;backdrop-filter:blur(32px) saturate(190%);-webkit-backdrop-filter:blur(32px) saturate(190%);box-shadow:0 12px 38px -12px #2a335548,inset 0 1px 1px #fffffff2,inset 0 0 0 1px #ffffff30,inset 0 -18px 34px -20px #ffffff55,inset 0 16px 30px -22px #ffffff66}
.qb .room.inbox-room{border-left:3px solid #4b5563}.qb .room.proc{border-left:3px solid #586070}.qb .room.work{border-left:3px solid #6b7280}.qb .room.wait{border-left:3px solid #828a98}.qb .room.todo{border-left:3px solid #9aa1ad}.qb .room.someday{border-left:3px solid #9aa1ad}.qb .room.hold{border-left:3px solid #b8bdc8}.qb .room.product{border-left:3px solid #6b7280}
.qb .rh{font-size:13.5px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:6px;color:var(--ink)}
.qb .rh .cnt{background:#0000000d;border-radius:999px;padding:1px 8px;font-size:11px;color:#475569;font-weight:700}.qb .rh .cnt.red{background:#ef4444;color:#fff}.qb .rh .hint{font-weight:500;color:#9298ac;font-size:11px;margin-left:auto}
.qb .board{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start;margin-top:14px}
.qb .room.work .tkt{flex:1 1 280px}
.qb .board3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;align-items:start;margin-top:14px}
.qb .tkts{display:flex;flex-direction:column;gap:8px}.qb .rowwrap{display:flex;gap:10px;flex-wrap:wrap}
.qb .tkt{display:flex;gap:10px;align-items:center;background:#fff;border:1px solid #e7e9f3;border-radius:13px;padding:9px 12px;cursor:pointer;box-shadow:0 2px 8px -6px #1e225522;transition:box-shadow .12s,transform .12s}
.qb .tkt:hover{box-shadow:0 8px 20px -10px #2a335533;transform:translateY(-1px)}.qb .tkt.sel{border-color:#3a3d44;box-shadow:0 0 0 1px #3a3d4488}
.qb .tkt.urgent{border-left:3px solid #ef4458}
.qb .ic{font-size:17px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:#f1f3fa;border-radius:10px;flex-shrink:0}
.qb .tbody{flex:1;min-width:0}.qb .tag-cli{font-size:10px;font-weight:700;color:#9298ac}
.qb .cli-proj{font-size:10.5px;color:#9aa0b0;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.qb .cli-proj .proj{color:#5a6078;font-weight:700}
.qb .task-big{font-size:15px;font-weight:700;color:#1a1e30;line-height:1.32;margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.qb .room.wait .tkt{flex:1 1 280px}
.qb .task{font-size:13.5px;font-weight:700;margin-top:1px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qb .proj-sub{font-size:10.5px;color:#9298ac;margin-top:1px}
.qb .who-bdg{font-size:10px;font-weight:700;color:#5a6078;background:#f1f3fa;border-radius:6px;padding:2px 6px;flex-shrink:0}
.qb .bdg{font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;background:#eef0f7;color:#5a6078;flex-shrink:0}.qb .bdg.soon{background:#fde8eb;color:#e0364a}
.qb .row-item{display:flex;align-items:center;gap:9px;background:#fff;border:1px solid #e7e9f3;border-radius:11px;padding:8px 11px;margin-bottom:6px;cursor:pointer}
.qb .row-item .it{font-size:13px;font-weight:600;color:var(--ink)}.qb .row-item .imeta{font-size:10.5px;color:#9298ac;margin-top:1px}.qb .row-item .ibody{flex:1;min-width:0}
.qb .smalltk{display:flex;gap:7px;align-items:center;background:#fff;border:1px solid #e7e9f3;border-radius:12px;padding:8px 11px;margin-bottom:6px;cursor:pointer;font-size:12px;box-shadow:0 2px 8px -6px #1e225522}
.qb .smalltk:hover{border-color:#c4c8d2}.qb .smalltk .task{font-size:12.5px;white-space:normal}.qb .smalltk .c{font-size:10px;color:#9298ac;font-weight:600;margin-top:1px}
.qb .waitfor{font-size:9.5px;font-weight:800;padding:2px 7px;border-radius:6px;flex-shrink:0;background:#ede5ff;color:#6d4cd0}
.qb .prodcard{flex:1;min-width:200px;background:#fff;border:1px solid #e0e3ee;border-radius:14px;padding:10px 13px;box-shadow:0 4px 14px -8px #2a335522}.qb .prodcard .pn{font-size:13px;font-weight:800;color:var(--ink)}.qb .prodcard .pv{font-size:10.5px;color:#3a3d44;font-weight:700;margin-top:2px}.qb .prodcard .pnext{font-size:10.5px;color:#9298ac;margin-top:4px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.qb .labcard{flex:1;min-width:200px;background:#fff;border:1px dashed #e0a8e8;border-radius:14px;padding:10px 13px}.qb .labcard .ln{font-size:13px;font-weight:700;color:var(--ink)}.qb .labcard .lg{font-size:10.5px;color:#a04ca0;margin-top:3px}
.qb .divider{display:flex;align-items:center;gap:10px;margin:22px 0 10px;color:#7a8098;font-size:12.5px;font-weight:800}.qb .divider::after{content:"";flex:1;height:1px;background:#dde0ec}
.qb .empty{color:#b0b5c6;font-size:12px;padding:12px;text-align:center;width:100%}
.qb .ovl{position:fixed;inset:0;background:#1e225566;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);z-index:40}
.qb .panel{position:fixed;top:0;right:0;width:400px;max-width:92vw;height:100%;background:#ffffffe8;backdrop-filter:blur(30px) saturate(180%);-webkit-backdrop-filter:blur(30px) saturate(180%);border-left:1px solid #ffffffcc;box-shadow:-14px 0 50px #1e225528;z-index:50;display:flex;flex-direction:column}
.qb .ph{padding:18px 20px 12px;border-bottom:1px solid #eef0f7;position:relative}.qb .pcli{font-size:11.5px;font-weight:700;color:#3a3d44}.qb .pproj{font-size:18px;font-weight:800;margin:3px 0 2px;color:#15182a}.qb .pmeta{font-size:11.5px;color:#6b7088}
.qb .pclose{position:absolute;top:14px;right:16px;border:none;background:#f1f3fa;width:30px;height:30px;border-radius:9px;font-size:16px;cursor:pointer;color:#5a6078}
.qb .statebtns{display:flex;gap:6px;margin-top:12px;flex-wrap:wrap}.qb .statebtns button{font-size:11px;font-weight:700;border:1px solid #e0e3ee;background:#f7f8fc;border-radius:8px;padding:5px 10px;cursor:pointer;color:#5a6078}.qb .statebtns button:hover{background:#fff;border-color:#3a3d44}.qb .statebtns button.cur{background:#3a3d44;color:#fff;border-color:#3a3d44}
.qb .pbody{flex:1;overflow-y:auto;padding:16px 20px}.qb .psec{font-size:12px;font-weight:800;color:#1a1e30;margin:0 0 6px}
.qb .mli{display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:1px solid #eef0f6}
.qb .mli-t{font-size:13px;font-weight:700;color:#1a1e30;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qb .mli-s{font-size:10.5px;color:#9298ac;margin-top:1px}
.qb .mli-r{text-align:right;flex-shrink:0}.qb .mli-amt{display:block;font-size:13.5px;font-weight:800}.qb .mli-tag{font-size:9.5px;color:#9298ac}
.qb .step{display:flex;gap:9px;padding:8px 0;border-bottom:1px dashed #f0f2f8;font-size:13px;color:#23283c}
.qb .note{font-size:11.5px;color:#7a8098;padding:10px;background:#f6f7fb;border-radius:9px;margin-top:6px}
.qb .editbox{display:flex;flex-direction:column;gap:6px;margin:0 0 16px}
.qb .ein{font-size:13px;border:1px solid #e0e3ee;border-radius:8px;padding:7px 10px;color:#1a1e30;background:#fff}
.qb .ein:focus{outline:none;border-color:#3a3d44}.qb .ein::placeholder{color:#b0b5c6}
.qb .esave{align-self:flex-start;font-size:12px;font-weight:700;background:#3a3d44;color:#fff;border:none;border-radius:8px;padding:6px 16px;cursor:pointer}.qb .esave:disabled{opacity:.5}
.qb .hint2{font-weight:400;color:#9298ac;font-size:10.5px;margin-left:4px}
.qb .jstep{display:flex;align-items:center;gap:9px;padding:9px 11px;border:1px solid #eef0f7;border-radius:10px;margin-bottom:6px;cursor:pointer;font-size:13.5px;color:#23283c;background:#fff;transition:border-color .1s}
.qb .jstep:hover{border-color:#c4c8da}.qb .jstep.cur{border-color:#3a3d44;box-shadow:0 0 0 1px #3a3d4422;font-weight:700}
.qb .jstep.done{color:#a0a5b8;background:#f7f8fc}.qb .jstep.done .jtext{text-decoration:line-through}
.qb .jmark{width:18px;text-align:center;flex-shrink:0;color:#9298ac}.qb .jstep.cur .jmark{color:#3a3d44}.qb .jstep.done .jmark{color:#10b981}
.qb .jmark,.qb .jtext{cursor:pointer}.qb .jtext{flex:1}.qb .jdate{font-size:10.5px;color:#6b7088;background:#f1f3fa;border-radius:6px;padding:2px 7px;flex-shrink:0}.qb .jdate.now{background:#fde8eb;color:#e0364a;font-weight:700}
.qb .jeditbtn{background:none;border:none;cursor:pointer;font-size:11px;opacity:0;transition:opacity .1s;flex-shrink:0;padding:0 2px}
.qb .jstep:hover .jeditbtn{opacity:.55}.qb .jeditbtn:hover{opacity:1}
.qb .jstep.editing{padding:6px 8px;gap:6px}
.qb .jein2{flex:1;font-size:13px;border:1px solid #3a3d44;border-radius:7px;padding:6px 9px;outline:none}
.qb .jbtn{font-size:11px;font-weight:700;border:none;border-radius:7px;padding:5px 10px;cursor:pointer;flex-shrink:0}
.qb .jbtn.ok{background:#3a3d44;color:#fff}.qb .jbtn.del{background:#fbe4e8;color:#e0364a}.qb .jbtn:disabled{opacity:.4}
.qb .editbtn{font-size:12px;font-weight:800;color:#1a1e30;background:none;border:none;cursor:pointer;padding:2px 0;margin-bottom:6px}
.qb .mtype{display:flex;gap:14px;font-size:12.5px;color:#41465a;margin-bottom:2px}.qb .mtype label{display:flex;align-items:center;gap:4px;cursor:pointer}
.qb .mrow{display:flex;align-items:center;gap:8px}.qb .mrow span{font-size:11.5px;color:#6a7088;width:38px;flex-shrink:0}.qb .mrow input{flex:1}
.qb .addstep{display:flex;gap:6px;margin:8px 0 4px}.qb .addstep input{flex:1;font-size:12.5px;background:#fff;border:1px solid #e0e3ee;border-radius:10px;padding:8px 11px}.qb .addstep input:focus{outline:none;border-color:#3a3d44}
.qb .addstep button{font-size:12px;font-weight:700;background:#eef0f7;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;color:#3a3d44}.qb .addstep button:disabled{opacity:.4}
.qb .memoarea{width:100%;min-height:68px;font-size:12.5px;line-height:1.5;background:#fff;border:1px solid #e0e3ee;border-radius:10px;padding:8px 11px;resize:vertical;font-family:inherit;color:#1a1e30;box-sizing:border-box}.qb .memoarea:focus{outline:none;border-color:#3a3d44}
.qb .docbtn{float:right;font-size:11px;font-weight:700;background:#eef0f7;border:none;border-radius:7px;padding:3px 9px;cursor:pointer;color:#3a3d44}
.qb .mddoc{background:#fafbfe;border:1px solid #eef0f6;border-radius:12px;padding:12px 15px;margin-top:4px}.qb .mddoc>:first-child{margin-top:0}
.qb .ev{display:flex;gap:10px;padding:6px 0;font-size:12.5px;align-items:baseline;border-bottom:1px dashed #f0f2f8}.qb .ev .when{color:#9298ac;font-size:10.5px;flex-shrink:0;width:64px}.qb .ev .what{color:#23283c}
`;

function ddText(d: number | null) { if (d == null) return ''; if (d < 0) return `마감 ${-d}일 지남`; if (d === 0) return '오늘'; return `D-${d}`; }
// 단계 날짜 "M/D" → D-day 정수(연도 없어 올해 기준, 6개월 넘게 지난 날이면 내년으로 본다).
function stepDday(md: string): number | null {
  const m = md.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(now.getFullYear(), +m[1] - 1, +m[2]);
  let diff = Math.round((target.getTime() - t0.getTime()) / 86400000);
  if (diff < -180) { target = new Date(now.getFullYear() + 1, +m[1] - 1, +m[2]); diff = Math.round((target.getTime() - t0.getTime()) / 86400000); }
  return diff;
}

export default function OfficeBoardView() {
  const [office, setOffice] = useState<Office | null>(null);
  const [money, setMoney] = useState<Money | null>(null);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState<'all' | '회사' | 'jy'>('all');
  const [cat, setCat] = useState<'all' | '대행' | '도구' | '리서치' | '자체사업' | '내부'>('all');
  useEffect(() => { try { const c = localStorage.getItem('qb-cat'); if (c) setCat(c as typeof cat); } catch { /**/ } }, []); // 새로고침 유지
  useEffect(() => { try { localStorage.setItem('qb-cat', cat); } catch { /**/ } }, [cat]);
  useEffect(() => { // PC: ESC로 모달 닫기
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSel(null); setMoneyList(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const [moneyList, setMoneyList] = useState<'rev' | 'due' | null>(null); // 스코어카드 클릭→계약 리스트
  const [sel, setSel] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState<Record<string, Partial<Task>>>({}); // 낙관적 덮어쓰기(서버 반영 전 즉시 화면)
  const [edit, setEdit] = useState({ 고객: '', 프로젝트: '', 과업명: '' });
  const [showEdit, setShowEdit] = useState(false);
  const [showMoney, setShowMoney] = useState(false);
  const [mForm, setMForm] = useState({ 종류: '매출', 금액: '', 입금상태: '입금대기', 계약일: '', 마감일: '', 시작월: '', 종료월: '' });
  const [newStep, setNewStep] = useState('');
  const [memoVal, setMemoVal] = useState(''); // 📝 메모(현재 정리·링크)
  const [showHist, setShowHist] = useState(false); // 🕘 이력 아코디언
  const [docEdit, setDocEdit] = useState(false); // 📄 문서 읽기/편집
  const [editStepIdx, setEditStepIdx] = useState<number | null>(null);
  const [editStepVal, setEditStepVal] = useState('');

  const load = useCallback(() => {
    fetch('/api/office').then((r) => r.json()).then((j) => {
      if (j.ok) {
        setOffice(j.office); setMoney(j.money); setOver({});
        try { localStorage.setItem('qb-office', JSON.stringify({ office: j.office, money: j.money })); } catch {}
      } else setErr(j.error || '불러오기 실패');
    }).catch((e) => setErr(String(e)));
  }, []);
  // 첫 페인트: 지난번 받은 보드를 즉시 그려 7~9초 빈 화면을 없앰(뒤에서 최신으로 갱신)
  useEffect(() => {
    try { const s = localStorage.getItem('qb-office'); if (s) { const d = JSON.parse(s); setOffice(d.office); setMoney(d.money); } } catch {}
    load();
  }, [load]);
  // 패널 열 때 수정 입력칸 초기화(고객=실제 고객만, 프로젝트=프로젝트명, 과업명=자리표시 제외)
  useEffect(() => {
    if (sel) {
      setEdit({
        고객: sel.client && sel.client !== sel.project ? sel.client : '',
        프로젝트: sel.project || '',
        과업명: (sel.task && sel.task !== '(프로젝트 등록)') ? sel.task : '',
      });
      setShowEdit(false); setShowMoney(false); setEditStepIdx(null);
      setMemoVal(sel.memo || ''); setShowHist(false); setDocEdit(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.id]);

  const patch = (id: string, body: Record<string, unknown>) => {
    const p = (body as { patch?: Record<string, string> }).patch;
    if (p) setOver((o) => ({ ...o, [id]: { ...o[id], ...toOver(p) } })); // 즉시 화면
    setSel(null);
    fetch('/api/office/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) }).then(() => load()).catch(() => load());
  };
  const complete = (id: string) => {
    setOver((o) => ({ ...o, [id]: { ...o[id], ball: 'done' } })); // 완수=보드서 즉시 사라짐
    setSel(null);
    fetch('/api/office/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).then(() => load()).catch(() => load());
  };
  const saveEdit = () => sel && patch(sel.id, { patch: { 고객: edit.고객, 프로젝트: edit.프로젝트 } });
  const saveMemo = () => { // 메모는 패널 닫지 않고 저장(현재 정리 갱신)
    if (!sel) return;
    const v = memoVal;
    setSel({ ...sel, memo: v });
    setOver((o) => ({ ...o, [sel.id]: { ...o[sel.id], memo: v } }));
    fetch('/api/office/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sel.id, patch: { 메모: v } }) }).then(() => load()).catch(() => load());
  };
  const saveContract = () => {
    if (!sel || !mForm.금액.trim()) return;
    const body = { 종류: mForm.종류, 계약명: sel.project, 클라이언트: (sel.client && sel.client !== sel.project) ? sel.client : '', 금액: mForm.금액, 입금상태: mForm.입금상태, 계약일: mForm.계약일, 마감일: mForm.마감일, 시작월: mForm.시작월, 종료월: mForm.종료월 };
    setShowMoney(false); setMForm({ 종류: '매출', 금액: '', 입금상태: '입금대기', 계약일: '', 마감일: '', 시작월: '', 종료월: '' });
    fetch('/api/office/contract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(() => load()).catch(() => load());
  };
  // 여정 단계 — 완료/되돌림·추가. 패널 유지(setSel 안 닫음)하고 새로고침해 이력·단계 갱신.
  const stepPost = async (id: string, todos: string[], 내용: string) => {
    await fetch('/api/office/step', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, 할일: todos.join(';'), 내용 }) }).catch(() => null);
    load(); // 보드 카드도 갱신(시트API ~0.4초)
  };
  const optimistic = (t: Task, todos: string[], 내용: string) =>
    setSel({ ...t, todos, history: [{ when: '방금', what: 내용 }, ...(t.history || [])] }); // 클릭 즉시 화면 반영
  const toggleStep = (t: Task, i: number) => {
    const todos = [...effTodos(t)];
    const st = parseStep(todos[i]);
    todos[i] = st.done ? st.raw.replace(/^✓\s*/, '') : '✓' + todos[i];
    const 내용 = st.done ? `↩ "${st.text}" 되돌림` : `✓ "${st.text}" 완료`;
    optimistic(t, todos, 내용); stepPost(t.id, todos, 내용);
  };
  const addStep = (t: Task) => {
    const txt = newStep.trim(); if (!txt) return;
    setNewStep('');
    const todos = [...effTodos(t), txt];
    const 내용 = `+ "${txt.replace(/@.*$/, '').trim()}" 추가`;
    optimistic(t, todos, 내용); stepPost(t.id, todos, 내용);
  };
  const startEditStep = (i: number, st: { text: string; date: string }) => { setEditStepIdx(i); setEditStepVal(st.text + (st.date ? ` @${st.date}` : '')); };
  const saveStepEdit = (t: Task, i: number) => {
    const v = editStepVal.trim(); if (!v) return;
    const todos = [...effTodos(t)]; const wasDone = parseStep(todos[i]).done;
    todos[i] = (wasDone ? '✓' : '') + v; setEditStepIdx(null);
    const 내용 = `✎ 단계 수정: "${v.replace(/@.*$/, '').trim()}"`;
    optimistic(t, todos, 내용); stepPost(t.id, todos, 내용);
  };
  const delStep = (t: Task, i: number) => {
    const todos = [...effTodos(t)]; const st = parseStep(todos[i]);
    todos.splice(i, 1); setEditStepIdx(null);
    const 내용 = `🗑 "${st.text}" 삭제`;
    optimistic(t, todos, 내용); stepPost(t.id, todos, 내용);
  };

  if (err) return <p className="text-rose-500 text-center py-10">⚠️ {err}</p>;
  if (!office) return <p className="text-slate-400 text-center py-10">관제탑 불러오는 중…</p>;

  const all: Task[] = [
    ...(office.rooms || []).flatMap((r) => r.tasks),
    ...(office.자체 || []),
    ...(office.언젠가 || []),
  ].map((t) => (over[t.id] ? { ...t, ...over[t.id] } : t)); // 낙관적 덮어쓰기 적용
  const vis = all.filter((t) => filter === 'all' || filter === '회사' || (filter === 'jy' && t.owner === '김지영'));
  // 도구(판매 도구)는 과업 보드가 아니라 아래 도구 백로그로 빠짐. 나머지는 공위치대로 7칸.
  // 작업 보드 = 대행+내부(지금 할 일). 도구·리서치·자체사업은 포트폴리오 섹션으로(칩 누르면 그 분류만 보드에).
  const PORTFOLIO_CATS = new Set(['도구', '리서치', '자체사업']);
  const ACTIVE_BALLS = new Set(['inbox', 'mywork', 'myreply', 'client']);
  // 보드 = 대행+내부 + 자체사업의 '활성 과업'(반보 호스트모집 등). 도구·리서치는 작업 아니라 포트폴리오만.
  const board = cat === 'all'
    ? vis.filter((t) => { const c = t.category || ''; if (c === '도구' || c === '리서치') return false; if (c === '자체사업') return ACTIVE_BALLS.has(t.ball); return true; })
    : vis.filter((t) => (t.category || '') === cat);
  const 리서치들 = all.filter((t) => (t.category || '') === '리서치');
  const 자체사업들 = all.filter((t) => (t.category || '') === '자체사업');
  const 도구들 = all.filter((t) => (t.category || '') === '도구');
  const byDday = (a: Task, b: Task) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0) || (a.dday ?? 9999) - (b.dday ?? 9999); // 급함→임박순(없으면 뒤)
  const inbox = board.filter((t) => t.ball === 'inbox').sort(byDday);
  const proc = board.filter((t) => t.ball === 'myreply').sort(byDday);
  const work = board.filter((t) => t.ball === 'mywork').sort(byDday);
  const wait = board.filter((t) => t.ball === 'client').sort(byDday);
  const todo = board.filter((t) => t.ball === 'start' && t.due).sort(byDday);
  const some = board.filter((t) => t.ball === 'start' && !t.due);
  const hold = board.filter((t) => t.ball === 'hold').sort(byDday);
  const 가동 = Object.entries(office.가동률 || {}).sort(([, a], [, b]) => b - a).map(([k, v]) => `${k} ${v}`).join(' · ') || '–';
  const cur = sel; // 패널은 sel 직접 사용 — 단계/이력은 낙관적 업데이트로 즉시 반영(캐시 지연 우회)

  // 통일 카드: [고객사 · 프로젝트명](프로젝트명 굵게) 한 줄 + 과업 크게(1~2줄). 작업·대기 같은 순서.
  // 대기에선 "지금 기다리는 상황(현재상태)"이 곧 과업 → 그걸 메인 텍스트로. 그 외엔 과업명.
  // 프로젝트=과업. 큰 글씨 = 지금 할 일(현재 단계) → 없으면 현재상태 → 그것도 없으면 프로젝트.
  const bigTask = (t: Task) => {
    const cur = (t.todos || []).map(parseStep).find((s) => !s.done);
    return (cur && cur.text) || t.status || t.project;
  };
  const Card = (t: Task) => {
    const cli = t.client && t.client !== t.project ? t.client : '';
    const big = bigTask(t);
    const showProj = big !== t.project; // 큰글씨가 프로젝트면 윗줄에 또 안 씀
    const cat = CAT[t.category || '']; // 분류 색·이모지
    return (
    <div key={t.id} className={`tkt${t.urgent ? ' urgent' : ''}${sel?.id === t.id ? ' sel' : ''}`} onClick={() => setSel(t)}>
      <div className="ic">{t.ball === 'client' ? '🚪' : t.ball === 'myreply' ? '🧾' : '🖥️'}</div>
      <div className="tbody">
        {(cli || showProj) && <div className="cli-proj">{cli && <span>{cli}{showProj ? ' · ' : ''}</span>}{showProj && <span className="proj" style={cat ? { color: cat.c } : undefined}>{cat ? cat.e + ' ' : ''}{t.project}</span>}</div>}
        <div className="task-big">{big}</div>
      </div>
      {t.owner && t.owner !== '신종호' && <span className="who-bdg">{WHO[t.owner] || t.owner}</span>}
      {t.ball === 'client' && <span className="waitfor">🟣 고객</span>}
      {(() => {
        const c = (t.todos || []).map(parseStep).find((s) => !s.done);  // 지금(첫 미완료) 단계
        const sd = c && c.date ? stepDday(c.date) : null;                // 그 단계 날짜의 D-day
        const dd = sd != null ? sd : (t.due && t.dday != null ? t.dday : null); // 없으면 전체 마감
        return dd != null ? <span className={`bdg${dd <= 7 ? ' soon' : ''}`}>{ddText(dd)}</span> : null;
      })()}
    </div>
    );
  };
  const Empty = () => <div className="empty">— 없음 —</div>;

  return (
    <div className="qb">
      <style>{CSS}</style>
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="glass rounded-2xl p-4 cursor-pointer hover:ring-2 hover:ring-emerald-200 transition" onClick={() => setMoneyList('rev')}><div className="text-xs text-slate-500 mb-1">순매출 누계 <span className="text-slate-300">▸</span></div><div className="text-2xl font-bold text-emerald-600">{won(money?.순매출누계 ?? 0)}</div><div className="text-[11px] text-slate-400 mt-1">계약 {money?.계약건수 ?? 0}건 · 클릭=목록</div></div>
        <div className="glass rounded-2xl p-4 cursor-pointer hover:ring-2 hover:ring-rose-200 transition" onClick={() => setMoneyList('due')}><div className="text-xs text-slate-500 mb-1">미수금 ● <span className="text-slate-300">▸</span></div><div className="text-2xl font-bold text-rose-600">{won(money?.미수금합 ?? 0)}</div><div className="text-[11px] text-slate-400 mt-1">계약금액 − 입금액 · 클릭=목록</div></div>
        <div className="glass rounded-2xl p-4"><div className="text-xs text-slate-500 mb-1">월 고정비</div><div className="text-2xl font-bold text-slate-700">{won(money?.고정비월합 ?? 0)}</div><div className="text-[11px] text-slate-400 mt-1">매달 나가는 돈</div></div>
        <div className="glass rounded-2xl p-4"><div className="text-xs text-slate-500 mb-1">가동률 (담당 과업)</div><div className="text-xl font-bold text-slate-800">{가동}</div><div className="text-[11px] text-slate-400 mt-1">진행 중 과업 {office.과업수 ?? 0}개</div></div>
      </section>
      <p className="note0">실시간 업무 현황 — 받은일 · 처리 · 작업 · 대기 · 예정 · 언젠가 · 제품 {office.source === 'sheet' ? `· ✓ ${office.syncedAt} 기준` : office.source === 'seed' ? '· ⚠️ 미리보기 시드' : ''}</p>
      <div className="filters">
        {([['all', '전체'], ['회사', '🏢 큐앤뱅'], ['jy', '🎨 김지영']] as const).map(([k, lb]) => (
          <div key={k} className={`chip${filter === k ? ' on' : ''}`} onClick={() => setFilter(k)}>{lb}</div>
        ))}
      </div>
      <div className="filters" style={{ marginTop: -6 }}>
        <div className={`chip${cat === 'all' ? ' on' : ''}`} onClick={() => setCat('all')}>전체 분류</div>
        {(['대행', '도구', '리서치', '자체사업', '내부'] as const).map((k) => (
          <div key={k} className="chip" style={cat === k ? { background: CAT[k].c, borderColor: CAT[k].c, color: '#fff' } : { color: CAT[k].c }} onClick={() => setCat(cat === k ? 'all' : k)}>{CAT[k].e} {k}</div>
        ))}
      </div>

      <div className="board">
        <section className="room inbox-room"><div className="rh">📥 받은 일 <span className={`cnt${inbox.length ? ' red' : ''}`}>{inbox.length}</span><span className="hint">미분류</span></div>
          <div className="tkts">{inbox.length ? inbox.map(Card) : <div className="empty">📭 비움</div>}</div></section>
        <section className="room proc"><div className="rh">🧾 처리 <span className="cnt">{proc.length}</span><span className="hint">영업·연락·결재</span></div>
          <div className="tkts">{proc.length ? proc.map(Card) : <Empty />}</div></section>
      </div>

      <section className="room work" style={{ marginTop: 14 }}><div className="rh">🖥️ 작업 <span className="cnt">{work.length}</span><span className="hint">제작·디자인</span></div>
        <div className="rowwrap">{work.length ? work.map(Card) : <Empty />}</div></section>

      <section className="room wait" style={{ marginTop: 14 }}><div className="rh">🚪 대기 <span className="cnt">{wait.length}</span><span className="hint">상대 답·결과 기다림</span></div>
        <div className="rowwrap">{wait.length ? wait.map(Card) : <Empty />}</div></section>

      <div className="board3">
        <section className="room todo"><div className="rh">📅 예정 <span className="cnt">{todo.length}</span><span className="hint">날짜 있음</span></div>
          {todo.length ? todo.map((t) => <div key={t.id} className="smalltk" onClick={() => setSel(t)}><span>📅</span><div><div className="task">{t.project}</div><div className="c">{ddText(t.dday)} · {t.task}</div></div></div>) : <Empty />}</section>
        <section className="room someday"><div className="rh">💭 언젠가 <span className="cnt">{some.length}</span><span className="hint">날짜 없음</span></div>
          {some.length ? some.map((t) => <div key={t.id} className="smalltk" onClick={() => setSel(t)}><span>💭</span><div><div className="task">{t.project}</div><div className="c">{t.client || '날짜 없음'}</div></div></div>) : <Empty />}</section>
        <section className="room hold"><div className="rh">⏸️ 보류 <span className="cnt">{hold.length}</span><span className="hint">멈춤</span></div>
          {hold.length ? hold.map((t) => <div key={t.id} className="smalltk" onClick={() => setSel(t)}><span>⏸️</span><div><div className="task">{t.project}</div><div className="c">{t.status || t.task}</div></div></div>) : <Empty />}</section>
      </div>

      {cat === 'all' && filter !== 'jy' && (<>
        <div className="divider" style={{ color: CAT['도구'].c }}>🧰 도구 백로그 — 판매 제품 ({도구들.length}) · 누르면 설명·사용법</div>
        <section className="room product"><div className="rowwrap">{도구들.length ? 도구들.map((t) => (
          <div key={t.id} className="prodcard" style={{ cursor: 'pointer' }} onClick={() => setSel(t)}><div className="pn" style={{ color: CAT['도구'].c }}>🧰 {t.project || t.task}</div><div className="pnext">{(t.memo || '').split('\n')[0] || t.status || '설명 비어있음'}</div></div>
        )) : <div className="empty">없음</div>}</div></section>

        <div className="divider" style={{ color: CAT['자체사업'].c }}>🚀 자체사업 — 시장 벤처 → 브랜드 ({자체사업들.length})</div>
        <section className="room product"><div className="rowwrap">{자체사업들.length ? 자체사업들.map((t) => (
          <div key={t.id} className="prodcard" style={{ cursor: 'pointer' }} onClick={() => setSel(t)}><div className="pn" style={{ color: CAT['자체사업'].c }}>🚀 {t.project || t.task}</div><div className="pnext">{(t.memo || '').split('\n')[0] || t.status || '설명 비어있음'}</div></div>
        )) : <div className="empty">없음</div>}</div></section>

        <div className="divider" style={{ color: CAT['리서치'].c }}>🔬 리서치 풀 — 탐색·자산 (쌓여 프로젝트 자산) ({리서치들.length})</div>
        <section className="room product"><div className="rowwrap">{리서치들.length ? 리서치들.map((t) => (
          <div key={t.id} className="prodcard" style={{ cursor: 'pointer' }} onClick={() => setSel(t)}><div className="pn" style={{ color: CAT['리서치'].c }}>🔬 {t.project || t.task}</div><div className="pnext">{(t.memo || '').split('\n')[0] || t.status || '설명 비어있음'}</div></div>
        )) : <div className="empty">없음</div>}</div></section>

        <div className="divider">🧪 실험실 — 개인·미공식 (공식화 게이트)</div>
        <section className="room product"><div className="rowwrap">{EXPERIMENTS.map((x) => (
          <div key={x.n} className="labcard"><div className="ln">🧪 {x.n}</div><div className="lg">{x.g}</div></div>
        ))}</div></section>
      </>)}

      {moneyList && (() => {
        const cs = money?.계약목록 || [];
        const list = moneyList === 'due'
          ? cs.filter((c) => c.미수금 > 0).sort((a, b) => b.미수금 - a.미수금)
          : cs.slice().sort((a, b) => b.순매출 - a.순매출);
        return (<>
          <div className="ovl" onClick={() => setMoneyList(null)} />
          <aside className="panel">
            <div className="ph"><button className="pclose" onClick={() => setMoneyList(null)}>✕</button>
              <div className="pproj">{moneyList === 'due' ? '🔴 미수금 계약' : '💰 순매출 계약'} <span style={{ fontSize: 13, color: '#9298ac', fontWeight: 500 }}>{list.length}건</span></div>
              <div className="pmeta">{moneyList === 'due' ? '아직 못 받은 돈 (계약금액 − 입금액)' : '계약별 순매출 = 부가세 뺀 실매출'}</div>
            </div>
            <div className="pbody">
              {list.length === 0 ? <div className="empty">없음</div> : list.map((c, i) => (
                <div key={i} className="mli">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mli-t">{c.계약명}</div>
                    <div className="mli-s">{c.클라이언트}{c.계약일 ? ' · ' + c.계약일 : ''}</div>
                  </div>
                  <div className="mli-r">
                    <span className="mli-amt" style={{ color: moneyList === 'due' ? '#e0364a' : '#059669' }}>{won(moneyList === 'due' ? c.미수금 : c.순매출)}</span>
                    <span className="mli-tag">{moneyList === 'due' ? (c.미수종류 === '받을예정' ? '예정 ' + (c.입금예정일 || '') : '미정') : c.입금상태}</span>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </>);
      })()}

      {cur && (<>
        <div className="ovl" onClick={() => setSel(null)} />
        <aside className="panel" style={DOC_LABEL[cur.category || ''] ? { width: 600 } : undefined}>
          <div className="ph"><button className="pclose" onClick={() => setSel(null)}>✕</button>
            <div className="pcli">{cur.client && cur.client !== cur.project ? `${cur.client} · ` : ''}{cur.project}</div><div className="pproj">{bigTask(cur)}</div>
            <div className="pmeta">{WHO[cur.owner] || cur.owner}{cur.due && cur.dday != null ? ` · ${ddText(cur.dday)}` : ''}</div>
            <div className="statebtns">{POS_BTN.map((p) => (
              <button key={p} className={BALL2KO[cur.ball] === p ? 'cur' : ''} disabled={busy} onClick={() => p === '완수' ? complete(cur.id) : patch(cur.id, { patch: { 공위치: p } })}>{p}</button>
            ))}</div>
            <div className="statebtns"><button disabled={busy} onClick={() => patch(cur.id, { patch: { 담당자: cur.owner === '김지영' ? '신종호' : '김지영' } })}>담당 → {cur.owner === '김지영' ? '종호' : '지영'}</button></div>
          </div>
          <div className="pbody">
            {DOC_LABEL[cur.category || ''] && (<>
              <div className="psec">{DOC_LABEL[cur.category!].t} <span className="hint2">{DOC_LABEL[cur.category!].h}</span>
                <button className="docbtn" onClick={() => setDocEdit((v) => !v)}>{docEdit ? '✓ 보기' : '✏️ 편집'}</button></div>
              {docEdit ? (<>
                <textarea className="memoarea" style={{ minHeight: 300 }} value={memoVal} onChange={(e) => setMemoVal(e.target.value)} placeholder={DOC_LABEL[cur.category!].p + ' (마크다운 # ## - **굵게** [링크](url) 지원)'} />
                {memoVal !== (cur.memo || '') && <button className="esave" onClick={() => { saveMemo(); setDocEdit(false); }}>문서 저장</button>}
              </>) : (
                <div className="mddoc">{memoVal.trim() ? renderMarkdown(memoVal) : <div className="note">내용 없음 — ✏️ 편집으로 작성하세요. (마크다운 지원)</div>}</div>
              )}
            </>)}
            <button className="editbtn" onClick={() => setShowEdit((v) => !v)}>✏️ 정보 수정 {showEdit ? '▲' : '▼'}</button>
            {showEdit && (<div className="editbox">
              <input className="ein" value={edit.고객} onChange={(e) => setEdit({ ...edit, 고객: e.target.value })} placeholder="고객사 (자체면 비움)" />
              <input className="ein" value={edit.프로젝트} onChange={(e) => setEdit({ ...edit, 프로젝트: e.target.value })} placeholder="프로젝트명 (= 과업)" />
              <button className="esave" disabled={busy} onClick={saveEdit}>저장</button>
            </div>)}
            <button className="editbtn" onClick={() => setShowMoney((v) => !v)}>💰 계약 입력 {showMoney ? '▲' : '▼'}</button>
            {showMoney && (<div className="editbox">
              <div className="mtype">
                <label><input type="radio" checked={mForm.종류 === '매출'} onChange={() => setMForm({ ...mForm, 종류: '매출' })} /> 일회성 계약</label>
                <label><input type="radio" checked={mForm.종류 === '정기매출'} onChange={() => setMForm({ ...mForm, 종류: '정기매출' })} /> 월정기</label>
              </div>
              <input className="ein" inputMode="numeric" value={mForm.금액} onChange={(e) => setMForm({ ...mForm, 금액: e.target.value })} placeholder={mForm.종류 === '정기매출' ? '월 금액 (원)' : '계약금액 (원)'} />
              {mForm.종류 === '매출' ? (<>
                <select className="ein" value={mForm.입금상태} onChange={(e) => setMForm({ ...mForm, 입금상태: e.target.value })}>
                  <option>입금대기</option><option>선수금</option><option>부분입금</option><option>입금완료</option>
                </select>
                <div className="mrow"><span>계약일</span><input type="date" className="ein" value={mForm.계약일} onChange={(e) => setMForm({ ...mForm, 계약일: e.target.value })} /></div>
                <div className="mrow"><span>마감일</span><input type="date" className="ein" value={mForm.마감일} onChange={(e) => setMForm({ ...mForm, 마감일: e.target.value })} /></div>
              </>) : (<>
                <div className="mrow"><span>시작월</span><input type="month" className="ein" value={mForm.시작월} onChange={(e) => setMForm({ ...mForm, 시작월: e.target.value })} /></div>
                <div className="mrow"><span>종료월</span><input type="month" className="ein" value={mForm.종료월} onChange={(e) => setMForm({ ...mForm, 종료월: e.target.value })} /></div>
              </>)}
              <button className="esave" disabled={busy} onClick={saveContract}>{mForm.종류 === '정기매출' ? '정기매출' : '매출'} 원장에 기록</button>
            </div>)}
            <div className="psec" style={{ marginTop: 16 }}>🧭 할일 흐름 <span className="hint2">✓완료 · ▶지금 · 클릭=넘기기</span></div>
            {(() => {
              const steps = effTodos(cur).map(parseStep);
              const firstUndone = steps.findIndex((s) => !s.done);
              return steps.map((st, i) => editStepIdx === i ? (
                <div key={i} className="jstep editing">
                  <input className="jein2" value={editStepVal} autoFocus onChange={(e) => setEditStepVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveStepEdit(cur, i); if (e.key === 'Escape') setEditStepIdx(null); }} placeholder="단계 내용 (날짜 @6/25)" />
                  <button className="jbtn ok" disabled={busy} onClick={() => saveStepEdit(cur, i)}>저장</button>
                  <button className="jbtn del" disabled={busy} onClick={() => delStep(cur, i)}>🗑</button>
                </div>
              ) : (
                <div key={i} className={`jstep${st.done ? ' done' : i === firstUndone ? ' cur' : ''}`}>
                  <span className="jmark" onClick={() => toggleStep(cur, i)}>{st.done ? '✓' : i === firstUndone ? '▶' : '○'}</span>
                  <span className="jtext" onClick={() => toggleStep(cur, i)}>{st.text}</span>
                  {st.date && <span className={`jdate${i === firstUndone ? ' now' : ''}`}>📅 {st.date}{i === firstUndone && stepDday(st.date) != null ? ` · ${ddText(stepDday(st.date))}` : ''}</span>}
                  <button className="jeditbtn" onClick={() => startEditStep(i, st)}>✏️</button>
                </div>
              ));
            })()}
            <div className="addstep">
              <input value={newStep} onChange={(e) => setNewStep(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addStep(cur)} placeholder="+ 단계 추가 (날짜 @6/25)" />
              <button disabled={busy || !newStep.trim()} onClick={() => addStep(cur)}>추가</button>
            </div>
            {!DOC_LABEL[cur.category || ''] && (<>
              <div className="psec" style={{ marginTop: 16 }}>📝 메모 <span className="hint2">현재 정리·문서 링크 (살아있는 기록)</span></div>
              <textarea className="memoarea" value={memoVal} onChange={(e) => setMemoVal(e.target.value)} placeholder="진행 정리, 문서 링크, 메모를 자유롭게…" />
              {memoVal !== (cur.memo || '') && <button className="esave" onClick={saveMemo}>메모 저장</button>}
            </>)}
            <button className="editbtn" style={{ marginTop: 16 }} onClick={() => setShowHist((v) => !v)}>🕘 이력{cur.history && cur.history.length ? ` (${cur.history.length})` : ''} {showHist ? '▲' : '▼'}</button>
            {showHist && (cur.history && cur.history.length ? (
              <div className="tl">{cur.history.map((e, i) => (
                <div key={i} className="ev"><span className="when">{e.when}</span><span className="what">{e.what}</span></div>
              ))}</div>
            ) : <div className="note">아직 이력 없음. 단계를 완료하면 여기 쌓입니다.</div>)}
          </div>
        </aside>
      </>)}
    </div>
  );
}
