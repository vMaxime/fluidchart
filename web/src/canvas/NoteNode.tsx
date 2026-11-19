import { memo, useContext } from 'react'
import { Handle, NodeToolbar, Position, type NodeProps } from '@xyflow/react'
import DOMPurify from 'dompurify'
import { NOTE_COLORS } from '@chart/shared'
import { clearJournal, journalNoteHtml } from '../db/noteJournal'
import { updateNote } from '../db/repo'
import { trackWrite } from '../db/saveErrors'
import { CanvasContext } from './CanvasContext'
import type { Side } from './edgeGeometry'
import type { NoteFlowNode } from './flowMapping'
import { NoteEditor } from './NoteEditor'
import { NotePalette } from './NotePalette'

const cls = (...names: (string | false)[]) => names.filter(Boolean).join(' ')

const SIDES: { side: Side; label: string }[] = [
  { side: 'top', label: 'au-dessus' },
  { side: 'right', label: 'à droite' },
  { side: 'bottom', label: 'en dessous' },
  { side: 'left', label: 'à gauche' },
]

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
          noteColor={note.color}
          initialInput={ctx.initialInput}
          onDraft={(html) => journalNoteHtml(note.id, html)}
          onChange={(html) =>
            void trackWrite(updateNote(note.id, { html }).then(() => true)).then(
              (ok) => ok && clearJournal(note.id, html),
            )
          }
          onDone={ctx.stopEditing}
        />
      ) : (
        <div className="note-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(note.html) }} />
      )}
      {ctx.tool === 'select' &&
        !editing &&
        SIDES.map(({ side, label }) => (
          <button
            key={side}
            className={`knob knob-${side} nodrag nopan`}
            aria-label={`Nouveau post-it ${label}`}
            onPointerDown={(e) => ctx.startKnob(note.id, side, e)}
            // Keyboard activation (Enter/Space) has no pointer: grow directly.
            onClick={(e) => e.detail === 0 && ctx.growBeside(note.id, side)}
          >
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M6 2v8M2 6h8" />
            </svg>
          </button>
        ))}
      <NodeToolbar isVisible={ctx.paletteFor === note.id} position={Position.Top} offset={editing ? 10 : 40}>
        <NotePalette color={note.color} onPick={(c) => ctx.recolor(note.id, c)} />
      </NodeToolbar>
    </div>
  )
})
