import React from 'react';

// 인라인: **굵게** `코드` [링크](url)
function inlineHtml(s: string): string {
  let h = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  h = h
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="px-1 bg-slate-100 rounded text-[0.85em]">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="text-indigo-600 underline">$1</a>');
  return h;
}

// 마크다운 문서를 읽기 좋게 렌더 (제목·목록·표·인용·구분선)
export function renderMarkdown(md: string): React.ReactNode[] {
  const lines = (md || '').split('\n');
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const head = line.split('|').slice(1, -1).map((c) => c.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()));
        i++;
      }
      out.push(
        <div key={key++} className="overflow-x-auto my-3">
          <table className="text-sm border-collapse">
            <thead>
              <tr>{head.map((h, j) => <th key={j} className="border border-slate-200 bg-slate-50 px-2 py-1 text-left font-semibold text-slate-600" dangerouslySetInnerHTML={{ __html: inlineHtml(h) }} />)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} className="border border-slate-200 px-2 py-1 text-slate-700" dangerouslySetInnerHTML={{ __html: inlineHtml(c) }} />)}</tr>)}
            </tbody>
          </table>
        </div>
      );
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^(#{1,6})/)![1].length;
      const text = line.replace(/^#{1,6}\s/, '');
      const cls = level <= 1 ? 'text-lg font-bold text-slate-800 mt-4 mb-2'
        : level === 2 ? 'text-base font-bold text-indigo-700 mt-4 mb-1'
        : 'text-sm font-semibold text-slate-700 mt-3 mb-1';
      out.push(<p key={key++} className={cls} dangerouslySetInnerHTML={{ __html: inlineHtml(text) }} />);
      i++; continue;
    }
    if (/^---+\s*$/.test(line)) { out.push(<hr key={key++} className="my-3 border-slate-100" />); i++; continue; }
    if (/^>\s?/.test(line)) {
      out.push(<blockquote key={key++} className="border-l-2 border-slate-200 pl-3 my-2 text-slate-500 text-sm" dangerouslySetInnerHTML={{ __html: inlineHtml(line.replace(/^>\s?/, '')) }} />);
      i++; continue;
    }
    if (/^\s*([-*]|\d+\.)\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s/, ''));
        i++;
      }
      out.push(
        <ul key={key++} className="list-disc pl-5 my-2 space-y-1">
          {items.map((it, j) => <li key={j} className="text-sm text-slate-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineHtml(it) }} />)}
        </ul>
      );
      continue;
    }
    if (line.trim() === '') { i++; continue; }
    out.push(<p key={key++} className="text-sm text-slate-600 leading-relaxed my-1.5" dangerouslySetInnerHTML={{ __html: inlineHtml(line) }} />);
    i++;
  }
  return out;
}
