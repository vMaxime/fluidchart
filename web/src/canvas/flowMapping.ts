import { MarkerType, type Edge, type Node } from '@xyflow/react'
import type { Arrow, Note } from '@chart/shared'

export type NoteFlowNode = Node<{ note: Note }, 'note'>
export type ArrowFlowEdge = Edge<Record<string, never>, 'curve'>

/** Stone-500: soft like the Flux prototype, still readable on the light canvas. */
export const ARROW_COLOR = '#78716c'

/**
 * Rebuild React Flow nodes from the db, keeping local-only UI state
 * (selection, measured size) and the live position of a node being dragged.
 */
export function mergeNodes(notes: Note[], current: NoteFlowNode[]): NoteFlowNode[] {
  const byId = new Map(current.map((n) => [n.id, n]))
  return notes.map((note) => {
    const prev = byId.get(note.id)
    return {
      id: note.id,
      type: 'note',
      position: prev?.dragging ? prev.position : { x: note.x, y: note.y },
      width: note.width,
      data: { note },
      selected: prev?.selected ?? false,
      measured: prev?.measured,
      dragging: prev?.dragging,
    }
  })
}

export function mergeEdges(arrows: Arrow[], current: ArrowFlowEdge[]): ArrowFlowEdge[] {
  const byId = new Map(current.map((e) => [e.id, e]))
  return arrows.map((a) => ({
    id: a.id,
    source: a.from,
    target: a.to,
    type: 'curve',
    markerEnd: { type: MarkerType.ArrowClosed, color: ARROW_COLOR, width: 16, height: 16 },
    selected: byId.get(a.id)?.selected ?? false,
  }))
}
