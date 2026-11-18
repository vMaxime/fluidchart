import { memo, useContext } from 'react'
import { Handle, NodeToolbar, Position, type NodeProps } from '@xyflow/react'
import DOMPurify from 'dompurify'
import { NOTE_COLORS } from '@chart/shared'
import { clearJournal, journalNoteHtml } from '../db/noteJournal'
import { updateNote } from '../db/repo'
import { trackWrite } from '../db/saveErrors'
import { CanvasContext } from './CanvasContext'
import type { NoteFlowNode } from './flowMapping'
import { NoteEditor } from './NoteEditor'
import { NotePalette } from './NotePalette'

const cls = (...names: (string | false)[]) => names.filter(Boolean).join(' ')

export const NoteNode = memo(function NoteNode({ data, selected }: NodeProps<NoteFlowNode>) {
  const { note } = data
  const ctx = useContext(CanvasContext)
  const editing = ctx.editingId === note.id
  return (
    <div
      className={cls(
        'note',
        selected && 'selected',
        ctx.arrowTarget === note.id && 'arrow-target',
        ctx.freshIds.has(note.id) && 'note-in',
      )}
      data-testid="note"
      data-color={note.color}
      style={{ background: NOTE_COLORS[note.color] }}
      onPointerDown={ctx.tool === 'arrow' ? (e) => ctx.startArrow(note.id, e) : undefined}
    >
      {/* Arrows are drawn from note geometry, but React Flow still expects a handle on each end. */}
      <Handle type="source" position={Position.Top} className="hidden-handle" isConnectable={false} />
      <Handle type="target" position={Position.Top} className="hidden-handle" isConnectable={false} />
      {editing ? (
        <NoteEditor
          html={note.html}
          initialInput={ctx.initialInput}
          onDraft={(html) => journalNoteHtml(note.id, html)}
          onChange={(html) =>
            void trackWrite(updateNote(note.id, { html }).then(() => true)).then((ok) => ok && clearJournal(note.id, html))
          }
          onDone={ctx.stopEditing}
        />
      ) : (
        <div className="note-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(note.html) }} />
      )}
      <NodeToolbar isVisible={ctx.paletteFor === note.id} position={Position.Top} offset={10}>
        <NotePalette color={note.color} onPick={(c) => ctx.recolor(note.id, c)} />
      </NodeToolbar>
    </div>
  )
})
