import { useEffect, useMemo, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import type { NoteColor } from '@chart/shared'
import { createDebouncer } from '../lib/debounce'
import { useFlushOnHide } from '../lib/useFlushOnHide'
import { noteEditorExtensions } from './editorExtensions'
import { FormatControls } from './FormatControls'
import './format.css'

const SAVE_DELAY_MS = 400

const stillEditing = (next: EventTarget | null) =>
  next instanceof Element && !!next.closest('.format-menu, .note-palette')

type Props = {
  html: string
  /** Debounced save. */
  onChange(html: string): void
  /** Called synchronously on every edit, for the crash-safe journal. */
  onDraft?(html: string): void
  /** Called once when editing ends, with the final html. */
  onDone(html: string): void
  /** Text typed on a selected note before the editor opened (type-to-edit): appended once focused. */
  initialInput?: string
  /** The note's background, for the "Déjà utilisées" colours. */
  noteColor?: NoteColor
}

/** Rich-text editor shown inside a note while it is being edited. Saves as you type. */
export function NoteEditor({ html, onChange, onDraft, onDone, initialInput, noteColor = 'yellow' }: Props) {
  const callbacks = useRef({ onChange, onDraft, onDone })
  useEffect(() => {
    callbacks.current = { onChange, onDraft, onDone }
  })
  const debouncer = useMemo(() => createDebouncer<string>((v) => callbacks.current.onChange(v), SAVE_DELAY_MS), [])
  const finished = useRef(false)
  const lastHtml = useRef(html)
  const finish = () => {
    debouncer.flush()
    if (finished.current) return
    finished.current = true
    callbacks.current.onDone(lastHtml.current)
  }

  const editor = useEditor({
    extensions: noteEditorExtensions,
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
      lastHtml.current = next
      callbacks.current.onDraft?.(next)
      debouncer.call(next)
    },
    // Focus moving into the format bar (or the note's colour palette) is not leaving the note.
    // The window losing focus (macOS colour panel, switching apps) is not leaving the note either.
    onBlur: ({ event }) => {
      if (!document.hasFocus() || stillEditing((event as FocusEvent).relatedTarget)) return
      finish()
    },
  })

  // React Flow renders a new node with `visibility: hidden` until it is measured, and a hidden
  // element cannot take focus: retry on each frame until the editor really has focus (bounded).
  useEffect(() => {
    if (!editor) return
    let frame = 0
    let tries = 0
    let inserted = false
    const tryFocus = () => {
      if (editor.isDestroyed) return
      if (!editor.view.hasFocus()) editor.commands.focus('end')
      if (editor.view.hasFocus()) {
        if (initialInput && !inserted) {
          inserted = true
          editor.commands.insertContent(initialInput)
        }
        return
      }
      if (++tries < 60) frame = requestAnimationFrame(tryFocus)
    }
    tryFocus()
    return () => cancelAnimationFrame(frame)
    // initialInput is read once, when the editor opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  useFlushOnHide(debouncer.flush)
  // However the editor goes away, report the final text once (one undo step per writing session).
  useEffect(
    () => () => {
      debouncer.flush()
      if (finished.current) return
      finished.current = true
      callbacks.current.onDone(lastHtml.current)
    },
    [debouncer],
  )

  return (
    <div className="note-editor nodrag nopan nowheel">
      <EditorContent editor={editor} />
      {editor && (
        <BubbleMenu
          editor={editor}
          className="format-menu nodrag nopan"
          appendTo={() => document.body}
          options={{ placement: 'bottom', offset: 10, strategy: 'fixed' }}
          onBlur={(e) => {
            // TipTap wraps the event: read the native one (its relatedTarget getter throws on the wrapper).
            const next = (e.nativeEvent as FocusEvent).relatedTarget
            if (!document.hasFocus() || stillEditing(next) || editor.view.dom.contains(next as Node | null)) return
            finish()
          }}
        >
          <FormatControls editor={editor} noteColor={noteColor} />
        </BubbleMenu>
      )}
    </div>
  )
}
