// 큐앤뱅 공유 문서 표준 스타일(블랙앤화이트·곡선 없음·Pretendard) — 한 곳에서 관리.
// /share/[slug] 공개 페이지와 게시판·공유탭의 문서 뷰가 이 같은 CSS를 써서 "보는 모습"이 어디서든 동일하다.
// 마크업은 .share-wrap 안에 <article>(mdToHtml 결과)를 넣으면 된다.
export const SHARE_DOC_CSS = `
  @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css');
  /* 공유 문서(iframe로도 열림) — 전역 회색 배경이 비치지 않게 흰색 고정, 상단부터 렌더 */
  html, body { background:#ffffff !important; margin:0; padding:0; }
  .share-wrap { --ink:#111111; --sub:#6b6b6b; --line:#e3e3e3; --soft:#f6f6f6;
    max-width:760px; margin:0 auto; padding:0 24px 88px; color:var(--ink);
    font-family:'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif;
    line-height:1.8; font-size:15px; -webkit-text-size-adjust:100%; word-break:keep-all; }
  .share-wrap .brandbar { display:flex; align-items:center; justify-content:space-between;
    padding:28px 0 22px; margin-bottom:32px; border-bottom:1px solid var(--line); }
  .share-wrap .brandbar .logo { height:24px; width:auto; display:block; }
  .share-wrap .role { font-size:11.5px; color:var(--sub); letter-spacing:.02em; }
  .share-wrap h1 { font-size:26px; font-weight:800; line-height:1.3; letter-spacing:-.03em;
    margin:0 0 12px; padding-bottom:18px; border-bottom:3px solid var(--ink); }
  .share-wrap h2 { font-size:17px; font-weight:700; letter-spacing:-.01em;
    margin:40px 0 12px; padding:10px 14px; background:var(--ink); color:#fff; }
  .share-wrap h3 { font-size:14px; font-weight:700; margin:24px 0 8px; color:var(--ink);
    border-left:3px solid var(--ink); padding-left:10px; }
  .share-wrap p { margin:8px 0; font-size:14.5px; }
  .share-wrap strong { color:var(--ink); font-weight:700; }
  .share-wrap a { color:var(--ink); text-decoration:underline; text-underline-offset:2px; }
  .share-wrap code { background:var(--soft); padding:1px 6px; border-radius:0; font-size:0.88em;
    font-family:"SFMono-Regular",ui-monospace,monospace; }
  .share-wrap hr { border:none; border-top:1px solid var(--line); margin:36px 0; }
  .share-wrap ul { margin:8px 0; padding-left:20px; }
  .share-wrap li { margin:5px 0; font-size:14px; line-height:1.7; } .share-wrap li::marker { color:var(--sub); }
  .share-wrap blockquote { margin:12px 0; padding:12px 16px; background:var(--soft); border-left:3px solid var(--ink);
    border-radius:0; color:#333; font-size:0.95em; }
  .share-wrap blockquote p { margin:4px 0; }
  .share-wrap table { border-collapse:collapse; width:100%; margin:14px 0; font-size:0.9em; }
  .share-wrap th,.share-wrap td { border:1px solid var(--line); padding:8px 11px; text-align:left; vertical-align:top; }
  .share-wrap th { background:var(--soft); font-weight:700; }
  .share-wrap .footer { margin-top:56px; padding-top:24px; border-top:1px solid var(--line);
    display:flex; align-items:center; gap:12px; }
  .share-wrap .footer .footer-logo { height:18px; width:auto; opacity:0.55; }
  .share-wrap .footer .meta { color:var(--sub); font-size:11.5px; margin:0; }
  @media (max-width:520px){ .share-wrap{padding:0 16px 64px;} .share-wrap h1{font-size:22px;} }
`;
