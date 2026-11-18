import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import DOMPurify from 'dompurify'
import { NOTE_COLORS } from '@chart/shared'
import type { NoteFlowNode } from './flowMapping'

const SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left]

export const NoteNode = memo(function NoteNode({ data, selected }: NodeProps<NoteFlowNode>) {
  const { note } = data
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
      <div className="note-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(note.html) }} />
    </div>
  )
})
