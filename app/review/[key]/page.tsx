'use client';

// 장표별 개선안 검토 페이지 — 사장님이 각 장표를 확정(✓)하고 코멘트를 단다.
// 저장값은 GitHub(qnbang-dashboard-data/reviews/<key>.json)에 남아 클로드가 읽어 반영한다.
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Section = { id: string; html: string; raw: string };
type Item = { confirmed: boolean; comment: string; edit: string };

export default function ReviewPage() {
  const { key } = useParams<{ key: string }>();
  const [title, setTitle] = useState('');
  const [intro, setIntro] = useState('');
  const [sections, setSections] = useState<Section[]>([]);
  const [items, setItems] = useState<Record<string, Item>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState('');

  useEffect(() => {
    fetch(`/api/review?key=${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setTitle(j.title); setIntro(j.intro); setSections(j.sections || []);
          setItems(j.review?.items || {});
          setSavedAt(j.review?.updatedAt || '');
        } else setError(j.error || '불러오지 못했어요.');
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [key]);

  const get = (id: string): Item => items[id] || { confirmed: false, comment: '', edit: '' };
  const toggleConfirm = (id: string) => {
    setItems((m) => ({ ...m, [id]: { ...get(id), confirmed: !get(id).confirmed } }));
    setDirty(true);
  };
  const setComment = (id: string, comment: string) => {
    setItems((m) => ({ ...m, [id]: { ...get(id), comment } }));
    setDirty(true);
  };
  const setEdit = (id: string, edit: string) => {
    setItems((m) => ({ ...m, [id]: { ...get(id), edit } }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, items }),
      });
      const j = await r.json();
      if (j.ok) { setDirty(false); setSavedAt(j.review?.updatedAt || ''); }
      else setError(j.error || '저장 실패');
    } catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  };

  const confirmedCount = sections.filter((s) => get(s.id).confirmed).length;

  if (loading) return <p className="text-slate-400 text-center py-20">불러오는 중…</p>;
  if (error) return <p className="text-red-500 text-center py-20">⚠️ {error}</p>;

  return (
    <div className="min-h-screen bg-slate-100">
      <style>{REVIEW_CSS}</style>
      {/* 상단 고정 바 */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-slate-800 truncate">{title}</h1>
            <p className="text-[11px] text-slate-400">
              확정 {confirmedCount}/{sections.length} 장표
              {savedAt && <span> · 마지막 저장 {new Date(savedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
            </p>
          </div>
          <button onClick={save} disabled={saving || !dirty}
            className={`shrink-0 text-sm font-semibold rounded-lg px-4 py-2 transition ${dirty ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-400'} disabled:opacity-60`}>
            {saving ? '저장 중…' : dirty ? '저장' : '저장됨 ✓'}
          </button>
        </div>
        {/* 진행 막대 */}
        <div className="h-1 bg-slate-100">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: sections.length ? `${(confirmedCount / sections.length) * 100}%` : '0%' }} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {intro && (
          <div className="reviewdoc rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm" dangerouslySetInnerHTML={{ __html: intro }} />
        )}

        {sections.map((s) => {
          const it = get(s.id);
          return (
            <section key={s.id} className={`rounded-2xl border bg-white shadow-sm overflow-hidden transition ${it.confirmed ? 'border-emerald-300' : 'border-slate-200'}`}>
              {/* 확정 토글 바 (장표 위) */}
              <div className={`flex items-center justify-between px-5 py-2 border-b transition ${it.confirmed ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                <span className={`text-[11px] font-semibold ${it.confirmed ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {it.confirmed ? '확정됨' : '검토 전'}
                </span>
                <button onClick={() => toggleConfirm(s.id)}
                  className={`text-xs font-semibold rounded-full px-3 py-1 border transition ${it.confirmed ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-100'}`}>
                  {it.confirmed ? '✓ 확정됨 (해제)' : '확정'}
                </button>
              </div>
              <div className="reviewdoc px-5 py-4" dangerouslySetInnerHTML={{ __html: s.html }} />
              <div className="px-5 py-3 bg-slate-50/60 border-t border-slate-100 space-y-3">
                {/* 코멘트 — 클로드에게 할 말 */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-400">💬 클로드에게 할 말</label>
                  <textarea
                    value={it.comment}
                    onChange={(e) => setComment(s.id, e.target.value)}
                    placeholder="예: 태백 상징은 ○○로 바꿔 / 갓챠 가격은 빼줘 — 비우면 이대로 진행"
                    className="mt-1 w-full min-h-[52px] resize-y rounded-lg border border-slate-200 p-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                {/* 직접 고치기 — 사장이 쓴 문구 그대로 반영 */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-slate-400">✍️ 직접 고치기 <span className="font-normal text-slate-300">(여기 쓴 문구는 그대로 반영)</span></label>
                    {!it.edit && (
                      <button onClick={() => setEdit(s.id, s.raw)} className="text-[11px] font-medium text-indigo-500 hover:text-indigo-700">
                        ↧ 개선안 불러와 고치기
                      </button>
                    )}
                  </div>
                  <textarea
                    value={it.edit}
                    onChange={(e) => setEdit(s.id, e.target.value)}
                    placeholder="직접 고칠 때만 사용 — '개선안 불러와 고치기'를 누르면 위 내용이 여기로 들어옵니다."
                    className="mt-1 w-full resize-y rounded-lg border border-slate-200 p-2.5 font-mono text-[13px] leading-relaxed text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    style={{ minHeight: it.edit ? '180px' : '44px' }}
                  />
                </div>
              </div>
            </section>
          );
        })}

        {/* 하단 저장 */}
        <div className="flex justify-end pt-2 pb-10">
          <button onClick={save} disabled={saving || !dirty}
            className={`text-sm font-semibold rounded-lg px-5 py-2.5 transition ${dirty ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-200 text-slate-400'} disabled:opacity-60`}>
            {saving ? '저장 중…' : dirty ? '저장하기' : '저장됨 ✓'}
          </button>
        </div>
      </main>
    </div>
  );
}

// 개선안 본문(mdToHtml 결과) 가독 스타일
const REVIEW_CSS = `
  .reviewdoc { color:#1f2328; line-height:1.6; font-size:14px; }
  .reviewdoc h1 { font-size:18px; font-weight:800; margin:2px 0 8px; }
  .reviewdoc h2 { font-size:15.5px; font-weight:800; color:#3730a3; margin:0 0 8px; }
  .reviewdoc h3 { font-size:14px; font-weight:700; margin:14px 0 4px; }
  .reviewdoc p { margin:5px 0; }
  .reviewdoc strong { color:#b8430f; font-weight:700; }
  .reviewdoc ul { margin:6px 0; padding-left:20px; list-style:disc; } .reviewdoc li { margin:2px 0; }
  .reviewdoc a { color:#0a66c2; }
  .reviewdoc code { background:#f3f3f3; padding:1px 5px; border-radius:4px; font-size:0.88em; }
  .reviewdoc blockquote { margin:10px 0; padding:10px 14px; background:#faf9f7; border-left:3px solid #c9742a; border-radius:0 8px 8px 0; color:#444; }
  .reviewdoc blockquote p { margin:3px 0; }
  .reviewdoc table { border-collapse:collapse; width:100%; margin:10px 0; font-size:0.9em; }
  .reviewdoc th,.reviewdoc td { border:1px solid #e5e5e5; padding:6px 9px; text-align:left; vertical-align:top; }
  .reviewdoc th { background:#f7f7f7; font-weight:700; }
  .reviewdoc hr { border:none; border-top:1px solid #eee; margin:14px 0; }
`;
