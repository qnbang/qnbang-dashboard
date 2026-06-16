// 마크다운 → 읽기 좋은 HTML 문자열 변환 (서버 전용, 의존성 없음).
// .tools/md-읽기페이지/변환.mjs 의 렌더 로직을 포팅한 것 — 공유 페이지(/share/[slug])가
// 정적 변환기와 똑같은 모양으로 보이도록 같은 문법(제목·목록·표·인용·구분선·굵게·링크·코드)을 처리한다.

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 인라인 서식: 굵게 · 링크 · 코드 · 기울임
function inline(s: string): string {
  s = esc(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
  return s;
}

// 블록 단위 변환 → HTML 본문 문자열
export function mdToHtml(src: string): string {
  const lines = src.replace(/\r/g, '').split('\n');
  let html = '';
  let i = 0;
  let inList = false;
  let inQuote = false;
  const closeList = () => { if (inList) { html += '</ul>\n'; inList = false; } };
  const closeQuote = () => { if (inQuote) { html += '</blockquote>\n'; inQuote = false; } };
  const isTableSep = (l: string) => /^\s*\|?[\s:|-]+\|?\s*$/.test(l) && l.includes('-');

  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) { closeList(); closeQuote(); i++; continue; }
    if (/^---+\s*$/.test(line)) { closeList(); closeQuote(); html += '<hr>\n'; i++; continue; }

    // 표
    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      closeList(); closeQuote();
      const cells = (l: string) =>
        l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
      const head = cells(line);
      i += 2;
      html += '<table><thead><tr>' + head.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>';
      while (i < lines.length && lines[i].includes('|') && !/^\s*$/.test(lines[i])) {
        const row = cells(lines[i]);
        html += '<tr>' + row.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>';
        i++;
      }
      html += '</tbody></table>\n';
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) { closeList(); closeQuote(); html += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>\n`; i++; continue; }

    if (/^\s*>\s?/.test(line)) {
      closeList();
      if (!inQuote) { html += '<blockquote>\n'; inQuote = true; }
      html += `<p>${inline(line.replace(/^\s*>\s?/, ''))}</p>\n`; i++; continue;
    }

    const li = line.match(/^\s*[-*]\s+(.+)$/);
    if (li) { closeQuote(); if (!inList) { html += '<ul>\n'; inList = true; } html += `<li>${inline(li[1])}</li>\n`; i++; continue; }

    closeList(); closeQuote();
    html += `<p>${inline(line)}</p>\n`; i++;
  }
  closeList(); closeQuote();
  return html;
}

// 첫 H1 을 문서 제목으로 (없으면 빈 문자열)
export function firstHeading(src: string): string {
  const m = src.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : '';
}
