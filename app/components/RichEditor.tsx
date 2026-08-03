'use client';

// 노션식 리치 에디터 — 마크다운 기호 없이 보이는 대로 편집. 저장은 마크다운으로 변환(tiptap-markdown).
// 산출물 문서 편집(사무실 패널)에서 사용. dynamic import(ssr:false)로 로드.
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import { Markdown } from 'tiptap-markdown';
import { useEffect } from 'react';

export default function RichEditor({ value, onChange }: { value: string; onChange: (md: string) => void }) {
  const editor = useEditor({
    // TableKit 없으면 마크다운 표가 글자로 풀려 저장 시 원본이 깨진다.
    extensions: [StarterKit, TableKit.configure({ table: { resizable: false } }), Markdown.configure({ html: false, transformPastedText: true })],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange((editor.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown()),
  });

  // 로드 완료 후 문서 내용 주입(초기 value가 fetch로 늦게 오는 경우)
  useEffect(() => {
    if (editor && value && editor.isEmpty) editor.commands.setContent(value);
  }, [editor, value]);

  if (!editor) return <div style={{ flex: 1, padding: 16, color: '#999' }}>편집기 불러오는 중…</div>;

  const B = ({ on, act, label }: { on: boolean; act: () => void; label: string }) => (
    <button type="button" onMouseDown={(e) => { e.preventDefault(); act(); }}
      style={{ border: 0, background: on ? '#e7e7f6' : 'transparent', color: on ? '#4545da' : '#444', borderRadius: 6, padding: '5px 9px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', padding: '8px 12px', borderBottom: '1px solid #eee' }}>
        <B on={editor.isActive('heading', { level: 1 })} act={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} label="제목1" />
        <B on={editor.isActive('heading', { level: 2 })} act={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label="제목2" />
        <B on={editor.isActive('bold')} act={() => editor.chain().focus().toggleBold().run()} label="굵게" />
        <B on={editor.isActive('italic')} act={() => editor.chain().focus().toggleItalic().run()} label="기울임" />
        <B on={editor.isActive('bulletList')} act={() => editor.chain().focus().toggleBulletList().run()} label="• 목록" />
        <B on={editor.isActive('orderedList')} act={() => editor.chain().focus().toggleOrderedList().run()} label="1. 목록" />
        <B on={editor.isActive('blockquote')} act={() => editor.chain().focus().toggleBlockquote().run()} label="인용" />
        <B on={editor.isActive('codeBlock')} act={() => editor.chain().focus().toggleCodeBlock().run()} label="코드" />
        <B on={editor.isActive('table')} act={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} label="표" />
        {editor.isActive('table') && (<>
          <B on={false} act={() => editor.chain().focus().addRowAfter().run()} label="행+" />
          <B on={false} act={() => editor.chain().focus().addColumnAfter().run()} label="열+" />
          <B on={false} act={() => editor.chain().focus().deleteTable().run()} label="표 삭제" />
        </>)}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <EditorContent editor={editor} className="rich-body" />
      </div>
      <style>{`
        .rich-body .ProseMirror { min-height:100%; padding:18px 22px; outline:none; font-size:15px; line-height:1.7; color:#1d2138; }
        .rich-body .ProseMirror h1 { font-size:24px; font-weight:800; margin:18px 0 10px; }
        .rich-body .ProseMirror h2 { font-size:19px; font-weight:800; margin:16px 0 8px; }
        .rich-body .ProseMirror h3 { font-size:16px; font-weight:700; margin:14px 0 6px; }
        .rich-body .ProseMirror p { margin:8px 0; }
        .rich-body .ProseMirror ul, .rich-body .ProseMirror ol { padding-left:22px; margin:8px 0; }
        .rich-body .ProseMirror li { margin:3px 0; }
        .rich-body .ProseMirror blockquote { border-left:3px solid #ddd; padding-left:12px; color:#666; margin:10px 0; }
        .rich-body .ProseMirror pre { background:#f4f4f6; border-radius:8px; padding:12px 14px; font-size:13px; overflow:auto; }
        .rich-body .ProseMirror code { background:#f0f0f4; padding:1px 5px; border-radius:4px; font-size:.9em; }
        .rich-body .ProseMirror table { border-collapse:collapse; width:100%; margin:12px 0; table-layout:fixed; }
        .rich-body .ProseMirror th, .rich-body .ProseMirror td { border:1px solid #dcdce4; padding:7px 10px; vertical-align:top; }
        .rich-body .ProseMirror th { background:#f5f5f9; font-weight:700; text-align:left; }
        .rich-body .ProseMirror .selectedCell:after { content:''; position:absolute; inset:0; background:#4545da1a; pointer-events:none; }
        .rich-body .ProseMirror td, .rich-body .ProseMirror th { position:relative; }
      `}</style>
    </div>
  );
}
