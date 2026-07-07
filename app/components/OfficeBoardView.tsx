'use client';

// 관제탑 보드 — 시안 I 그대로(리퀴드 글라스). 받은일·처리·작업·대기·예정·언젠가·보류 + 제품.
// 시트의 flat 공위치(ball)를 시안 I 칸으로 매핑해 실데이터로 그린다. 카드 클릭=슬라이드 패널.
import { useEffect, useState, useCallback } from 'react';
import { renderMarkdown } from '@/lib/markdown';
import { Loading, ErrorBox } from './ui';

type Task = {
  id: string; project: string; task: string; owner: string;
  money: string; ball: string; due: string; dday: number | null;
  urgent: boolean; client?: string; status?: string; nextStep?: string;
  todos?: string[]; staleDays?: number | null; stale?: boolean;
  category?: string;
  memo?: string;
  repo?: string;
  history?: { when: string; what: string }[];
};
// 깃 자동 프로젝트(읽기 전용) — /api/git-projects. 진행 중인 것만 사무실에 자동 표출(시트 안 씀=좀비 없음).
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
// 할일 단계 파싱: "✓텍스트 @6/25" 또는 "텍스트 @7/1~7/10" → {done, text, date(=마감), start(=시작, 있을 때만)}
function parseStep(raw: string) {
  const done = raw.startsWith('✓');
  let s = (done ? raw.slice(1) : raw).trim();
  // 단계 앞 @담당 토큰(공백 없는 한 토큰). 신종호·김지영=내부, 그 외=외주사명. 안 적으면 카드 담당 상속.
  const om = s.match(/^@(\S+)\s+/);
  const owner = om ? om[1] : '';
  if (om) s = s.slice(om[0].length).trim();
  // 끝의 @월/일 = 마감일. @시작~마감이면 앞=시작·뒤=마감(하위호환: 단일 @6/25는 start='' date='6/25').
  const dm = s.match(/@\s*(\d{1,2}\/\d{1,2})(?:~(\d{1,2}\/\d{1,2}))?\s*$/);
  const start = dm && dm[2] ? dm[1] : '';       // 물결(~) 뒤가 있을 때만 앞쪽이 시작일
  const date = dm ? (dm[2] || dm[1]) : '';       // 마감일 = 항상 뒤쪽(또는 단일)
  if (dm) s = s.slice(0, dm.index).trim();
  return { done, text: s, date, start, owner, raw };
}
// 단계 날짜 토큰 직렬화 — 시작이 있으면 @시작~마감, 아니면 @마감(없으면 빈 문자열). 저장 재조립 전용.
function dateToken(st: { date: string; start?: string }): string {
  if (!st.date) return '';
  return st.start ? ` @${st.start}~${st.date}` : ` @${st.date}`;
}
// 할일 단계가 비었으면 현재상태를 '지금 단계'로 흐름에 흡수. 손대는 순간(체크·추가) 진짜 단계로 굳어 이력에 쌓임.
function effTodos(t: { todos?: string[]; status?: string }): string[] {
  return t.todos && t.todos.length ? t.todos : (t.status ? [t.status] : []);
}
// 리서치 문서를 # / ## 헤딩 기준 섹션으로 분해 — 게시판식(섹션 클릭하면 펼침).
function mdSections(md: string): { h: string; body: string }[] {
  const cur = { h: '', body: [] as string[] };
  const secs: { h: string; body: string[] }[] = [];
  for (const ln of (md || '').split('\n')) {
    const m = ln.match(/^#{1,2}\s+(.*)/);
    if (m) { if (cur.h || cur.body.join('').trim()) secs.push({ h: cur.h, body: [...cur.body] }); cur.h = m[1]; cur.body = []; }
    else cur.body.push(ln);
  }
  if (cur.h || cur.body.join('').trim()) secs.push({ h: cur.h, body: cur.body });
  return secs.map((s) => ({ h: s.h, body: s.body.join('\n') }));
}
type Office = { rooms: { tasks: Task[] }[]; 자체?: Task[]; 언젠가?: Task[]; 가동률?: Record<string, number>; 과업수?: number; source?: string; syncedAt?: string };
type Contract = { 계약일: string; 계약명: string; 클라이언트: string; 계약금액: number; 순매출: number; 입금액: number; 입금일?: string; 미수금: number; 입금상태: string; 입금예정일: string; 미수종류?: string };
type Money = { 순매출누계: number; 미수금합: number; 고정비월합: number; 계약건수: number; 계약목록?: Contract[]; 고정비목록?: { 항목: string; 금액: number; 납부일: string; 종류: string }[] };
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
const WHO: Record<string, string> = { 신종호: '🧑‍💼 종호', 김지영: '🎨 김지영', 전체: '👥 전체' };
// 캘린더 담당자 색(시안 기준) — 신종호 파랑·김지영 분홍·그 외(외주) 회색.
const OWNER_COLOR = (owner: string) => owner === '신종호' ? '#4a6fd6' : owner === '김지영' ? '#c95f8a' : '#7a8296';

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
.qb .tkt[draggable],.qb .smalltk[draggable]{cursor:grab}.qb .tkt:active,.qb .smalltk:active{cursor:grabbing}
.qb.dragging .room{outline:2px dashed #c4c8da;outline-offset:-5px;transition:outline .1s}.qb.dragging .room:hover{outline-color:#3a3d44;background:#3a3d440a}
.qb .tkt:hover{box-shadow:0 8px 20px -10px #2a335533;transform:translateY(-1px)}.qb .tkt.sel{border-color:#3a3d44;box-shadow:0 0 0 1px #3a3d4488}
.qb .tkt.urgent{border-left:3px solid #ef4458}
.qb .ic{font-size:17px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:#f1f3fa;border-radius:10px;flex-shrink:0}
.qb .tbody{flex:1;min-width:0}.qb .tag-cli{font-size:10px;font-weight:700;color:#9298ac}
.qb .cli-proj{font-size:10.5px;color:#9aa0b0;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:5px}.qb .cli-proj .proj{color:#2563eb;font-weight:700}
.qb .clibadge{display:inline-block;padding:1px 6px;border-radius:5px;background:#eef0f6;color:#4b5563;font-size:10px;font-weight:700;flex-shrink:0}
.qb .clibadge.own{background:#f6f6f6;color:#8a8f9c}
.qb .task-big{font-size:15px;font-weight:700;color:#1a1e30;line-height:1.32;margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.qb .room.wait .tkt{flex:1 1 280px}
.qb .task{font-size:13.5px;font-weight:700;margin-top:1px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qb .proj-sub{font-size:10.5px;color:#9298ac;margin-top:1px}
.qb .who-bdg{font-size:10px;font-weight:700;color:#5a6078;background:#f1f3fa;border-radius:6px;padding:2px 6px;flex-shrink:0}
.qb .who-bdg.outsrc{color:#0d9488;background:#ccfbf1}
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
.qb .qa{margin-bottom:8px;display:flex;flex-direction:column;gap:5px}
.qb .qa input{width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:7px;padding:6px 9px;font-size:12px;background:#fff;color:var(--ink)}
.qb .qa input:focus{outline:none;border-color:#6366f1}
.qb .qa-btns{display:flex;gap:5px}
.qb .qa-btns button{flex:1;font-size:11px;padding:5px 4px;border-radius:6px;border:1px solid #d1d5db;background:#fff;cursor:pointer;color:var(--ink)}
.qb .qa-btns button:hover{background:#eef2ff;border-color:#a5b4fc}
.qb .ovl{position:fixed;inset:0;background:#1e225566;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);z-index:40}
.qb .panel{position:fixed;top:0;right:0;width:400px;max-width:92vw;height:100%;background:#ffffffe8;backdrop-filter:blur(30px) saturate(180%);-webkit-backdrop-filter:blur(30px) saturate(180%);border-left:1px solid #ffffffcc;box-shadow:-14px 0 50px #1e225528;z-index:50;display:flex;flex-direction:column}
.qb .ph{padding:18px 20px 12px;border-bottom:1px solid #eef0f7;position:relative}.qb .pcli{font-size:11.5px;font-weight:700;color:#3a3d44}.qb .pproj{font-size:18px;font-weight:800;margin:3px 0 2px;color:#15182a}.qb .pmeta{font-size:11.5px;color:#6b7088}
.qb .pclose{position:absolute;top:14px;right:16px;border:none;background:#f1f3fa;width:30px;height:30px;border-radius:9px;font-size:16px;cursor:pointer;color:#5a6078}
.qb .statebtns{display:flex;gap:6px;margin-top:12px;flex-wrap:wrap}.qb .statebtns button{font-size:11px;font-weight:700;border:1px solid #e0e3ee;background:#f7f8fc;border-radius:8px;padding:5px 10px;cursor:pointer;color:#5a6078}.qb .statebtns button:hover{background:#fff;border-color:#3a3d44}.qb .statebtns button.cur{background:#3a3d44;color:#fff;border-color:#3a3d44}
.qb .statebtns button.discard{color:#e0364a;border-color:#fadde2}.qb .statebtns button.discard:hover{background:#fde8eb;border-color:#e0364a}
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
.qb .jmark,.qb .jtext{cursor:pointer}.qb .jtext{flex:1;min-width:0;word-break:keep-all}.qb .jdate{font-size:10.5px;color:#6b7088;background:#f1f3fa;border-radius:6px;padding:2px 7px;flex-shrink:0;white-space:nowrap;cursor:pointer}.qb .jdate:hover{outline:1px solid #9aa0b8}.qb .jdate.now{background:#fde8eb;color:#e0364a;font-weight:700}
.qb .jdate.empty{background:none;border:1px dashed #c4c8da;color:#9aa0b8;flex:0 0 30px;width:30px;box-sizing:border-box;text-align:center;padding-left:0;padding-right:0;overflow:hidden}
.qb .datebox{border:1px solid #3a3d44;border-radius:10px;background:#fff;padding:10px 12px;margin:-2px 0 8px 27px;box-shadow:0 8px 24px -10px #1e225544}
.qb .datebox .drow{display:flex;align-items:center;gap:8px;margin-bottom:6px}.qb .datebox .drow span{font-size:11.5px;color:#6a7088;width:44px;flex-shrink:0}.qb .datebox .drow input{flex:1}
.qb .datebox .dbtns{display:flex;gap:6px;margin-top:2px}.qb .datebox .ok{font-size:12px;font-weight:700;background:#3a3d44;color:#fff;border:none;border-radius:8px;padding:5px 14px;cursor:pointer}.qb .datebox .clear{font-size:12px;background:#f1f3fa;color:#6a7088;border:none;border-radius:8px;padding:5px 10px;cursor:pointer}
/* ── 뷰 토글 + 캘린더뷰(시안 이식) ── */
.qb .viewtoggle{margin-left:auto;display:flex;border-radius:8px;overflow:hidden;border:1px solid #e0e3ee}
.qb .viewtoggle span{padding:6px 16px;font-size:13px;background:#ffffffcc;color:#5a6078;cursor:pointer;font-weight:700}.qb .viewtoggle span.on{background:#3a3d44;color:#fff}
.qb .calwrap{padding:2px 4px 8px}
.qb .monthnav{display:flex;align-items:center;gap:12px;padding:14px 18px 4px}.qb .monthnav b{font-size:17px}
.qb .mbtn{width:26px;height:26px;border-radius:6px;background:#ffffff90;border:1px solid #ffffffaa;text-align:center;line-height:24px;font-size:13px;color:#4a5069;cursor:pointer}
.qb .todaybtn{font-size:12px;padding:4px 10px;border-radius:6px;background:#ffffff90;border:1px solid #ffffffaa;color:#4a5069;cursor:pointer}
.qb .legend{margin-left:auto;display:flex;gap:12px;font-size:12px;color:#4a5069;align-items:center;flex-wrap:wrap}
.qb .legend .dot{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:4px;vertical-align:-1px}
.qb .cal{padding:12px 14px 16px}
.qb .dow{display:grid;grid-template-columns:repeat(7,1fr);font-size:12px;color:#6a7089;padding:6px 0;text-align:center;font-weight:700}.qb .dow .sun{color:#d6455f}.qb .dow .sat{color:#4a6fd6}
.qb .week{position:relative;border-top:1px solid #ffffff88}
.qb .days{display:grid;grid-template-columns:repeat(7,1fr)}
.qb .day{min-height:96px;padding:6px 6px 4px;border-right:1px solid #ffffff55;font-size:12px;color:#5a6079}.qb .day:last-child{border-right:none}.qb .day .n{font-weight:700}.qb .day.out{opacity:.35}.qb .day.sun .n{color:#d6455f}.qb .day.sat .n{color:#4a6fd6}
.qb .day.today{background:#ffffff70}.qb .day.today .n{background:#1e2233;color:#fff;border-radius:5px;padding:1px 6px}
.qb .bars{position:absolute;top:36px;left:0;right:0;display:grid;grid-template-columns:repeat(7,1fr);grid-auto-rows:22px;row-gap:3px;pointer-events:none}
.qb .bar{height:20px;border-radius:5px;font-size:11.5px;font-weight:700;color:#fff;padding:2px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0 3px;box-shadow:0 2px 6px -2px #2a335560}
.qb .bar.contL{border-top-left-radius:0;border-bottom-left-radius:0;margin-left:0}.qb .bar.contR{border-top-right-radius:0;border-bottom-right-radius:0;margin-right:0}
.qb .due{height:20px;border-radius:5px;font-size:11.5px;font-weight:700;padding:2px 6px;margin:0 3px;background:#ffffffd8;border:1px dashed #9aa0b8;color:#3a415c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.qb .due::before{content:"◆ ";color:#d6455f;font-size:9px}
.qb .jeditbtn{background:none;border:none;cursor:pointer;font-size:11px;opacity:0;transition:opacity .1s;flex-shrink:0;padding:0 2px}
.qb .jstep:hover .jeditbtn{opacity:.55}.qb .jeditbtn:hover{opacity:1}
.qb .jwho{font-size:10px;font-weight:700;border:none;border-radius:6px;padding:2px 4px;flex-shrink:0;max-width:76px;white-space:nowrap;cursor:pointer;background:#f1f3fa;color:#9298ac;opacity:.5;transition:opacity .1s;-webkit-appearance:none;appearance:none}
.qb .jstep:hover .jwho{opacity:1}.qb .jwho:hover{opacity:1}
.qb .jwho.set{opacity:1;color:#5a6078}.qb .jwho.set.out{color:#0d9488;background:#ccfbf1}
.qb .arcwrap{margin-top:18px}
.qb .arctoggle{background:#fff;border:1px solid #e7e9f3;border-radius:10px;padding:9px 14px;font-size:12.5px;font-weight:700;color:#5a6078;cursor:pointer}.qb .arctoggle:hover{border-color:#c4c8da}
.qb .arcload{font-size:12px;color:#9298ac;padding:10px 4px}
.qb .arcbody{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:10px}
.qb .arch{font-size:12.5px;font-weight:700;color:#2a2f44;margin-bottom:6px}.qb .arccnt{background:#0000000d;border-radius:999px;padding:1px 7px;font-size:11px;color:#475569;margin-left:4px}
.qb .arcrow{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #eef0f7;border-radius:8px;padding:6px 10px;margin-bottom:5px;font-size:12px}
.qb .arcnm{font-weight:700;color:#23283c;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.qb .arccli{color:#9298ac;font-size:11px}.qb .arcown{font-size:10px;font-weight:700;color:#5a6078;background:#f1f3fa;border-radius:5px;padding:1px 5px}.qb .arcdate{font-size:10.5px;color:#9aa0b0;flex-shrink:0}
.qb .arcempty{font-size:11.5px;color:#b8bdc8;padding:6px 4px}
.qb .npbtn{margin-left:auto;background:#14182a;color:#fff;border:none;border-radius:999px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer}.qb .npbtn:hover{background:#23283c}
.qb .npform{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 16px;background:#fff;border:1px solid #e7e9f3;border-radius:12px;padding:10px 12px}
.qb .npform input,.qb .npform select{border:1px solid #e0e3ee;border-radius:8px;padding:6px 10px;font-size:13px;color:#23283c}
.qb .npform>input:first-of-type{flex:1;min-width:180px}
.qb .npcli{width:160px}
.qb .nplbl{font-size:11.5px;color:#9298ac;display:flex;align-items:center;gap:5px}
.qb .npok{background:#10b981;color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:12.5px;font-weight:700;cursor:pointer}.qb .npok:disabled{opacity:.5;cursor:default}.qb .npok:not(:disabled):hover{background:#0ea372}
.qb .npmsg{flex-basis:100%;width:100%;font-size:12.5px;font-weight:700;border-radius:8px;padding:7px 11px;margin-top:2px}
.qb .npmsg.ok{background:#ecfdf5;color:#0a7d55;border:1px solid #b7ecd6}
.qb .npmsg.err{background:#fef2f2;color:#c0392b;border:1px solid #f6c9c4}
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
.qb .secboard{margin-top:4px;border:1px solid #eef0f6;border-radius:12px;overflow:hidden}
.qb .secitem{border-bottom:1px solid #f1f3f9}.qb .secitem:last-child{border-bottom:none}
.qb .sechead{width:100%;text-align:left;background:#fff;border:none;cursor:pointer;font-size:12.5px;font-weight:700;color:#2a2f44;padding:10px 13px;display:flex;gap:7px;align-items:flex-start}.qb .sechead:hover{background:#fafbfe}.qb .secarr{color:#9298ac;flex-shrink:0}
.qb .secitem .mddoc{border:none;border-radius:0;margin-top:0;border-top:1px solid #f1f3f9}
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
// "M/D" → "YYYY-MM-DD"(date input value). 연도는 stepDday와 같은 추론(6개월 넘게 지났으면 내년).
function mdToYmd(md: string): string {
  const m = md.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return '';
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let y = now.getFullYear();
  const diff = Math.round((new Date(y, +m[1] - 1, +m[2]).getTime() - t0.getTime()) / 86400000);
  if (diff < -180) y += 1;
  return `${y}-${String(+m[1]).padStart(2, '0')}-${String(+m[2]).padStart(2, '0')}`;
}
// "YYYY-MM-DD"(date input) → "M/D"(저장 토큰). 연도는 버림.
function ymdToMd(ymd: string): string {
  const m = ymd.match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? `${+m[1]}/${+m[2]}` : '';
}
// 카드가 실제로 보여주는 D-day = 지금 단계의 @날짜(있으면) 아니면 과업 기한. 정렬·뱃지·urgent 모두 이걸로.
function cardDday(t: { todos?: string[]; status?: string; due?: string; dday?: number | null }): number | null {
  const c = currentStep(t);
  const sd = c && c.date ? stepDday(c.date) : null;
  return sd != null ? sd : (t.due && t.dday != null ? t.dday : null);
}
// 지금 단계 = 미완료 중 날짜 가장 이른 것(무날짜는 뒤). 패널 ▶·카드 큰글씨·D-day 모두 이걸로 일치.
function currentStep(t: { todos?: string[]; status?: string }) {
  const undone = effTodos(t).map(parseStep).filter((s) => !s.done);
  if (!undone.length) return null;
  return [...undone].sort((a, b) => (a.date ? (stepDday(a.date) ?? 99999) : 99999) - (b.date ? (stepDday(b.date) ?? 99999) : 99999))[0];
}
// 대기 카드가 누구 답을 기다리는지 — 지금 단계(없으면 카드) 담당이 외부인이면 그 이름, 내부·미지정이면 '고객'
function waitOn(t: { todos?: string[]; status?: string; owner?: string }): string {
  const o = currentStep(t)?.owner || t.owner || '';
  return o && o !== '신종호' && o !== '김지영' && o !== '전체' ? o : '고객';
}

export default function OfficeBoardView() {
  const [office, setOffice] = useState<Office | null>(null);
  const [money, setMoney] = useState<Money | null>(null);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState<'all' | 'jh' | 'jy' | 'out'>('all');
  const [cat, setCat] = useState<'all' | '대행' | '도구' | '리서치' | '자체사업' | '내부'>('all');
  const [view, setView] = useState<'board' | 'cal'>('board'); // 칸반 ↔ 캘린더 뷰
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; }); // 캘린더 보이는 달
  useEffect(() => { try { const c = localStorage.getItem('qb-cat'); if (c) setCat(c as typeof cat); } catch { /**/ } }, []); // 새로고침 유지
  useEffect(() => { try { localStorage.setItem('qb-cat', cat); } catch { /**/ } }, [cat]);
  useEffect(() => { try { const v = localStorage.getItem('qb-view'); if (v === 'cal' || v === 'board') setView(v); } catch { /**/ } }, []); // 뷰 유지
  useEffect(() => { try { localStorage.setItem('qb-view', view); } catch { /**/ } }, [view]);
  useEffect(() => { // PC: ESC로 모달 닫기
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSel(null); setMoneyList(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const [moneyList, setMoneyList] = useState<'rev' | 'due' | 'fixed' | 'util' | 'expense' | null>(null); // 스코어카드 클릭→목록
  const [editingContract, setEditingContract] = useState<{ 계약명: string; 계약금액: number; 입금액: string; 입금일: string; 입금상태: string } | null>(null);
  // 정산(매출·지출 내역)은 정산 탭으로 통일 — 관련 state 제거
  const [sel, setSel] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState<Record<string, Partial<Task>>>({}); // 낙관적 덮어쓰기(서버 반영 전 즉시 화면)
  type ArcItem = { project: string; task: string; owner: string; client: string; status: string; date: string; kind: string };
  const [arc, setArc] = useState<ArcItem[] | null>(null);
  const [showArc, setShowArc] = useState(false);
  const [edit, setEdit] = useState({ 고객: '', 프로젝트: '', 과업명: '' });
  const [showEdit, setShowEdit] = useState(false);
  const [showMoney, setShowMoney] = useState(false);
  const [mForm, setMForm] = useState({ 종류: '매출', 금액: '', 입금상태: '입금대기', 계약일: '', 마감일: '', 시작월: '', 종료월: '' });
  const [newStep, setNewStep] = useState('');
  const [memoVal, setMemoVal] = useState(''); // 📝 메모(현재 정리·링크)
  const [showHist, setShowHist] = useState(false); // 🕘 이력 아코디언
  const [docEdit, setDocEdit] = useState(false); // 📄 문서 읽기/편집
  const [openSec, setOpenSec] = useState<number | null>(null); // 리서치 섹션 펼침
  const [showDone, setShowDone] = useState(false); // 문서형: 완료 단계 접기
  const [editStepIdx, setEditStepIdx] = useState<number | null>(null);
  const [editStepVal, setEditStepVal] = useState('');
  const [dateStepIdx, setDateStepIdx] = useState<number | null>(null); // 📅 클릭=인라인 날짜박스 열린 단계
  const [dateStart, setDateStart] = useState(''); // 날짜박스 시작일(YYYY-MM-DD)
  const [dateEnd, setDateEnd] = useState('');     // 날짜박스 마감일(YYYY-MM-DD)

  const [qa, setQa] = useState(''); // 받은일/처리 빠른추가 입력(단건)
  const [qaBusy, setQaBusy] = useState(false);
  const quickAdd = async (ball: string) => {
    const txt = qa.trim();
    if (!txt || qaBusy) return;
    setQaBusy(true);
    try {
      const r = await fetch('/api/office/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task: txt, ball, owner: '전체', 출처: '단건할일' }) }); // 담당=전체(종호·지영 둘 다 봄), 출처 태그로 매출 프로젝트 아카이브 집계에서 제외(archive.ts)
      const j = await r.json();
      if (j.ok) { setQa(''); load(true); } else alert(j.error || '추가 실패'); // fresh=1 로 즉시 반영(캐시 인스턴스 지연 방지) — 새 프로젝트와 동일
    } catch (e) { alert(String(e)); } finally { setQaBusy(false); }
  };
  // 웹 새 프로젝트 등록 — 프로젝트명+과업(첫 할일)+마감+담당 → 작업(내작업) 칸에 카드 1개
  const [showNP, setShowNP] = useState(false);
  const [np, setNP] = useState({ name: '', task: '', due: '', owner: '신종호', client: '' });
  const [npBusy, setNPBusy] = useState(false);
  const [npMsg, setNPMsg] = useState<{ ok: boolean; text: string } | null>(null); // 등록 성공/실패를 눈에 보이게(조용히 사라짐 방지)
  const addProject = async () => {
    const name = np.name.trim();
    if (!name || npBusy) return;
    setNPBusy(true); setNPMsg(null);
    try {
      const client = np.client.trim();
      const 과업 = np.task.trim(); // 첫 과업 = 할일 로그 맨 앞(카드 헤드라인). 비우면 프로젝트명이 과업명 대신.
      const r = await fetch('/api/office/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project: name, task: 과업 || name, 할일: 과업, owner: np.owner, ball: '내작업', due: np.due, customer: client, money: client ? '매출' : '투자', 출처: '웹새프로젝트' }) });
      const j = await r.json().catch(() => ({ ok: false, error: '서버 응답을 못 읽었어요' }));
      if (j.ok) {
        setNP({ name: '', task: '', due: '', owner: np.owner, client: '' }); // 폼은 열어둠 — 성공 표시 보이고 연속 등록 가능
        setNPMsg({ ok: true, text: `✅ '${name}' 작업 칸에 등록됐어요` });
        load(true); setTimeout(() => load(true), 1500); // 반영 지연 백스톱 — 캐시로 카드가 늦게 뜨는 것 방지
      } else {
        setNPMsg({ ok: false, text: `⚠️ 등록 실패 — ${j.error || '시트 저장이 안 됐어요'}. 입력값 그대로 두었으니 다시 눌러주세요.` });
      }
    } catch (e) {
      setNPMsg({ ok: false, text: `⚠️ 등록 실패 — ${String(e)}. 입력값 그대로 두었으니 다시 시도하세요.` });
    } finally { setNPBusy(false); }
  };
  const load = useCallback((fresh = false) => {
    fetch(fresh ? '/api/office?fresh=1' : '/api/office').then((r) => r.json()).then((j) => {
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
  // 깃 토픽 프로젝트 비동기 로드(사무실 초기 렌더 안 막음). 진행 중인 것만, 시트에 이미 있는 건(저장소 키) 제외하고 합친다.
  useEffect(() => {
  }, []);
  // 패널 열 때 수정 입력칸 초기화(고객=실제 고객만, 프로젝트=프로젝트명, 과업명=자리표시 제외)
  useEffect(() => {
    if (sel) {
      setEdit({
        고객: sel.client && sel.client !== sel.project ? sel.client : '',
        프로젝트: sel.project || '',
        과업명: (sel.task && sel.task !== '(프로젝트 등록)') ? sel.task : '',
      });
      setShowEdit(false); setShowMoney(false); setEditStepIdx(null); setDateStepIdx(null);
      setMemoVal(sel.memo || ''); setShowHist(false); setDocEdit(false); setOpenSec(null); setShowDone(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.id]);

  const patch = (id: string, body: Record<string, unknown>) => {
    const p = (body as { patch?: Record<string, string> }).patch;
    if (p) setOver((o) => ({ ...o, [id]: { ...o[id], ...toOver(p) } })); // 즉시 화면
    setSel(null);
    fetch('/api/office/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) }).then(() => load(true)).catch(() => load(true));
  };
  // 드래그로 공위치 변경 — 카드를 칸에 끌어 놓으면 그 칸의 공위치로 patch
  const [dragId, setDragId] = useState<string | null>(null);
  const dragStart = (id: string) => (e: React.DragEvent) => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; setDragId(id); };
  const dropTo = (공위치: string) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain') || dragId; setDragId(null); if (id) patch(id, { patch: { 공위치 } }); },
  });
  const complete = (id: string) => {
    setOver((o) => ({ ...o, [id]: { ...o[id], ball: 'done' } })); // 완수=보드서 즉시 사라짐
    setSel(null);
    fetch('/api/office/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).then(() => load(true)).catch(() => load(true));
  };
  // 폐기(접기) — 완수와 같은 아카이브 이동이지만 사유=폐기로 구분(부활 안 함). 되돌리려면 아카이브에서 복구.
  const discard = (id: string, name: string) => {
    if (!confirm(`"${name}" 프로젝트를 폐기(접기)할까요?\n보드에서 사라지고 아카이브로 갑니다. (완수와 달리 '폐기'로 기록)`)) return;
    setOver((o) => ({ ...o, [id]: { ...o[id], ball: 'done' } }));
    setSel(null);
    fetch('/api/office/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, 사유: '폐기(접음)' }) }).then(() => load(true)).catch(() => load(true));
  };
  const saveEdit = () => sel && patch(sel.id, { patch: { 고객: edit.고객, 프로젝트: edit.프로젝트 } });
  const saveMemo = () => { // 메모는 패널 닫지 않고 저장(현재 정리 갱신)
    if (!sel) return;
    const v = memoVal;
    setSel({ ...sel, memo: v });
    setOver((o) => ({ ...o, [sel.id]: { ...o[sel.id], memo: v } }));
    fetch('/api/office/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sel.id, patch: { 메모: v } }) }).then(() => load(true)).catch(() => load(true));
  };
  const saveContract = () => {
    if (!sel || !mForm.금액.trim()) return;
    const body = { 종류: mForm.종류, 계약명: sel.project, 클라이언트: (sel.client && sel.client !== sel.project) ? sel.client : '', 금액: mForm.금액, 입금상태: mForm.입금상태, 계약일: mForm.계약일, 마감일: mForm.마감일, 시작월: mForm.시작월, 종료월: mForm.종료월 };
    setShowMoney(false); setMForm({ 종류: '매출', 금액: '', 입금상태: '입금대기', 계약일: '', 마감일: '', 시작월: '', 종료월: '' });
    fetch('/api/office/contract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(() => load(true)).catch(() => load(true));
  };
  // 여정 단계 — 완료/되돌림·추가. 패널 유지(setSel 안 닫음)하고 새로고침해 이력·단계 갱신.
  const stepPost = (id: string, todos: string[], 내용: string) => { // 시트는 백그라운드 저장(over로 보드 즉시 반영, load 안 함=무플래시)
    fetch('/api/office/step', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, 할일: todos.join(';'), 내용 }) }).catch(() => null);
  };
  const optimistic = (t: Task, todos: string[], 내용: string) => { // 패널 + 보드(over) 동시 즉시 반영 — 체크·되돌리기 둘 다
    setSel({ ...t, todos, history: [{ when: '방금', what: 내용 }, ...(t.history || [])] });
    setOver((o) => ({ ...o, [t.id]: { ...o[t.id], todos } }));
  };
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
    const d = new Date(); // 날짜(@) 안 적으면 오늘로
    const withDate = /@\s*\d{1,2}\/\d{1,2}/.test(txt) ? txt : `${txt} @${d.getMonth() + 1}/${d.getDate()}`;
    const todos = [...effTodos(t), withDate];
    const 내용 = `+ "${txt.replace(/@.*$/, '').trim()}" 추가`;
    optimistic(t, todos, 내용); stepPost(t.id, todos, 내용);
  };
  const startEditStep = (i: number, st: { text: string; date: string; start?: string; owner: string }) => { setEditStepIdx(i); setEditStepVal((st.owner ? `@${st.owner} ` : '') + st.text + dateToken(st)); };
  const saveStepEdit = (t: Task, i: number) => {
    const v = editStepVal.trim(); if (!v) return;
    const todos = [...effTodos(t)]; const wasDone = parseStep(todos[i]).done;
    todos[i] = (wasDone ? '✓' : '') + v; setEditStepIdx(null);
    const 내용 = `✎ 단계 수정: "${v.replace(/@.*$/, '').trim()}"`;
    optimistic(t, todos, 내용); stepPost(t.id, todos, 내용);
  };
  // 📅 칩 클릭 → 그 단계의 인라인 날짜박스 토글. 현재 시작/마감을 date input 값(YYYY-MM-DD)으로 채운다.
  const openDateBox = (i: number, st: { date: string; start?: string }) => {
    if (dateStepIdx === i) { setDateStepIdx(null); return; }
    setDateStepIdx(i);
    setDateStart(st.start ? mdToYmd(st.start) : '');
    setDateEnd(st.date ? mdToYmd(st.date) : '');
  };
  // 날짜박스 저장 — 단계 날짜 토큰을 재조립(시작~마감/마감만/없음)해 기존 단계저장 경로로 보냄.
  const saveDate = (t: Task, i: number) => {
    const todos = [...effTodos(t)]; const st = parseStep(todos[i]);
    const start = ymdToMd(dateStart), end = ymdToMd(dateEnd);
    // 마감 없으면 날짜 토큰 제거(=지우기). 시작만 있고 마감 없으면 시작을 마감으로 승격.
    const nextDate = end || start; const nextStart = end ? (start && start !== end ? start : '') : '';
    const body = (st.owner ? `@${st.owner} ` : '') + st.text + dateToken({ date: nextDate, start: nextStart });
    todos[i] = (st.done ? '✓' : '') + body; setDateStepIdx(null);
    const 내용 = nextDate ? `📅 "${st.text}" 날짜 ${nextStart ? nextStart + '~' : ''}${nextDate}` : `📅 "${st.text}" 날짜 지움`;
    optimistic(t, todos, 내용); stepPost(t.id, todos, 내용);
  };
  // 날짜 지우기 — 그 단계 날짜 토큰 제거.
  const clearDate = (t: Task, i: number) => {
    const todos = [...effTodos(t)]; const st = parseStep(todos[i]);
    const body = (st.owner ? `@${st.owner} ` : '') + st.text; // 날짜 토큰 없이 재조립
    todos[i] = (st.done ? '✓' : '') + body; setDateStepIdx(null);
    const 내용 = `📅 "${st.text}" 날짜 지움`;
    optimistic(t, todos, 내용); stepPost(t.id, todos, 내용);
  };
  const delStep = (t: Task, i: number) => {
    const todos = [...effTodos(t)]; const st = parseStep(todos[i]);
    todos.splice(i, 1); setEditStepIdx(null);
    const 내용 = `🗑 "${st.text}" 삭제`;
    optimistic(t, todos, 내용); stepPost(t.id, todos, 내용);
  };
  // 단계 담당 지정(드롭다운) — '' 상속(카드담당), 신종호/김지영 내부, '__외주__' 선택 시 이름 입력, 기존 외주명 유지
  const setStepOwner = (t: Task, i: number, val: string) => {
    const todos = [...effTodos(t)]; const st = parseStep(todos[i]);
    let next = val;
    if (val === '__외주__') next = (prompt('외주사 이름 (공백 없이)') || '').trim().replace(/\s+/g, ''); // 취소·빈값이면 상속
    if (next === st.owner) return; // 변화 없음
    const body = (next ? `@${next} ` : '') + st.text + dateToken(st);
    todos[i] = (st.done ? '✓' : '') + body;
    const lbl = next ? (WHO[next] || `🤝 ${next}`) : '담당 해제(카드 담당 상속)';
    const 내용 = `👤 "${st.text}" → ${lbl}`;
    optimistic(t, todos, 내용); stepPost(t.id, todos, 내용);
  };

  if (err && !office) return <ErrorBox msg={err} />; // 캐시(office) 있으면 에러여도 화면 유지
  if (!office) return <Loading text="관제탑 불러오는 중" />;

  const all: Task[] = [
    ...(office.rooms || []).flatMap((r) => r.tasks),
    ...(office.자체 || []),
    ...(office.언젠가 || []),
  ].map((t) => (over[t.id] ? { ...t, ...over[t.id] } : t)); // 낙관적 덮어쓰기 적용
  // 외주 명단 = 지금 보드에 이미 박힌 외주 이름들(카드 담당 + 단계 담당, 내부 제외). 한 번 쓴 외주는 모든 카드 드롭다운에 뜸.
  const vendors = [...new Set(
    all.flatMap((t) => [t.owner, ...effTodos(t).map((s) => parseStep(s).owner)])
       .filter((o) => o && o !== '신종호' && o !== '김지영' && o !== '전체')
  )].sort();
  // 담당자(역할) 필터 — 카드 담당 + 단계 담당 모두 본다(준엽처럼 단계만 외주여도 외주 필터에 잡히게)
  const vis = all.filter((t) => {
    if (filter === 'all') return true;
    const owners = [t.owner || '신종호', ...effTodos(t).map((s) => parseStep(s).owner).filter(Boolean)];
    if (filter === 'jh') return owners.includes('신종호') || owners.includes('전체'); // 전체=둘 다 봄
    if (filter === 'jy') return owners.includes('김지영') || owners.includes('전체');
    return owners.some((o) => o !== '신종호' && o !== '김지영' && o !== '전체'); // 외주
  });
  // 도구(판매 도구)는 과업 보드가 아니라 아래 도구 백로그로 빠짐. 나머지는 공위치대로 7칸.
  // 보드 = 대행+내부+자체사업 전 공위치(보류·예정 포함 — 활성만 올리면 보류로 옮긴 카드가 '실종'됨). 도구·리서치만 포트폴리오 섹션 전용.
  const board = cat === 'all'
    ? vis.filter((t) => { const c = t.category || ''; return c !== '도구' && c !== '리서치'; })
    : vis.filter((t) => (t.category || '') === cat);
  // 캘린더 항목 = 보이는 과업(board)의 미완료·날짜 있는 단계 전부를 펼침. start&end=기간막대, end만=◆칩.
  type CalItem = { task: Task; proj: string; text: string; owner: string; start: string; end: string };
  const calItems: CalItem[] = board.flatMap((t) => effTodos(t).map(parseStep)
    .filter((s) => !s.done && s.date)
    .map((s) => ({
      task: t, proj: t.project || t.task || '', text: s.text,
      owner: (s.owner || t.owner || '신종호'),
      start: s.start ? mdToYmd(s.start) : '', end: mdToYmd(s.date), // YYYY-MM-DD로 통일
    }))
    .filter((c) => c.end)); // 마감 파싱 실패는 제외
  const 리서치들 = all.filter((t) => (t.category || '') === '리서치');
  const 자체사업들 = all.filter((t) => (t.category || '') === '자체사업');
  const 도구들 = all.filter((t) => (t.category || '') === '도구');
  // (깃 자동 섹션 폐기 — 깃 프로젝트는 크론 git-sync가 시트에 직접 등록해 위 보드로 통일됨)
  const byDday = (a: Task, b: Task) => (cardDday(a) ?? 9999) - (cardDday(b) ?? 9999); // 카드가 보여주는 D-day(단계날짜 우선) 임박순
  const inbox = board.filter((t) => t.ball === 'inbox' || t.ball === 'unset').sort(byDday); // 빈 공위치(미정)도 받은일 바구니로(office.ts 규칙) — 빠른추가가 공위치 빈칸으로 저장하므로
  const proc = board.filter((t) => t.ball === 'myreply').sort(byDday);
  const work = board.filter((t) => t.ball === 'mywork').sort(byDday);
  const wait = board.filter((t) => t.ball === 'client').sort(byDday);
  const todo = board.filter((t) => t.ball === 'start').sort(byDday); // 예정 = 시작전 전부(날짜 있는 것 먼저, 없는 건 뒤) — 언젠가 통합
  const hold = board.filter((t) => t.ball === 'hold').sort(byDday);
  const ACTIVE_SET = new Set(['inbox', 'mywork', 'myreply', 'client']); // 가동률=지금 움직이는 공만. 보류(hold)=멈춤이라 '진행 중' 계수에서 제외
  const SHOW_CATS = ['대행', '자체사업', '내부', '리서치'] as const;
  // 활성 과업 중 카테고리별 고유 프로젝트 수
  const catProjects = Object.fromEntries(SHOW_CATS.map((k) => [
    k, [...new Set(all.filter((t) => ACTIVE_SET.has(t.ball) && (t.category || '') === k).map((t) => t.project || t.id))],
  ]));
  const 가동 = SHOW_CATS.map((k) => catProjects[k].length > 0 ? `${CAT[k].e}${catProjects[k].length}` : null).filter(Boolean).join(' · ') || '–';
  const cur = sel; // 패널은 sel 직접 사용 — 단계/이력은 낙관적 업데이트로 즉시 반영(캐시 지연 우회)

  // 통일 카드: [고객사 · 프로젝트명](프로젝트명 굵게) 한 줄 + 과업 크게(1~2줄). 작업·대기 같은 순서.
  // 대기에선 "지금 기다리는 상황(현재상태)"이 곧 과업 → 그걸 메인 텍스트로. 그 외엔 과업명.
  // 프로젝트=과업. 큰 글씨 = 지금 할 일(현재 단계) → 없으면 현재상태 → 그것도 없으면 프로젝트.
  // "진행 중" 류 빈 껍데기 상태 — 단계·대표글로 쓰지 않음(카드가 "진행 중"만 뜨는 것 방지)
  const NOISE = new Set(['진행 중', '진행중', '착수 예정', '(프로젝트 등록)', '진행', '']);
  const bigTask = (t: Task) => {
    const cur = currentStep(t); // 가장 이른 미완료 = 지금 할 일
    if (cur && !NOISE.has(cur.text.trim())) return cur.text; // 진짜 단계/상태면 그걸로
    // 빈 껍데기 → '마지막으로 한 일' → 과업명 → 프로젝트명. 고객대기면 "→ 대기중" 꼬리.
    const done = effTodos(t).map(parseStep).filter((s) => s.done);
    if (done.length) {
      const lastDone = [...done].sort((a, b) => (a.date ? (stepDday(a.date) ?? -1e9) : -1e9) - (b.date ? (stepDday(b.date) ?? -1e9) : -1e9)).pop()!;
      return t.ball === 'client' ? `${lastDone.text} → 대기중` : lastDone.text;
    }
    const task = t.task && t.task !== '(프로젝트 등록)' ? t.task : '';
    return task || '(다음 과업 정하기)'; // 프로젝트명을 큰글씨로 쓰면 윗줄(고객·프로젝트)이 사라져 3층 구조가 무너짐 — 과업 없으면 채우라고 표시
  };
  const Card = (t: Task) => {
    const cli = t.client && t.client !== t.project ? t.client : '';
    const big = bigTask(t);
    const showProj = big !== t.project; // 큰글씨가 프로젝트면 윗줄에 또 안 씀
    const cat = CAT[t.category || '']; // 분류 색·이모지
    return (
    <div key={t.id} draggable onDragStart={dragStart(t.id)} className={`tkt${(cardDday(t) ?? 99) <= 3 ? ' urgent' : ''}${sel?.id === t.id ? ' sel' : ''}`} onClick={() => setSel(t)}>
      <div className="ic">{t.ball === 'client' ? '🚪' : t.ball === 'myreply' ? '🧾' : '🖥️'}</div>
      <div className="tbody">
        {/* 윗줄 고정 양식: [고객사 뱃지(없으면 자체)] + 파란 프로젝트명 — 고객사·프로젝트가 항상 구분돼 보이게 */}
        <div className="cli-proj"><span className={`clibadge${cli ? '' : ' own'}`}>{cli || '자체'}</span>{showProj && <span className="proj">{cat ? cat.e + ' ' : ''}{t.project}</span>}</div>
        <div className="task-big">{big}</div>
      </div>
      {t.owner && t.owner !== '신종호' && (WHO[t.owner]
        ? <span className="who-bdg">{WHO[t.owner]}</span>
        : <span className="who-bdg outsrc">🤝 외주 · {t.owner}</span>)}
      {t.ball === 'client' && <span className="waitfor">🟣 {waitOn(t)}</span>}
      {(() => {
        const dd = cardDday(t); // 단계날짜 우선, 없으면 과업기한
        return dd != null ? <span className={`bdg${dd <= 7 ? ' soon' : ''}`}>{ddText(dd)}</span> : null;
      })()}
    </div>
    );
  };
  const Empty = () => <div className="empty">— 없음 —</div>;

  // 사무실 캘린더뷰 — 시안의 주별 grid 로직 그대로. 막대(기간)·◆칩(마감만). 클릭=그 프로젝트 패널.
  const CalView = () => {
    const { y: Y, m: M } = calMonth;
    const today = new Date(); const TODAY = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const first = new Date(Y, M, 1), startDow = first.getDay(), dim = new Date(Y, M + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= dim; d++) cells.push(d);
    while (cells.length % 7) cells.push(null);
    const ymd = (d: number) => `${Y}-${String(M + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const weeks: (number | null)[][] = [];
    for (let w = 0; w < cells.length / 7; w++) weeks.push(cells.slice(w * 7, w * 7 + 7));
    const step = (dir: number) => { let m = M + dir, yy = Y; if (m < 0) { m = 11; yy--; } if (m > 11) { m = 0; yy++; } setCalMonth({ y: yy, m }); };
    return (
      <div className="calwrap">
        <div className="monthnav">
          <span className="mbtn" onClick={() => step(-1)}>◀</span><b>{Y}년 {M + 1}월</b><span className="mbtn" onClick={() => step(1)}>▶</span>
          <span className="todaybtn" onClick={() => setCalMonth({ y: today.getFullYear(), m: today.getMonth() })}>오늘</span>
          <div className="legend">
            <span><span className="dot" style={{ background: '#4a6fd6' }} />신종호</span>
            <span><span className="dot" style={{ background: '#c95f8a' }} />지영</span>
            <span><span className="dot" style={{ background: '#7a8296' }} />외주</span>
            <span><span className="dot" style={{ background: '#fff', border: '1px dashed #9aa0b8' }} />◆ 마감일만</span>
          </div>
        </div>
        <div className="cal">
          <div className="dow"><span className="sun">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span className="sat">토</span></div>
          {weeks.map((week, w) => {
            const wDates = week.map((d) => d ? ymd(d) : null);
            const wFirst = wDates.find(Boolean) as string, wLast = [...wDates].reverse().find(Boolean) as string;
            // 이 주에 걸치는 항목을 칸 구간(s~e)으로 변환
            type Slot = { ci: number; c: CalItem; s: number; e: number; due: boolean; contL: boolean; contR: boolean; row: number };
            const items: Slot[] = [];
            calItems.forEach((c, ci) => {
              if (!c.start) { // 마감만 → ◆ 칩
                const idx = wDates.indexOf(c.end);
                if (idx >= 0) items.push({ ci, c, s: idx, e: idx, due: true, contL: false, contR: false, row: 0 });
                return;
              }
              if (c.end < wFirst || c.start > wLast) return; // 이 주와 안 겹침
              const s = Math.max(0, wDates.findIndex((x) => x && x >= c.start));
              let e = 6; for (let i = 6; i >= 0; i--) { const x = wDates[i]; if (x && x <= c.end) { e = i; break; } }
              items.push({ ci, c, s, e, due: false, contL: c.start < wFirst, contR: c.end > wLast, row: 0 });
            });
            // 겹치지 않게 행 배정(구간 그래프) — 같은 칸을 쓰는 항목은 다음 행으로. 주 높이는 필요한 행 수만큼 늘려 다음 주 침범·클릭막힘 방지.
            const rowOcc: [number, number][][] = [];
            items.forEach((it) => {
              let r = 0;
              while ((rowOcc[r] || (rowOcc[r] = [])).some(([os, oe]) => !(it.e < os || it.s > oe))) r++;
              rowOcc[r].push([it.s, it.e]); it.row = r;
            });
            const minH = Math.max(124, 36 + rowOcc.length * 26 + 8); // 빈 주도 넉넉히(위아래 크게)
            return (
              <div key={w} className="week">
                <div className="days" style={{ minHeight: minH }}>
                  {week.map((d, i) => {
                    const cls = ['day', i === 0 && 'sun', i === 6 && 'sat', !d && 'out', d && ymd(d) === TODAY && 'today'].filter(Boolean).join(' ');
                    return <div key={i} className={cls}>{d ? <span className="n">{d}</span> : ''}</div>;
                  })}
                </div>
                <div className="bars">
                  {items.map((it) => it.due
                    ? <div key={it.ci} className="due" title={`${it.c.proj} — ${it.c.text}`} style={{ gridColumn: `${it.s + 1}/span 1`, gridRow: it.row + 1, pointerEvents: 'auto', cursor: 'pointer' }} onClick={() => setSel(it.c.task)}>{it.c.proj} — {it.c.text}</div>
                    : <div key={it.ci} className={`bar${it.contL ? ' contL' : ''}${it.contR ? ' contR' : ''}`} title={`${it.c.proj} — ${it.c.text}`} style={{ gridColumn: `${it.s + 1}/span ${it.e - it.s + 1}`, gridRow: it.row + 1, background: OWNER_COLOR(it.c.owner), pointerEvents: 'auto', cursor: 'pointer' }} onClick={() => setSel(it.c.task)}>{it.c.proj} — {it.c.text}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={`qb${dragId ? ' dragging' : ''}`} onDragEnd={() => setDragId(null)}>
      <style>{CSS}</style>
      {/* 스코어카드(누계·미수·고정비·가동률)는 유지 — 매출 숫자는 정산 탭과 동일(입금 기준). 정산'내역' 모달만 정산 탭으로 통일 */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="glass rounded-2xl p-4 cursor-pointer hover:ring-2 hover:ring-emerald-200 transition" onClick={() => setMoneyList('rev')}><div className="text-xs text-slate-500 mb-1">순매출 누계 <span className="text-slate-300">▸</span></div><div className="text-2xl font-bold text-emerald-600">{won(money?.순매출누계 ?? 0)}</div><div className="text-[11px] text-slate-400 mt-1">실입금 기준 · 클릭=목록</div></div>
        <div className="glass rounded-2xl p-4 cursor-pointer hover:ring-2 hover:ring-rose-200 transition" onClick={() => setMoneyList('due')}><div className="text-xs text-slate-500 mb-1">미수금 ● <span className="text-slate-300">▸</span></div><div className="text-2xl font-bold text-rose-600">{won(money?.미수금합 ?? 0)}</div><div className="text-[11px] text-slate-400 mt-1">계약금액 − 입금액 · 클릭=목록</div></div>
        <div className="glass rounded-2xl p-4 cursor-pointer hover:ring-2 hover:ring-slate-200 transition" onClick={() => setMoneyList('fixed')}><div className="text-xs text-slate-500 mb-1">월 고정비 <span className="text-slate-300">▸</span></div><div className="text-2xl font-bold text-slate-700">{won(money?.고정비월합 ?? 0)}</div><div className="text-[11px] text-slate-400 mt-1">매달 나가는 돈 · 클릭=목록</div></div>
        <div className="glass rounded-2xl p-4 cursor-pointer hover:ring-2 hover:ring-slate-200 transition" onClick={() => setMoneyList('util')}><div className="text-xs text-slate-500 mb-1">가동률 (프로젝트) <span className="text-slate-300">▸</span></div><div className="text-xl font-bold text-slate-800">{가동}</div><div className="text-[11px] text-slate-400 mt-1">대행·자체사업·내부·리서치 · 클릭=목록</div></div>
      </section>
      <p className="note0">실시간 업무 현황 — 받은일 · 처리 · 작업 · 대기 · 예정 · 언젠가 · 제품 {office.source === 'sheet' ? `· ✓ ${office.syncedAt} 기준` : office.source === 'seed' ? '· ⚠️ 미리보기 시드' : ''}</p>
      <div className="filters">
        {([['all', '전체'], ['jh', '🧑‍💼 신종호'], ['jy', '🎨 김지영'], ['out', '🤝 외주']] as const).map(([k, lb]) => (
          <div key={k} className={`chip${filter === k ? ' on' : ''}`} onClick={() => setFilter(k)}>{lb}</div>
        ))}
        <div className="viewtoggle"><span className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>칸반</span><span className={view === 'cal' ? 'on' : ''} onClick={() => setView('cal')}>캘린더</span></div>
      </div>
      <div className="filters" style={{ marginTop: -6 }}>
        <div className={`chip${cat === 'all' ? ' on' : ''}`} onClick={() => setCat('all')}>전체 분류</div>
        {(['대행', '도구', '리서치', '자체사업', '내부'] as const).map((k) => (
          <div key={k} className="chip" style={cat === k ? { background: CAT[k].c, borderColor: CAT[k].c, color: '#fff' } : { color: CAT[k].c }} onClick={() => setCat(cat === k ? 'all' : k)}>{CAT[k].e} {k}</div>
        ))}
        <button className="npbtn" onClick={() => { setShowNP((v) => !v); setNPMsg(null); }}>{showNP ? '✕ 닫기' : '+ 새 프로젝트'}</button>
      </div>
      {showNP && (
        <div className="npform">
            <input autoFocus value={np.name} onChange={(e) => setNP({ ...np, name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) addProject(); }} placeholder="프로젝트명" />
            <input value={np.task} onChange={(e) => setNP({ ...np, task: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) addProject(); }} placeholder="과업 (첫 할일 · 선택)" />
            <input className="npcli" value={np.client} onChange={(e) => setNP({ ...np, client: e.target.value })} placeholder="고객사 (자체면 비움)" />
            <label className="nplbl">마감<input type="date" value={np.due} onChange={(e) => setNP({ ...np, due: e.target.value })} /></label>
            <select value={np.owner} onChange={(e) => setNP({ ...np, owner: e.target.value })}><option value="신종호">담당 신종호</option><option value="김지영">담당 김지영</option></select>
            <button className="npok" disabled={npBusy || !np.name.trim()} onClick={addProject}>{npBusy ? '등록 중…' : '작업에 등록'}</button>
            {npMsg && <div className={`npmsg ${npMsg.ok ? 'ok' : 'err'}`}>{npMsg.text}</div>}
        </div>
      )}

      {view === 'cal' && <div className="room" style={{ padding: 0, overflow: 'hidden' }}><CalView /></div>}

      {view === 'board' && (<>
      <div className="board">
        {/* 단건 할 일 — 프로젝트로 만들 것 없는 잔일을 적어두고 ✓로 끝내는 칸(입력+완수만, 심플) */}
        <section className="room inbox-room" {...dropTo('받은일')}><div className="rh">✍️ 단건 할 일 <span className={`cnt${inbox.length ? ' red' : ''}`}>{inbox.length}</span><span className="hint">적어두고 끝나면 ✓</span></div>
          <div className="qa">
            <input value={qa} onChange={(e) => setQa(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) quickAdd('받은일'); }} placeholder="+ 할 일 한 줄… (Enter=추가)" disabled={qaBusy} />
          </div>
          <div className="tkts">{inbox.length ? inbox.map((t) => (
            <div key={t.id} className="smalltk" onClick={() => setSel(t)} style={{ cursor: 'pointer' }}>
              <button onClick={(e) => { e.stopPropagation(); complete(t.id); }} title="완수 처리"
                style={{ width: 24, height: 24, borderRadius: 6, border: '1.5px solid #d5d9e3', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#16a34a', flexShrink: 0, lineHeight: 1 }}>✓</button>
              <div><div className="task">{t.task || t.project}</div>{t.due ? <div className="c">{t.due}</div> : null}</div>
            </div>
          )) : <div className="empty">비움</div>}</div></section>
        <section className="room proc" {...dropTo('내회신')}><div className="rh">🧾 처리 <span className="cnt">{proc.length}</span><span className="hint">영업·연락·결재</span></div>
          <div className="tkts">{proc.length ? proc.map(Card) : <Empty />}</div></section>
      </div>

      <section className="room work" style={{ marginTop: 14 }} {...dropTo('내작업')}><div className="rh">🖥️ 작업 <span className="cnt">{work.length}</span><span className="hint">제작·디자인</span></div>
        <div className="rowwrap">{work.length ? work.map(Card) : <Empty />}</div></section>

      <section className="room wait" style={{ marginTop: 14 }} {...dropTo('고객대기')}><div className="rh">🚪 대기 <span className="cnt">{wait.length}</span><span className="hint">상대 답·결과 기다림</span></div>
        <div className="rowwrap">{wait.length ? wait.map(Card) : <Empty />}</div></section>

      <div className="board">
        <section className="room todo" {...dropTo('시작전')}><div className="rh">📅 예정 <span className="cnt">{todo.length}</span><span className="hint">시작 전(날짜 있으면 임박순)</span></div>
          {todo.length ? todo.map((t) => <div key={t.id} draggable onDragStart={dragStart(t.id)} className="smalltk" onClick={() => setSel(t)}><span>📅</span><div><div className="task">{t.project}</div><div className="c">{t.dday != null ? ddText(t.dday) + ' · ' : ''}{t.task || t.client || '날짜 미정'}</div></div></div>) : <Empty />}</section>
        <section className="room hold" {...dropTo('보류')}><div className="rh">⏸️ 보류 <span className="cnt">{hold.length}</span><span className="hint">멈춤</span></div>
          {hold.length ? hold.map((t) => <div key={t.id} draggable onDragStart={dragStart(t.id)} className="smalltk" onClick={() => setSel(t)}><span>⏸️</span><div><div className="task">{t.project}</div><div className="c">{t.status || t.task}</div></div></div>) : <Empty />}</section>
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
      </>)}

      {/* 아카이브 — 완수·폐기 프로젝트(접이식, 열 때 온디맨드 로드) */}
      <div className="arcwrap">
        <button className="arctoggle" onClick={() => { const n = !showArc; setShowArc(n); if (n && arc === null) fetch('/api/office/archive').then((r) => r.json()).then((j) => setArc(j.ok ? j.items : [])).catch(() => setArc([])); }}>
          📦 아카이브 (완수·폐기) {showArc ? '▲' : '▼'}
        </button>
        {showArc && (arc === null ? <div className="arcload">불러오는 중…</div> : (() => {
          const done = arc.filter((a) => a.kind === 'done');
          const disc = arc.filter((a) => a.kind === 'discard');
          const Row = (a: ArcItem, i: number) => (
            <div key={i} className="arcrow"><span className="arcnm">{a.project || a.task}</span>{a.client && a.client !== a.project && <span className="arccli">{a.client}</span>}{a.owner && a.owner !== '신종호' && <span className="arcown">{a.owner}</span>}<span className="arcdate">{a.date}</span></div>
          );
          return (<div className="arcbody">
            <div className="arccol"><div className="arch">✅ 완수 <span className="arccnt">{done.length}</span></div>{done.length ? done.map(Row) : <div className="arcempty">없음</div>}</div>
            <div className="arccol"><div className="arch">🗑 폐기(접음) <span className="arccnt">{disc.length}</span></div>{disc.length ? disc.map(Row) : <div className="arcempty">없음</div>}</div>
          </div>);
        })())}
      </div>

      {moneyList && (() => {
        if (moneyList === 'fixed') {
          const fl = money?.고정비목록 || [];
          return (<>
            <div className="ovl" onClick={() => setMoneyList(null)} />
            <aside className="panel">
              <div className="ph"><button className="pclose" onClick={() => setMoneyList(null)}>✕</button>
                <div className="pproj">🏦 월 고정비 <span style={{ fontSize: 13, color: '#9298ac', fontWeight: 500 }}>{fl.length}항목</span></div>
                <div className="pmeta">매달 고정으로 나가는 비용</div>
              </div>
              <div className="pbody">
                {fl.length === 0 ? <div className="empty">없음</div> : fl.map((f, i) => (
                  <div key={i} className="mli">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mli-t">{f.항목}</div>
                      <div className="mli-s">{f.종류}{f.납부일 ? ' · 매월 ' + f.납부일 + '일' : ''}</div>
                    </div>
                    <div className="mli-r">
                      <span className="mli-amt" style={{ color: '#475569' }}>{won(f.금액)}</span>
                    </div>
                  </div>
                ))}
                <div className="mli" style={{ borderTop: '1px solid #e2e8f0', marginTop: 8, paddingTop: 12 }}>
                  <div style={{ flex: 1 }}><div className="mli-t" style={{ fontWeight: 700 }}>합계</div></div>
                  <div className="mli-r"><span className="mli-amt" style={{ color: '#1e293b', fontWeight: 700 }}>{won(money?.고정비월합 ?? 0)}</span></div>
                </div>
              </div>
            </aside>
          </>);
        }
        if (moneyList === 'util') {
          // 프로젝트 단위 — 카테고리별 고유 프로젝트명 목록 (대행·자체사업·내부·리서치만)
          const PANEL_CATS = ['대행', '자체사업', '내부', '리서치'] as const;
          const totalProjs = PANEL_CATS.reduce((s, k) => s + catProjects[k].length, 0);
          return (<>
            <div className="ovl" onClick={() => setMoneyList(null)} />
            <aside className="panel">
              <div className="ph"><button className="pclose" onClick={() => setMoneyList(null)}>✕</button>
                <div className="pproj">📊 팀 가동률 — 진행 중 프로젝트 <span style={{ fontSize: 13, color: '#9298ac', fontWeight: 500 }}>{totalProjs}개</span></div>
                <div className="pmeta">활성 프로젝트를 분야별로</div>
              </div>
              <div className="pbody">
                {totalProjs === 0 ? <div className="empty">진행 중 프로젝트 없음</div>
                  : PANEL_CATS.filter((k) => catProjects[k].length > 0).map((k) => (
                    <div key={k}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: CAT[k].c, padding: '10px 0 4px', letterSpacing: 0.5 }}>
                        {CAT[k].e} {k} <span style={{ fontWeight: 400, color: '#94a3b8' }}>{catProjects[k].length}개</span>
                      </div>
                      {catProjects[k].map((proj, i) => {
                        const t = all.find((x) => (x.project || x.id) === proj && ACTIVE_SET.has(x.ball));
                        return (
                          <div key={i} className="mli" style={t ? { cursor: 'pointer' } : {}} onClick={() => t && (setSel(t), setMoneyList(null))}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="mli-t">{proj}</div>
                              {t?.client && t.client !== proj && <div className="mli-s">{t.client}</div>}
                            </div>
                            {t && <span className="mli-tag">{WHO[t.owner] || t.owner || '종호'}</span>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
              </div>
            </aside>
          </>);
        }
        const cs = money?.계약목록 || [];
        const list = moneyList === 'due'
          ? cs.filter((c) => c.미수금 > 0).sort((a, b) => b.미수금 - a.미수금)
          : cs.slice().sort((a, b) => b.순매출 - a.순매출);
        const saveContract = () => {
          if (!editingContract) return;
          fetch('/api/office/contract/update', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editingContract),
          }).then(() => { setEditingContract(null); load(true); });
        };
        return (<>
          <div className="ovl" onClick={() => { setMoneyList(null); setEditingContract(null); }} />
          <aside className="panel">
            <div className="ph"><button className="pclose" onClick={() => { setMoneyList(null); setEditingContract(null); }}>✕</button>
              <div className="pproj">{moneyList === 'due' ? '🔴 미수금 계약' : '💰 순매출 계약'} <span style={{ fontSize: 13, color: '#9298ac', fontWeight: 500 }}>{list.length}건</span></div>
              <div className="pmeta">{moneyList === 'due' ? '아직 못 받은 돈 (계약금액 − 입금액)' : '계약별 순매출 = 부가세 뺀 실매출 · ✏️=입금 수정'}</div>
            </div>
            <div className="pbody">
              {list.length === 0 ? <div className="empty">없음</div> : list.map((c, i) => (
                <div key={i}>
                  <div className="mli">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mli-t">{c.계약명}</div>
                      <div className="mli-s">{c.클라이언트}{c.계약일 ? ' · ' + c.계약일 : ''}</div>
                    </div>
                    <div className="mli-r">
                      <span className="mli-amt" style={{ color: moneyList === 'due' ? '#e0364a' : '#059669' }}>{won(moneyList === 'due' ? c.미수금 : c.순매출)}</span>
                      <span className="mli-tag" style={{ cursor: 'pointer' }}
                        onClick={() => setEditingContract(editingContract?.계약명 === c.계약명 ? null : { 계약명: c.계약명, 계약금액: c.계약금액, 입금액: String(c.입금액 || ''), 입금일: c.입금일 || '', 입금상태: c.입금상태 || '입금대기' })}>
                        {moneyList === 'due' ? (c.미수종류 === '받을예정' ? '예정 ' + (c.입금예정일 || '') : '미정') : c.입금상태} ✏️</span>
                    </div>
                  </div>
                  {editingContract?.계약명 === c.계약명 && (
                    <div style={{ background: '#f8fafc', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <input className="ein" placeholder="입금액" value={editingContract.입금액} onChange={(e) => setEditingContract({ ...editingContract, 입금액: e.target.value })} />
                        <input className="ein" placeholder="입금일 (2026-06)" value={editingContract.입금일} onChange={(e) => setEditingContract({ ...editingContract, 입금일: e.target.value })} />
                        <select className="ein" value={editingContract.입금상태} onChange={(e) => setEditingContract({ ...editingContract, 입금상태: e.target.value })} style={{ gridColumn: '1/-1' }}>
                          {['입금대기','입금완료','부분입금','입금예정'].map((v) => <option key={v}>{v}</option>)}
                        </select>
                      </div>
                      <button onClick={saveContract} style={{ marginTop: 8, width: '100%', padding: '6px', borderRadius: 6, background: '#059669', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>저장</button>
                    </div>
                  )}
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
            <div className="statebtns"><button disabled={busy} onClick={() => patch(cur.id, { patch: { 담당자: cur.owner === '김지영' ? '신종호' : '김지영' } })}>담당 → {cur.owner === '김지영' ? '종호' : '지영'}</button><button className="discard" disabled={busy} onClick={() => discard(cur.id, cur.project || cur.task || '이 프로젝트')}>🗑 폐기(접기)</button></div>
          </div>
          <div className="pbody">
            {DOC_LABEL[cur.category || ''] && (<>
              <div className="psec">{DOC_LABEL[cur.category!].t} <span className="hint2">{DOC_LABEL[cur.category!].h}</span>
                <button className="docbtn" onClick={() => setDocEdit((v) => !v)}>{docEdit ? '✓ 보기' : '✏️ 편집'}</button></div>
              {docEdit ? (<>
                <textarea className="memoarea" style={{ minHeight: 300 }} value={memoVal} onChange={(e) => setMemoVal(e.target.value)} placeholder={DOC_LABEL[cur.category!].p + ' (마크다운 # ## - **굵게** [링크](url) 지원)'} />
                {memoVal !== (cur.memo || '') && <button className="esave" onClick={() => { saveMemo(); setDocEdit(false); }}>문서 저장</button>}
              </>) : cur.category === '리서치' && memoVal.trim() ? (
                <div className="secboard">{mdSections(memoVal).map((s, i) => (
                  <div key={i} className="secitem">
                    <button className="sechead" onClick={() => setOpenSec(openSec === i ? null : i)}><span className="secarr">{openSec === i ? '▼' : '▸'}</span>{s.h || '개요'}</button>
                    {openSec === i && <div className="mddoc">{renderMarkdown(s.body)}</div>}
                  </div>
                ))}</div>
              ) : (
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
            <div className="psec" style={{ marginTop: 16 }}>🧭 할일 흐름 <span className="hint2">✓완료 · ▶지금 · 클릭=넘기기</span>
              {DOC_LABEL[cur.category || ''] && (() => { const dn = effTodos(cur).map(parseStep).filter((s) => s.done).length; return dn > 0 ? <button className="docbtn" onClick={() => setShowDone((v) => !v)}>✓ 완료 {dn}개 {showDone ? '숨기기' : '보기'}</button> : null; })()}</div>
            {(() => {
              const raw = effTodos(cur).map(parseStep);
              // 날짜순으로 보여주되 토글·편집은 원본 인덱스(i)로 — 완료(위)·미완료(아래) 그룹 안에서 모두 날짜 오름차순(무날짜 뒤).
              const order = raw.map((st, i) => ({ st, i })).sort((a, b) => {
                if (a.st.done !== b.st.done) return a.st.done ? -1 : 1;
                const da = a.st.date ? (stepDday(a.st.date) ?? 99999) : 99999;
                const db = b.st.date ? (stepDday(b.st.date) ?? 99999) : 99999;
                return da !== db ? da - db : a.i - b.i;
              });
              const firstUndone = order.find((o) => !o.st.done)?.i ?? -1;
              return order.map(({ st, i }) => (DOC_LABEL[cur.category || ''] && st.done && !showDone) ? null : editStepIdx === i ? (
                <div key={i} className="jstep editing">
                  <input className="jein2" value={editStepVal} autoFocus onChange={(e) => setEditStepVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveStepEdit(cur, i); if (e.key === 'Escape') setEditStepIdx(null); }} placeholder="단계 내용 (날짜 @6/25)" />
                  <button className="jbtn ok" disabled={busy} onClick={() => saveStepEdit(cur, i)}>저장</button>
                  <button className="jbtn del" disabled={busy} onClick={() => delStep(cur, i)}>🗑</button>
                </div>
              ) : (
                <div key={i}>
                <div className={`jstep${st.done ? ' done' : i === firstUndone ? ' cur' : ''}`}>
                  <span className="jmark" onClick={() => toggleStep(cur, i)}>{st.done ? '✓' : i === firstUndone ? '▶' : '○'}</span>
                  <span className="jtext" onClick={() => toggleStep(cur, i)}>{st.text}</span>
                  {st.date ? (
                    <span className={`jdate${i === firstUndone ? ' now' : ''}`} onClick={() => openDateBox(i, st)} title="클릭=날짜 선택">📅 {st.start ? `${st.start}~${st.date}` : st.date}{i === firstUndone && stepDday(st.date) != null ? ` · ${ddText(stepDday(st.date))}` : ''}</span>
                  ) : (
                    <span className="jdate empty" onClick={() => openDateBox(i, st)} title="날짜 선택">📅</span>
                  )}
                  {(() => { const out = st.owner && st.owner !== '신종호' && st.owner !== '김지영'; return (
                    <select className={`jwho${st.owner ? (out ? ' set out' : ' set') : ''}`} title="이 단계 담당" value={st.owner || ''} onClick={(e) => e.stopPropagation()} onChange={(e) => setStepOwner(cur, i, e.target.value)}>
                      <option value="">담당</option>
                      <option value="신종호">🧑‍💼 종호</option>
                      <option value="김지영">🎨 김지영</option>
                      {vendors.map((v) => <option key={v} value={v}>🤝 {v}</option>)}
                      <option value="__외주__">🤝 새 외주…</option>
                    </select>
                  ); })()}
                  <button className="jeditbtn" onClick={() => startEditStep(i, st)}>✏️</button>
                </div>
                {dateStepIdx === i && (
                  <div className="datebox">
                    <div className="drow"><span>시작일</span><input type="date" className="ein" value={dateStart} onChange={(e) => setDateStart(e.target.value)} /></div>
                    <div className="drow"><span>마감일</span><input type="date" className="ein" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} /></div>
                    <div className="dbtns"><button className="ok" disabled={busy} onClick={() => saveDate(cur, i)}>저장</button><button className="clear" disabled={busy} onClick={() => clearDate(cur, i)}>날짜 지우기</button></div>
                  </div>
                )}
                </div>
              ));
            })()}
            <div className="addstep">
              <input value={newStep} onChange={(e) => setNewStep(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) addStep(cur); }} placeholder="+ 단계 추가 (날짜 @6/25)" />
              <button disabled={busy || !newStep.trim()} onClick={() => addStep(cur)}>추가</button>
            </div>
            {!DOC_LABEL[cur.category || ''] && (<>
              <div className="psec" style={{ marginTop: 16 }}>📝 메모 <span className="hint2">현재 정리·문서 링크 (살아있는 기록)</span></div>
              <textarea className="memoarea" value={memoVal} onChange={(e) => setMemoVal(e.target.value)} placeholder="진행 정리, 문서 링크, 메모를 자유롭게…" />
              {memoVal !== (cur.memo || '') && <button className="esave" onClick={saveMemo}>메모 저장</button>}
            </>)}
            {!DOC_LABEL[cur.category || ''] && (<>
              <button className="editbtn" style={{ marginTop: 16 }} onClick={() => setShowHist((v) => !v)}>🕘 이력{cur.history && cur.history.length ? ` (${cur.history.length})` : ''} {showHist ? '▲' : '▼'}</button>
              {showHist && (cur.history && cur.history.length ? (
                <div className="tl">{cur.history.map((e, i) => (
                  <div key={i} className="ev"><span className="when">{e.when}</span><span className="what">{e.what}</span></div>
                ))}</div>
              ) : <div className="note">아직 이력 없음. 단계를 완료하면 여기 쌓입니다.</div>)}
            </>)}
          </div>
        </aside>
      </>)}
    </div>
  );
}
