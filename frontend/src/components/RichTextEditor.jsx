import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Underline } from '@tiptap/extension-underline'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { useEffect, useRef } from 'react'

const PRESET_COLORS = ['#191e5c', '#DC2626', '#D97706', '#16A34A', '#2563EB', '#7C3AED', '#000000', '#6B7280']

export default function RichTextEditor({ value = '', onChange, placeholder = 'Write something…', minHeight = 100 }) {
  const isInternalUpdate = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      isInternalUpdate.current = true
      onChange?.(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'rich-editor-content',
        style: `min-height:${minHeight}px`,
      },
    },
  })

  // Sync value from outside (e.g. when modal re-opens with new content)
  useEffect(() => {
    if (!editor) return
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false
      return
    }
    const current = editor.getHTML()
    if (current !== value) {
      editor.commands.setContent(value || '', false)
    }
  }, [value, editor])

  if (!editor) return null

  const ToolbarBtn = ({ onClick, active, title, children }) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      className={`rich-toolbar-btn${active ? ' active' : ''}`}
      title={title}
    >
      {children}
    </button>
  )

  return (
    <div className="rich-editor-wrap">
      <div className="rich-toolbar">
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold"
        >
          <strong>B</strong>
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic"
        >
          <em>I</em>
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title="Underline"
        >
          <span style={{ textDecoration: 'underline' }}>U</span>
        </ToolbarBtn>
        <div className="rich-toolbar-sep" />
        <div className="rich-color-wrap" title="Font color">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setColor(c).run() }}
              className={`rich-color-dot${editor.isActive('textStyle', { color: c }) ? ' active' : ''}`}
              style={{ background: c }}
              title={c}
            />
          ))}
          <label className="rich-color-picker-wrap" title="Custom color">
            <span style={{ fontSize: 14, color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1 }}>⊕</span>
            <input
              type="color"
              style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}
              onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            />
          </label>
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
