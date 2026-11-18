import { useEffect, useMemo, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { createDebouncer } from '../lib/debounce'
import { useFlushOnHide } from '../lib/useFlushOnHide'

const SAVE_DELAY_MS = 400

type Props = {
  html: string
  /** Debounced save. */
  onChange(html: string): void
  /** Called synchronously on every edit, for the crash-safe journal. */
  onDraft?(html: string): void
  onDone(): void
}

/** Rich-text editor shown inside a note while it is being edited. Saves as you type. */
export function NoteEditor({ html, onChange, onDraft, onDone }: Props) {
  const callbacks = useRef({ onChange, onDraft, onDone })
  useEffect(() => {
    callbacks.current = { onChange, onDraft, onDone }
  })
  const debouncer = useMemo(() => createDebouncer<string>((v) => callbacks.current.onChange(v), SAVE_DELAY_MS), [])
  const finished = useRef(false)
  const finish = () => {
    debouncer.flush()
    if (finished.current) return
    finished.current = true
    callbacks.current.onDone()
  }

  const editor = useEditor({
    extensions: [StarterKit],
    content: html,
    editorProps: {
      attributes: { role: 'textbox', 'aria-label': 'Texte du post-it', 'aria-multiline': 'true' },
      handleKeyDown: (_view, event) => {
        if (event.key !== 'Escape') return false
        finish()
        return true
      },
    },
    onUpdate: ({ editor }) => {
      const next = editor.getHTML()
      callbacks.current.onDraft?.(next)
      debouncer.call(next)
    },
    onBlur: () => finish(),
  })

  // React Flow renders a new node with `visibility: hidden` until it is measured, and a hidden
  // element cannot take focus: retry on each frame until the editor really has focus (bounded).
  useEffect(() => {
    if (!editor) return
    let frame = 0
    let tries = 0
    const tryFocus = () => {
      if (editor.isDestroyed || editor.view.hasFocus()) return
      editor.commands.focus('end')
      if (!editor.view.hasFocus() && ++tries < 60) frame = requestAnimationFrame(tryFocus)
    }
    tryFocus()
    return () => cancelAnimationFrame(frame)
  }, [editor])

  useFlushOnHide(debouncer.flush)
  useEffect(() => () => debouncer.flush(), [debouncer])

  return (
    <div className="note-editor nodrag nopan nowheel">
      <EditorContent editor={editor} />
    </div>
  )
}
