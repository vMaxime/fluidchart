import { useEffect, useMemo, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { createDebouncer } from '../lib/debounce'
import { useFlushOnHide } from '../lib/useFlushOnHide'

const SAVE_DELAY_MS = 400

type Props = { html: string; onChange(html: string): void; onDone(): void }

/** Rich-text editor shown inside a note while it is being edited. Saves as you type. */
export function NoteEditor({ html, onChange, onDone }: Props) {
  const callbacks = useRef({ onChange, onDone })
  useEffect(() => {
    callbacks.current = { onChange, onDone }
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
    onUpdate: ({ editor }) => debouncer.call(editor.getHTML()),
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
