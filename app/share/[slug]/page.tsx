// 외부 공유 페이지 — /share/[slug]
// 로그인 없이 열린다(middleware 에서 share 경로 제외). 요청이 오면:
//  ① 공유 기록에서 slug 확인 → ② 공개면 원본 MD 를 GitHub 에서 가져와 ③ 읽기 좋게 렌더,
//  ④ 비공개(기록에 없음)면 404. 노션 "웹에 게시"와 같은 동작.
import { notFound } from 'next/navigation';
import { getShareBySlug, healSharePath } from '@/lib/share';
import { getDoc, findDocByName } from '@/lib/github';
import { isVirtualRepo, resolveVirtualDoc } from '@/lib/virtualDoc';
import { mdToHtml } from '@/lib/md';
import { SHARE_DOC_CSS } from '@/lib/shareDocCss';
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

  // 가상 좌표(@post/@sheet/@hub) = 저장소 파일이 아닌 게시판 글 → 현재 본문을 즉석에서 가져온다.
  let md: string | null;
  if (isVirtualRepo(entry.repo)) {
    md = await resolveVirtualDoc(entry.repo, entry.path);
  } else {
    // 저장된 경로로 먼저 시도. 폴더 이동 등으로 못 찾으면(=null) 파일명으로 새 위치를 찾아 복구하고,
    // 기록의 경로도 새 위치로 고쳐둔다(slug=링크는 그대로라 이미 보낸 링크가 안 깨진다).
    md = await getDoc(entry.repo, entry.path);
    if (md == null) {
      const base = entry.path.split('/').pop() || '';
      const newPath = await findDocByName(entry.repo, base);
      if (newPath) {
        md = await getDoc(entry.repo, newPath);
        // 서버리스에선 응답 후 함수가 멈출 수 있어 fire-and-forget이 누락된다 → await로 확실히 저장.
        if (md != null) await healSharePath(entry.repo, entry.path, newPath).catch(() => {});
      }
    }
  }
  if (md == null) notFound();

  const body = mdToHtml(md);

  return (
    <div style={{ background: '#ffffff' }}>
      <style>{SHARE_DOC_CSS}</style>
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

