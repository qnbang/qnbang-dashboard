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
      if (md != null) healSharePath(entry.repo, entry.path, newPath).catch(() => {});
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

// 변환기(.tools/md-읽기페이지/변환.mjs)와 동일한 톤의 스타일 — 정적 공유물과 같은 모양.
const CSS = `
  .share-wrap { --ink:#1f2328; --muted:#8a8a8a; --accent:#b8430f; --line:#ececec;
    max-width:760px; margin:0 auto; padding:0 24px 88px; color:var(--ink);
    font-family:"Apple SD Gothic Neo","Pretendard","Malgun Gothic",sans-serif;
    line-height:1.62; font-size:16px; -webkit-text-size-adjust:100%; }
  .share-wrap .brandbar { display:flex; align-items:center; justify-content:space-between;
    padding:26px 0 22px; margin-bottom:30px; border-bottom:1px solid var(--line); }
  .share-wrap .brandbar .logo { height:30px; width:auto; display:block; }
  .share-wrap .role { font-size:12.5px; color:var(--muted); letter-spacing:0.2px; }
  .share-wrap h1 { font-size:30px; font-weight:800; line-height:1.3; letter-spacing:-0.5px; margin:0 0 6px; padding-bottom:18px; border-bottom:2.5px solid var(--ink); }
  .share-wrap h2 { font-size:21px; font-weight:800; letter-spacing:-0.3px; margin:42px 0 12px; padding-top:6px; }
  .share-wrap h3 { font-size:17px; font-weight:700; letter-spacing:-0.2px; margin:30px 0 8px; color:#111; }
  .share-wrap p { margin:7px 0; }
  .share-wrap strong { color:var(--accent); font-weight:700; }
  .share-wrap a { color:#0a66c2; text-decoration:none; }
  .share-wrap a:hover { text-decoration:underline; }
  .share-wrap code { background:#f3f3f3; padding:1px 6px; border-radius:5px; font-size:0.88em;
    font-family:"SFMono-Regular",ui-monospace,monospace; }
  .share-wrap hr { border:none; border-top:1px solid var(--line); margin:34px 0; }
  .share-wrap ul { margin:8px 0; padding-left:22px; } .share-wrap li { margin:2px 0; }
  .share-wrap blockquote { margin:18px 0; padding:14px 18px; background:#faf9f7; border-left:3px solid #c9742a;
    border-radius:0 8px 8px 0; color:#555; font-size:0.95em; }
  .share-wrap blockquote p { margin:4px 0; }
  .share-wrap table { border-collapse:collapse; width:100%; margin:18px 0; font-size:0.92em; }
  .share-wrap th,.share-wrap td { border:1px solid var(--line); padding:8px 11px; text-align:left; vertical-align:top; }
  .share-wrap th { background:#f7f7f7; font-weight:700; }
  .share-wrap .footer { margin-top:56px; padding-top:24px; border-top:1px solid var(--line);
    display:flex; align-items:center; gap:12px; }
  .share-wrap .footer .footer-logo { height:20px; width:auto; opacity:0.85; }
  .share-wrap .footer .meta { color:var(--muted); font-size:12.5px; margin:0; }
  @media (max-width:520px){ .share-wrap{padding:0 16px 64px;} .share-wrap h1{font-size:24px;} .share-wrap{font-size:15px;} }
`;
