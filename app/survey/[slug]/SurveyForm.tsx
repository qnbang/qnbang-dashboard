'use client';
// 설문 입력폼 — 마크다운 설문을 질문별 입력칸으로 렌더, 제출하면 /api/survey 로 보내 메일 발송.
import { useState } from 'react';

export type Block =
  | { kind: 'h2'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'q'; id: string; label: string; hint: string };

export default function SurveyForm({ slug, title, blocks }: { slug: string; title: string; blocks: Block[] }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const answers = blocks
      .filter((b): b is Extract<Block, { kind: 'q' }> => b.kind === 'q')
      .map((b) => ({ label: b.label, value: String(fd.get(b.id) || '') }));
    if (answers.every((a) => !a.value.trim())) {
      setErrMsg('한 칸이라도 채워서 보내주세요.');
      return;
    }
    setStatus('sending');
    setErrMsg('');
    try {
      const res = await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, title, answers, botcheck: String(fd.get('botcheck') || '') }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || '전송 실패');
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setErrMsg(err instanceof Error ? err.message : '전송에 실패했습니다.');
    }
  }

  if (status === 'done') {
    return (
      <div className="sv-wrap">
        <style>{CSS}</style>
        <div className="sv-done">
          <div className="sv-check">✓</div>
          <h1>보내주셔서 감사합니다</h1>
          <p>응답이 큐앤뱅에 잘 접수되었습니다. 정리해서 다음 단계로 이어가겠습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sv-wrap">
      <style>{CSS}</style>
      <div className="brandbar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/share/qn-logo.png" alt="큐앤뱅" />
        <span className="role">큐앤뱅 설문</span>
      </div>

      <h1>{title}</h1>

      <form onSubmit={onSubmit} noValidate>
        {blocks.map((b, i) => {
          if (b.kind === 'h2') return <h2 key={i}>{b.text}</h2>;
          if (b.kind === 'text') return <p key={i} className="sv-text">{b.text}</p>;
          return (
            <label key={i} className="q">
              <span className="q-label">{b.label}</span>
              {b.hint && <span className="q-hint">{b.hint}</span>}
              <textarea name={b.id} rows={2} />
            </label>
          );
        })}

        {/* 스팸 봇 트랩(사람에겐 안 보임) */}
        <input name="botcheck" tabIndex={-1} autoComplete="off" aria-hidden="true"
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />

        {errMsg && <p className="sv-err">{errMsg}</p>}

        <button type="submit" className="sv-submit" disabled={status === 'sending'}>
          {status === 'sending' ? '보내는 중…' : '보내기'}
        </button>
      </form>

      <div className="footer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="footer-logo" src="/share/qn-logo.png" alt="큐앤뱅" />
        <span className="meta">큐앤뱅(QN!) · dashboard.qnbang.com</span>
      </div>
    </div>
  );
}

// 큐앤뱅 문서 표준(블랙앤화이트·곡선 없음·Pretendard). 공유문서 톤과 통일 + 폼 컨트롤.
const CSS = `
  @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css');
  .sv-wrap { --ink:#111111; --sub:#6b6b6b; --line:#e3e3e3; --soft:#f6f6f6;
    max-width:680px; margin:0 auto; padding:0 24px 96px; color:var(--ink);
    font-family:'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif;
    line-height:1.7; font-size:15px; -webkit-text-size-adjust:100%; word-break:keep-all; background:#fff; min-height:100vh; }
  .sv-wrap .brandbar { display:flex; align-items:center; justify-content:space-between;
    padding:28px 0 22px; margin-bottom:28px; border-bottom:1px solid var(--line); }
  .sv-wrap .brandbar .logo { height:24px; width:auto; display:block; }
  .sv-wrap .role { font-size:11.5px; color:var(--sub); letter-spacing:.02em; }
  .sv-wrap h1 { font-size:25px; font-weight:800; line-height:1.3; letter-spacing:-.03em;
    margin:0 0 20px; padding-bottom:18px; border-bottom:3px solid var(--ink); }
  .sv-wrap h2 { font-size:16px; font-weight:700; letter-spacing:-.01em;
    margin:36px 0 6px; padding:9px 13px; background:var(--ink); color:#fff; }
  .sv-wrap .sv-text { margin:8px 0; font-size:13.5px; color:var(--sub); white-space:pre-line; }
  .sv-wrap .q { display:block; margin:18px 0; }
  .sv-wrap .q-label { display:block; font-size:14.5px; font-weight:700; color:var(--ink); margin-bottom:7px; }
  .sv-wrap .q-label em { font-weight:400; color:var(--sub); font-style:normal; font-size:12.5px; }
  .sv-wrap .q-hint { display:block; font-size:12.5px; color:var(--sub); margin-bottom:7px; white-space:pre-line; }
  .sv-wrap input, .sv-wrap textarea { width:100%; box-sizing:border-box; font-family:inherit; font-size:14.5px;
    color:var(--ink); background:#fff; border:1px solid #cfcfcf; border-radius:0; padding:10px 12px; line-height:1.6; }
  .sv-wrap textarea { resize:vertical; min-height:44px; }
  .sv-wrap input:focus, .sv-wrap textarea:focus { outline:none; border-color:var(--ink); box-shadow:inset 0 0 0 1px var(--ink); }
  .sv-wrap .sv-submit { margin-top:28px; width:100%; padding:15px; font-size:15px; font-weight:700;
    color:#fff; background:var(--ink); border:none; border-radius:0; cursor:pointer; font-family:inherit; }
  .sv-wrap .sv-submit:disabled { opacity:.5; cursor:default; }
  .sv-wrap .sv-err { color:#c0392b; font-size:13px; margin:14px 0 0; }
  .sv-wrap .sv-done { text-align:center; padding:80px 0; }
  .sv-wrap .sv-check { width:56px; height:56px; margin:0 auto 20px; border:2px solid var(--ink);
    display:flex; align-items:center; justify-content:center; font-size:26px; }
  .sv-wrap .sv-done h1 { border:none; padding:0; display:inline-block; }
  .sv-wrap .sv-done p { color:var(--sub); font-size:14.5px; }
  .sv-wrap .footer { margin-top:48px; padding-top:22px; border-top:1px solid var(--line);
    display:flex; align-items:center; gap:12px; }
  .sv-wrap .footer .footer-logo { height:18px; width:auto; opacity:.55; }
  .sv-wrap .footer .meta { color:var(--sub); font-size:11.5px; margin:0; }
  @media (max-width:520px){ .sv-wrap{padding:0 16px 72px;} .sv-wrap h1{font-size:21px;} }
`;
