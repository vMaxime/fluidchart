import { memo, useContext } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import DOMPurify from 'dompurify'
import { NOTE_COLORS } from '@chart/shared'
import { clearJournal, journalNoteHtml } from '../db/noteJournal'
import { updateNote } from '../db/repo'
import { trackWrite } from '../db/saveErrors'
import { CanvasContext } from './CanvasContext'
import type { NoteFlowNode } from './flowMapping'
import { NoteEditor } from './NoteEditor'

const SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left]

export const NoteNode = memo(function NoteNode({ data, selected }: NodeProps<NoteFlowNode>) {
  const { note } = data
  const { editingId, stopEditing } = useContext(CanvasContext)
  const editing = editingId === note.id
  return (
    <div
      className={selected ? 'note selected' : 'note'}
      data-testid="note"
      data-color={note.color}
      style={{ background: NOTE_COLORS[note.color] }}
    >
      {SIDES.map((side) => (
        <Handle key={side} id={side} type="source" position={side} />
      ))}
      {editing ? (
        <NoteEditor
          html={note.html}
          onDraft={(html) => journalNoteHtml(note.id, html)}
          onChange={(html) =>
            void trackWrite(updateNote(note.id, { html }).then(() => true)).then(
              (ok) => ok && clearJournal(note.id, html),
            )
          }
          onDone={stopEditing}
        />
      ) : (
        <div className="note-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(note.html) }} />
      )}
    </div>
  )
})
