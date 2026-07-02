// 외부 공유 페이지 — /share/[slug]
// 로그인 없이 열린다(middleware 에서 share 경로 제외). 요청이 오면:
//  ① 공유 기록에서 slug 확인 → ② 공개면 원본 MD 를 GitHub 에서 가져와 ③ 읽기 좋게 렌더,
//  ④ 비공개(기록에 없음)면 404. 노션 "웹에 게시"와 같은 동작.
import { notFound } from 'next/navigation';
import { getShareBySlug, healSharePath } from '@/lib/share';
import { getDoc, findDocByName } from '@/lib/github';
import { mdToHtml } from '@/lib/md';
import type { Metadata } from 'next';

// 매 요청마다 최신 공유 상태를 반영(캐시 끔) → 토글이 즉시 적용된다.
export const dynamic = 'force-dynamic';

// 링크 미리보기·브라우저 탭 제목 = 그 공유 문서의 이름(레지스트리 title).
// → 카톡/메신저에 링크 붙이면 "금문도 …"처럼 문서 이름이 뜬다. 모든 공유에 자동 적용(통일).
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getShareBySlug(slug);
  const title = entry?.title || '큐앤뱅 공유 문서';
  const description = '큐앤뱅에서 공유드린 문서입니다. 눌러서 확인해 주세요.';
  const image = 'https://dashboard.qnbang.com/share/qn-logo.png';
  return {
    title,
    description,
    openGraph: { title, description, siteName: '큐앤뱅', type: 'article', images: [image] },
    twitter: { card: 'summary', title, description, images: [image] },
  };
}

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = await getShareBySlug(slug);
  if (!entry) notFound();

  // 저장된 경로로 먼저 시도. 폴더 이동 등으로 못 찾으면(=null) 파일명으로 새 위치를 찾아 복구하고,
  // 기록의 경로도 새 위치로 고쳐둔다(slug=링크는 그대로라 이미 보낸 링크가 안 깨진다).
  let md = await getDoc(entry.repo, entry.path);
  if (md == null) {
    const base = entry.path.split('/').pop() || '';
    const newPath = await findDocByName(entry.repo, base);
    if (newPath) {
      md = await getDoc(entry.repo, newPath);
      // 서버리스에선 응답 후 함수가 멈출 수 있어 fire-and-forget이 누락된다 → await로 확실히 저장.
      if (md != null) await healSharePath(entry.repo, entry.path, newPath).catch(() => {});
    }
  }
  if (md == null) notFound();

  const body = mdToHtml(md);

  return (
    <div style={{ background: '#ffffff', minHeight: '100vh' }}>
      <style>{CSS}</style>
      <div className="share-wrap">
        <div className="brandbar">
          {/* 로고는 이미 공개 경로인 /share/ 아래에 둠 → 외부 열람자도 보임 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo" src="/share/qn-logo.png" alt="큐앤뱅" />
          <span className="role">큐앤뱅 공유 문서</span>
        </div>
        <article dangerouslySetInnerHTML={{ __html: body }} />
        <div className="footer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="footer-logo" src="/share/qn-logo.png" alt="큐앤뱅" />
          <span className="meta">큐앤뱅(QN!) · dashboard.qnbang.com</span>
        </div>
      </div>
    </div>
  );
}

// 큐앤뱅 문서 표준(블랙앤화이트·곡선 없음·Pretendard) — 공유문서 공통 톤.
// 강조=검정, 인용박스=회색+검정 좌선, h2=검정 바, 각진(라운드 0).
const CSS = `
  @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css');
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
