'use client'

import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import type { JSONContent } from '@tiptap/react'

/** Sinyal untuk mengganti isi editor secara programatik (mis. hasil AI). */
export interface InjectSignal {
  text: string
  nonce: number // ubah nilai ini tiap kali ingin meng-inject (mis. Date.now())
}

interface Props {
  onChange: (json: JSONContent) => void
  disabled?: boolean
  inject?: InjectSignal | null
}

function ToolbarBtn({
  active,
  onClick,
  title,
  children,
  disabled,
}: {
  active?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`min-w-8 h-8 px-2 inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${
        active
          ? 'bg-brand text-white'
          : 'text-zinc-600 hover:bg-zinc-200/70'
      }`}
    >
      {children}
    </button>
  )
}

export default function WysiwygEditor({ onChange, disabled, inject }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Ketik pesan di sini...' }),
    ],
    immediatelyRender: true,
    editable: !disabled,
    onUpdate({ editor }) {
      onChange(editor.getJSON())
    },
  })

  // Terapkan teks dari luar (mis. hasil AI) ketika nonce berubah
  useEffect(() => {
    if (!editor || !inject) return
    const doc: JSONContent = {
      type: 'doc',
      content: inject.text.split('\n').map(line => ({
        type: 'paragraph',
        content: line ? [{ type: 'text', text: line }] : [],
      })),
    }
    editor.commands.setContent(doc)
    onChange(editor.getJSON())
    // hanya jalankan saat nonce berubah
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inject?.nonce])

  if (!editor) return null

  return (
    <div
      className={`border border-zinc-300 rounded-xl overflow-hidden bg-white transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10 ${
        disabled ? 'opacity-60' : ''
      }`}
    >
      <div className="flex gap-1 p-1.5 border-b border-zinc-200 bg-zinc-50/80 flex-wrap items-center">
        <ToolbarBtn
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold — WhatsApp: *teks*"
          disabled={disabled}
        >
          <strong>B</strong>
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic — WhatsApp: _teks_"
          disabled={disabled}
        >
          <em>I</em>
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough — WhatsApp: ~teks~"
          disabled={disabled}
        >
          <s>S</s>
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="Monospace — WhatsApp: ```teks```"
          disabled={disabled}
        >
          <span className="font-mono text-xs">&lt;/&gt;</span>
        </ToolbarBtn>
        <div className="w-px h-5 bg-zinc-200 mx-1" />
        <ToolbarBtn
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          title="Hapus semua formatting"
          disabled={disabled}
        >
          <span className="text-xs px-0.5">Bersihkan</span>
        </ToolbarBtn>
        <span className="ml-auto pr-1.5 text-xs text-zinc-400 tabular-nums">
          {editor.getText().length} karakter
        </span>
      </div>

      <EditorContent
        editor={editor}
        className="wysiwyg-editor p-3 min-h-[160px] text-sm"
      />
    </div>
  )
}
