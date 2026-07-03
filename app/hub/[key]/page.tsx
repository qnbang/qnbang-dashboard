// 협업 허브 (외부 공개) — 현황판.md(SSOT)를 읽어 작업순서를 동적으로 표시한다.
// 메인 대시보드 진행현황도 같은 현황판.md를 보므로 둘이 항상 동기화된다.
import { notFound } from 'next/navigation';
import { getDoc } from '@/lib/github';
import { HUB } from '@/lib/hubs';
import HubView, { type Section } from './HubView';

export const dynamic = 'force-dynamic';

// 현황판.md 파싱 — ## 단계 + 체크박스(- [x]/[ ]/[~]) + [담당] 태그
function parseStatus(md: string): { sections: Section[]; done: number; total: number } {
  const lines = md.split('\n');
  const sections: Section[] = [];
  let cur: Section | null = null;
  let done = 0, total = 0;
  for (const line of lines) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) { if (cur) sections.push(cur); cur = { name: h[1], items: [] }; continue; }
    const m = line.match(/^\s*[-*]\s*\[([ xX~-])\]\s*(.+)$/);
    if (m && cur) {
      const mark = m[1].toLowerCase();
      const state: Section['items'][number]['state'] = mark === 'x' ? 'done' : (mark === '~' || mark === '-') ? 'wait' : 'todo';
      let text = m[2].trim(); let who = '';
      // 담당 태그 = 줄 앞 [한글/영문 2~6자] — 특정 회사명 하드코딩 없이 사례별 담당(큐앤뱅·상인회·협의 등) 인식
      const w = text.match(/^\[([가-힣A-Za-z]{2,6})\]\s*/);
      if (w) { who = w[1]; text = text.slice(w[0].length); }
      cur.items.push({ state, who, text });
      total++; if (state === 'done') done++;
    }
  }
  if (cur) sections.push(cur);
  return { sections, done, total };
}

export default async function HubPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const cfg = HUB[key];
  if (!cfg) notFound();
  const md = cfg.statusRepo ? await getDoc(cfg.statusRepo, cfg.statusPath || '현황판.md') : '';
  const { sections, done, total } = parseStatus(md || '');
  return <HubView hubKey={key} cfg={cfg} sections={sections} done={done} total={total} />;
}
