'use client';

import { useEffect, useState } from 'react';

const won = (n: number) => `${(n || 0).toLocaleString('ko-KR')}원`;

type Task = {
  id: string; project: string; task: string; owner: string;
  money: string; ball: string; due: string; dday: number | null;
  urgent: boolean; todos: string[];
  status?: string; nextStep?: string; reason?: string;
  staleDays?: number | null; stale?: boolean;
};
type Room = { key: string; name: string; hint: string; tasks: Task[] };
type Office = { rooms: Room[]; 가동률: Record<string, number>; 과업수: number; source?: string; syncedAt?: string; 언젠가?: Task[] };
type Money = { 순매출누계: number; 미수금합: number; 고정비월합: number; 계약건수: number };

const BALL: Record<string, string> = {
  start: '🌱', mywork: '🛠️', myreply: '📤', client: '📥', hold: '⏸️', done: '✅', urgent: '‼️', unset: '⬜',
};
const BALL_TXT: Record<string, string> = {
  start: '시작 전', mywork: '내 작업', myreply: '내 회신', client: '고객 대기', hold: '보류', done: '완수', unset: '공위치 미정',
};
// 시트 공위치 라벨(편집 select용, 공백 없는 시트값과 일치). ball 코드 → 라벨.
const POS_LABELS = ['시작전', '내작업', '내회신', '고객대기', '보류', '완수'];
const BALL2LABEL: Record<string, string> = {
  start: '시작전', mywork: '내작업', myreply: '내회신', client: '고객대기', hold: '보류', done: '완수', unset: '',
};
const MONEY_CLS: Record<string, string> = {
  매출: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  영업: 'bg-blue-50 text-blue-700 border-blue-200',
  투자: 'bg-violet-50 text-violet-700 border-violet-200',
  운영: 'bg-slate-50 text-slate-600 border-slate-200',
};
const ROOM_CLS: Record<string, string> = {
  boss: 'border-amber-200 bg-amber-50', work: 'border-emerald-200 bg-emerald-50',
  lobby: 'border-sky-200 bg-sky-50', team: 'border-pink-200 bg-pink-50',
  idea: 'border-violet-200 bg-violet-50', store: 'border-slate-200 bg-slate-50',
};

function ddayText(d: number | null): string {
  if (d === null) return '';
  if (d < 0) return `마감 ${-d}일 지남`;
  if (d === 0) return '오늘 마감';
  return `D-${d}`;
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

export default function OfficeView() {
  const [office, setOffice] = useState<Office | null>(null);
  const [money, setMoney] = useState<Money | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    fetch('/api/office')
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) { setOffice(j.office); setMoney(j.money); }
        else setError(j.error || '불러오기 실패');
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  // 빠른추가(P3a): 한 줄 입력 → /api/office/add → 시트 기록 → 다시 로드
  const [addLine, setAddLine] = useState('');
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState('');
  const addTask = async () => {
    if (!addLine.trim() || adding) return;
    setAdding(true); setAddMsg('');
    try {
      const r = await fetch('/api/office/add', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line: addLine }),
      });
      const j = await r.json();
      if (j.ok) { setAddLine(''); setAddMsg(`✓ 추가됨: ${j.행.프로젝트} · ${j.행.과업명 || ''} (${j.행.공위치}${j.행.기한 ? ', ' + j.행.기한 : ''})`); load(); }
      else setAddMsg('⚠️ ' + (j.error || '추가 실패'));
    } catch (e) { setAddMsg('⚠️ ' + String(e)); }
    finally { setAdding(false); }
  };

  // 과업 클릭 상세(P7): 카드 펼쳐 할일 체크리스트·전체정보
  const [openId, setOpenId] = useState('');
  // 완료(P5): 과업을 완수 처리 → 아카이브 탭으로 이동 → 다시 로드
  const [completing, setCompleting] = useState('');
  const complete = async (id: string) => {
    if (completing) return;
    setCompleting(id);
    try {
      const r = await fetch('/api/office/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      });
      const j = await r.json();
      if (j.ok) load(); else setAddMsg('⚠️ 완료 실패: ' + (j.error || ''));
    } catch (e) { setAddMsg('⚠️ ' + String(e)); }
    finally { setCompleting(''); }
  };

  // 수정/삭제(P9): 펼친 카드에서 공위치·현재상태·다음할일·기한 편집, 삭제
  const [edit, setEdit] = useState<{ 공위치: string; 현재상태: string; 다음할일: string; 기한: string }>({ 공위치: '', 현재상태: '', 다음할일: '', 기한: '' });
  const [saving, setSaving] = useState(false);
  const openCard = (t: Task) => {
    const willOpen = openId !== t.id;
    setOpenId(willOpen ? t.id : '');
    if (willOpen) {
      const 기한 = t.due ? new Date(t.due).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) : '';
      setEdit({ 공위치: BALL2LABEL[t.ball] || '', 현재상태: t.status || '', 다음할일: t.nextStep || '', 기한: isNaN(Date.parse(t.due)) ? '' : 기한 });
    }
  };
  const save = async (id: string) => {
    if (saving) return;
    setSaving(true);
    try {
      const r = await fetch('/api/office/update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, patch: edit }),
      });
      const j = await r.json();
      if (j.ok) { setOpenId(''); load(); } else setAddMsg('⚠️ 저장 실패: ' + (j.error || ''));
    } catch (e) { setAddMsg('⚠️ ' + String(e)); }
    finally { setSaving(false); }
  };
  const remove = async (id: string, name: string) => {
    if (saving || !confirm(`"${name}" 과업을 삭제할까요?`)) return;
    setSaving(true);
    try {
      const r = await fetch('/api/office/update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, delete: true }),
      });
      const j = await r.json();
      if (j.ok) { setOpenId(''); load(); } else setAddMsg('⚠️ 삭제 실패: ' + (j.error || ''));
    } catch (e) { setAddMsg('⚠️ ' + String(e)); }
    finally { setSaving(false); }
  };

  // 언젠가(보류) 접힌 칸 + 되살리기
  const [somedayOpen, setSomedayOpen] = useState(false);
  const setPos = async (id: string, label: string) => {
    try {
      const r = await fetch('/api/office/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, patch: { 공위치: label } }) });
      const j = await r.json(); if (j.ok) load();
    } catch (e) { setAddMsg('⚠️ ' + String(e)); }
  };

  if (loading) return <p className="text-slate-400 text-center py-20">사무실 불러오는 중…</p>;
  if (error) return <p className="text-red-500 text-center py-20">⚠️ {error}</p>;
  if (!office) return null;

  const 가동 = Object.entries(office.가동률).sort(([, a], [, b]) => b - a);
  const 가동텍스트 = 가동.map(([k, v]) => `${k} ${v}`).join(' · ') || '–';

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Scorecard label="순매출 누계" value={won(money?.순매출누계 ?? 0)} sub={`계약 ${money?.계약건수 ?? 0}건`} tone="text-emerald-600" />
        <Scorecard label="미수금 ●" value={won(money?.미수금합 ?? 0)} sub="계약금액 − 입금액" tone="text-rose-600" />
        <Scorecard label="월 고정비" value={won(money?.고정비월합 ?? 0)} sub="매달 나가는 돈" tone="text-slate-700" />
        <Scorecard label="가동률 (담당 과업)" value={가동텍스트} sub={`진행 중 과업 ${office.과업수}개`} />
      </section>

      {/* 정직한 신뢰(P1): 지금 보는 게 언제·어디 데이터인지 명시 */}
      <div className="text-[11px]">
        {office.source === 'sheet' && (
          <span className="text-slate-400">✓ 시트 동기화 · {office.syncedAt} 기준</span>
        )}
        {office.source === 'seed' && (
          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">⚠️ 미리보기 시드(실데이터 아님) — 시트 미설정 상태</span>
        )}
        {office.source === 'unavailable' && (
          <span className="px-2 py-1 rounded bg-rose-50 text-rose-600 border border-rose-200 font-medium">⛔ 사무실 데이터를 불러오지 못했어요 — 시트 연결을 확인하세요. 옛 데이터를 보여주지 않으려고 비워둡니다.</span>
        )}
      </div>

      {/* 빠른추가(P3a): 라크 안 거치고 여기서 한 줄로 과업 투입 */}
      <div className="flex items-center gap-2">
        <input
          value={addLine}
          onChange={(e) => setAddLine(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addTask(); }}
          placeholder="과업 한 줄 추가 — 예: 소리쉼 시안확정 고객대기 6/25"
          className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-emerald-300 focus:outline-none"
        />
        <button
          onClick={addTask}
          disabled={adding || !addLine.trim()}
          className="text-sm px-3 py-2 rounded-lg bg-emerald-500 text-white font-medium disabled:opacity-40"
        >{adding ? '추가 중…' : '+ 추가'}</button>
      </div>
      {addMsg && <div className={`text-[11px] ${addMsg.startsWith('⚠️') ? 'text-rose-500' : 'text-emerald-600'}`}>{addMsg}</div>}

      <div className="flex items-center gap-2 flex-wrap text-sm text-slate-500">
        <span className="font-medium text-slate-600">지금 공(다음 차례)이 누구에게 — 과업 단위</span>
        <span className="text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">📤 내 회신</span>
        <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200">🛠️ 내 작업</span>
        <span className="text-[11px] px-2 py-0.5 rounded bg-sky-50 text-sky-600 border border-sky-200">📥 고객 대기</span>
        <span className="text-[11px] px-2 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-200">🌱 시작 전</span>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {office.rooms.map((room) => (
          <div key={room.key} className={`rounded-xl border p-3 min-h-[120px] ${ROOM_CLS[room.key]}`}>
            <div className="flex items-baseline justify-between mb-2">
              <div className="font-bold text-sm">{room.name}</div>
              <div className="text-[11px] text-slate-400">{room.hint} · {room.tasks.length}</div>
            </div>
            <div className="space-y-2">
              {room.tasks.length === 0 && <div className="text-xs text-slate-300 py-3 text-center">비어 있음</div>}
              {room.tasks.map((t) => {
                const dt = ddayText(t.dday);
                const next = t.nextStep || t.todos?.[0];
                return (
                  <div
                    key={t.id}
                    onClick={() => openCard(t)}
                    className={`bg-white rounded-lg px-3 py-2.5 border cursor-pointer ${t.stale ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200'}`}
                  >
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <span>{t.urgent ? '‼️' : BALL[t.ball] || ''}</span>
                      <span className="truncate">{t.project}</span>
                      {t.owner && t.owner !== '신종호' && (
                        <span className="text-pink-500">{t.owner}</span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); complete(t.id); }}
                        disabled={completing === t.id}
                        title="완료 → 아카이브로 이동"
                        className="ml-auto text-slate-300 hover:text-emerald-500 disabled:opacity-40"
                      >{completing === t.id ? '…' : '✓'}</button>
                    </div>
                    <div className="text-[13px] font-bold text-slate-800 leading-snug mt-0.5">{t.task}</div>
                    {t.status && <div className="text-[11px] text-slate-500 mt-0.5 truncate">{t.status}</div>}
                    {next && <div className="text-[12px] text-slate-700 font-medium mt-0.5 truncate">▸ {next}</div>}
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      <span className={`text-[11px] px-1.5 py-0.5 rounded border ${MONEY_CLS[t.money] || MONEY_CLS.운영}`}>{t.money}</span>
                      <span className={`text-[11px] px-1.5 py-0.5 rounded ${t.ball === 'unset' ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-slate-100 text-slate-500'}`}>{BALL[t.ball]} {BALL_TXT[t.ball]}</span>
                      {dt && (
                        <span className={`text-[11px] px-1.5 py-0.5 rounded ${t.dday !== null && t.dday <= 3 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>{dt}</span>
                      )}
                      {t.stale && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 font-medium">🔴 {t.staleDays}일째 멈춤</span>
                      )}
                    </div>
                    {t.reason && <div className="text-[10px] text-slate-400 mt-1 truncate">↳ {t.reason}</div>}
                    {openId === t.id && (
                      <div className="mt-2 pt-2 border-t border-slate-100 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                        <div className="grid grid-cols-2 gap-1.5">
                          <select value={edit.공위치} onChange={(e) => setEdit({ ...edit, 공위치: e.target.value })} className="text-[11px] border border-slate-200 rounded px-1.5 py-1">
                            <option value="">공위치…</option>
                            {POS_LABELS.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                          <input type="date" value={edit.기한} onChange={(e) => setEdit({ ...edit, 기한: e.target.value })} className="text-[11px] border border-slate-200 rounded px-1.5 py-1" />
                        </div>
                        <input value={edit.현재상태} onChange={(e) => setEdit({ ...edit, 현재상태: e.target.value })} placeholder="현재상태 (지금 무슨 상황)" className="w-full text-[11px] border border-slate-200 rounded px-1.5 py-1" />
                        <input value={edit.다음할일} onChange={(e) => setEdit({ ...edit, 다음할일: e.target.value })} placeholder="다음할일 (다음 한 수)" className="w-full text-[11px] border border-slate-200 rounded px-1.5 py-1" />
                        {t.todos && t.todos.length > 0 && <div className="text-[10px] text-slate-400">할일: {t.todos.map((td) => `☐ ${td}`).join('  ')}</div>}
                        <div className="flex gap-1.5 items-center">
                          <button onClick={() => save(t.id)} disabled={saving} className="text-[11px] px-2 py-1 rounded bg-emerald-500 text-white font-medium disabled:opacity-40">저장</button>
                          <button onClick={() => complete(t.id)} disabled={completing === t.id} className="text-[11px] px-2 py-1 rounded bg-slate-100 text-slate-600">✓ 완료</button>
                          <button onClick={() => remove(t.id, t.task || t.project)} disabled={saving} className="text-[11px] px-2 py-1 rounded bg-rose-50 text-rose-600 border border-rose-200 ml-auto">삭제</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* 언젠가(보류) — 메인서 빼둔 아이디어. 접힘. 오래되면(30일+) 빨강으로 "할까/접을까" 떠오름 */}
      {office.언젠가 && office.언젠가.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <button onClick={() => setSomedayOpen(!somedayOpen)} className="text-sm font-medium text-slate-500 flex items-center gap-2">
            💡 언젠가 <span className="text-slate-400">{office.언젠가.length}개</span>
            {office.언젠가.some((t) => (t.staleDays ?? 0) >= 30) && <span className="text-[11px] text-rose-500">· 오래된 것 있음</span>}
            <span className="text-[11px] text-slate-400">{somedayOpen ? '접기 ▲' : '펼쳐보기 ▼'}</span>
          </button>
          {somedayOpen && (
            <div className="space-y-1.5 mt-2">
              {office.언젠가.map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-sm bg-white rounded-lg border border-slate-200 px-3 py-2">
                  <span className="font-medium text-slate-700 truncate">{t.project}</span>
                  <span className="text-slate-400 text-xs truncate flex-1">{t.status || t.task}</span>
                  {(t.staleDays ?? 0) >= 30 && <span className="text-[11px] text-rose-500 shrink-0">{t.staleDays}일째 — 할까/접을까?</span>}
                  <button onClick={() => setPos(t.id, '내작업')} className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0">▶ 되살리기</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
