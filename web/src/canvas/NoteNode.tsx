import { memo, useContext, useRef } from 'react'
import { Handle, NodeResizeControl, NodeToolbar, Position, type NodeProps } from '@xyflow/react'
import { NOTE_COLORS } from '@chart/shared'
import { clearJournal, journalNoteHtml } from '../db/noteJournal'
import { updateNote } from '../db/repo'
import { trackWrite } from '../db/saveErrors'
import { CanvasContext } from './CanvasContext'
import type { Side } from './edgeGeometry'
import type { NoteFlowNode } from './flowMapping'
import { NoteBody } from './NoteBody'
import { MAX_NOTE_WIDTH, MIN_NOTE_HEIGHT, MIN_NOTE_WIDTH } from '@chart/shared'
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
  const startHeight = useRef(0)
  // The height counts as changed only when the handle really moved it (a width-only drag keeps it).
  const sizeOf = (p: { width: number; height: number }) => ({
    width: p.width,
    height: Math.abs(p.height - startHeight.current) < 1 ? null : p.height,
  })
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
      style={{ background: NOTE_COLORS[note.color], minHeight: note.height }}
      onPointerDown={ctx.tool === 'arrow' ? (e) => ctx.startArrow(note.id, e) : undefined}
    >
      {/* Arrows are drawn from note geometry, but React Flow still expects a handle on each end. */}
      <Handle type="source" position={Position.Top} className="hidden-handle" isConnectable={false} />
      <Handle type="target" position={Position.Top} className="hidden-handle" isConnectable={false} />
      {editing ? (
        <NoteEditor
          html={note.html}
          noteColor={note.color}
          onNoteColor={(c) => ctx.recolor(note.id, c)}
          // While writing, the format bar takes the place of the colour palette, above the note.
          placeBar={(bar) => (
            <NodeToolbar isVisible position={Position.Top} offset={10}>
              {bar}
            </NodeToolbar>
          )}
          initialInput={ctx.initialInput}
          onDraft={(html) => journalNoteHtml(note.id, html)}
          onChange={(html) =>
            void trackWrite(updateNote(note.id, { html }).then(() => true)).then(
              (ok) => ok && clearJournal(note.id, html),
            )
          }
          onDone={(finalHtml) => ctx.stopEditing(finalHtml, note.id)}
        />
      ) : (
        <NoteBody html={note.html} />
      )}
      {selected && !editing && ctx.tool === 'select' && (
        <NodeResizeControl
          className="note-resize nodrag nopan"
          position="bottom-right"
          minWidth={MIN_NOTE_WIDTH}
          maxWidth={MAX_NOTE_WIDTH}
          minHeight={MIN_NOTE_HEIGHT}
          onResizeStart={(_e, p) => (startHeight.current = p.height)}
          onResize={(_e, p) => ctx.resizing(note.id, sizeOf(p))}
          onResizeEnd={(_e, p) => ctx.resized(note.id, sizeOf(p))}
        >
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <path d="M9 3 3 9M9 6.5 6.5 9" />
          </svg>
        </NodeResizeControl>
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
      <NodeToolbar isVisible={ctx.paletteFor === note.id && !editing} position={Position.Top} offset={40}>
        <NotePalette color={note.color} onPick={(c) => ctx.recolor(note.id, c)} />
      </NodeToolbar>
    </div>
  )
})
