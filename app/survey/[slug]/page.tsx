// 설문 입력폼 페이지 — /survey/[slug]
// 로그인 없이 열린다(middleware 에서 survey 경로 제외). 공유 레지스트리에 등록된 마크다운 설문을
// 가져와 질문별 입력칸으로 렌더한다. 제출은 /api/survey → info@qnbang.com 메일.
// /share/<slug>(읽기전용)와 같은 원본을 쓰되, 이쪽은 "작성해서 보내는" 폼 버전.
import { notFound } from 'next/navigation';
import { getShareBySlug, healSharePath } from '@/lib/share';
import { getDoc, findDocByName } from '@/lib/github';
import type { Metadata } from 'next';
import SurveyForm, { type Block } from './SurveyForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getShareBySlug(slug);
  const title = entry?.title || '큐앤뱅 설문';
  const description = '큐앤뱅에서 보내드린 질문지입니다. 눌러서 작성해 주세요.';
  const image = 'https://dashboard.qnbang.com/share/qn-logo.png';
  return {
    title,
    description,
    openGraph: { title, description, siteName: '큐앤뱅', type: 'article', images: [image] },
    twitter: { card: 'summary', title, description, images: [image] },
  };
}

function stripMd(s: string): string {
  return s.replace(/\*\*/g, '').replace(/^>\s?/, '').replace(/`/g, '').trim();
}

// 마크다운 설문 → 블록 목록(섹션 제목 / 안내문 / 질문). 질문 = **로 시작하는 줄, 그 아래 안내는 힌트로 묶는다.
function parseSurvey(md: string): { title: string; blocks: Block[] } {
  const lines = md.split('\n');
  // 섹션(## …)이 있는 설문이면 질문은 섹션 '안'에만 있다고 본다. 머리말(받는 분·보내는 곳·안내문)이
  // **굵게** 라도 입력칸으로 오인되지 않게 한다. 섹션이 아예 없는 설문이면 모든 **줄을 질문으로.
  const hasSections = lines.some((l) => /^##\s/.test(l));
  let title = '설문';
  let i = 0;
  for (; i < lines.length; i++) {
    const m = lines[i].match(/^#\s+(.+)/);
    if (m) { title = m[1].trim(); i++; break; }
  }

  const blocks: Block[] = [];
  let qCount = 0;
  let inSection = false;
  let textBuf: string[] = [];
  const flushText = () => {
    const t = textBuf.join('\n').replace(/\*\*/g, '').replace(/`/g, '').trim();
    if (t) blocks.push({ kind: 'text', text: t });
    textBuf = [];
  };

  for (; i < lines.length; i++) {
    const line = lines[i];
    if (/^#\s/.test(line)) continue;                 // 남은 H1 무시
    const h2 = line.match(/^##\s+(.+)/);
    if (h2) { flushText(); inSection = true; blocks.push({ kind: 'h2', text: stripMd(h2[1]) }); continue; }

    if (line.trim().startsWith('**') && (!hasSections || inSection)) {
      flushText();
      const label = stripMd(line.trim());
      const hintLines: string[] = [];
      let j = i + 1;
      for (; j < lines.length; j++) {
        const l = lines[j];
        if (l.trim().startsWith('**') || /^#{1,2}\s/.test(l) || /^---/.test(l)) break;
        hintLines.push(l);
      }
      i = j - 1;
      qCount++;
      blocks.push({ kind: 'q', id: `q${qCount}`, label, hint: hintLines.map((l) => stripMd(l)).join('\n').trim() });
      continue;
    }

    if (/^---/.test(line)) { flushText(); continue; }
    textBuf.push(line);
  }
  flushText();
  return { title, blocks };
}

export default async function SurveyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = await getShareBySlug(slug);
  if (!entry) notFound();

  // 공유 페이지와 동일한 자동 경로복구 로직(폴더 이동돼도 링크 안 깨짐).
  let md = await getDoc(entry.repo, entry.path);
  if (md == null) {
    const base = entry.path.split('/').pop() || '';
    const newPath = await findDocByName(entry.repo, base);
    if (newPath) {
      md = await getDoc(entry.repo, newPath);
      if (md != null) await healSharePath(entry.repo, entry.path, newPath).catch(() => {});
    }
  }
  if (md == null) notFound();

  const { title, blocks } = parseSurvey(md);
  return <SurveyForm slug={slug} title={title} blocks={blocks} />;
}
