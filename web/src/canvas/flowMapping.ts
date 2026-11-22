import { MarkerType, type Edge, type Node } from '@xyflow/react'
import { ARROW_COLORS, DEFAULT_ARROW_COLOR, type Arrow, type ArrowColor, type Note } from '@chart/shared'

export type NoteFlowNode = Node<{ note: Note }, 'note'>
export type ArrowFlowEdge = Edge<{ color: ArrowColor }, 'curve'>

/**
 * Rebuild React Flow nodes from the db, keeping local-only UI state
 * (selection, measured size) and the live position of a node being dragged.
 */
export function mergeNodes(notes: Note[], current: NoteFlowNode[]): NoteFlowNode[] {
  const byId = new Map(current.map((n) => [n.id, n]))
  return notes.map((note) => {
    const prev = byId.get(note.id)
    // While being resized the node keeps its live size (the db still holds the old one).
    const live = prev?.resizing ? prev : undefined
    return {
      id: note.id,
      type: 'note',
      position: prev?.dragging ? prev.position : { x: note.x, y: note.y },
      width: live?.width ?? note.width,
      data: live ? live.data : { note },
      resizing: prev?.resizing,
      selected: prev?.selected ?? false,
      measured: prev?.measured,
      dragging: prev?.dragging,
    }
  })
}

export function mergeEdges(arrows: Arrow[], current: ArrowFlowEdge[]): ArrowFlowEdge[] {
  const byId = new Map(current.map((e) => [e.id, e]))
  return arrows.map((a) => {
    const color = a.color ?? DEFAULT_ARROW_COLOR
    return {
      id: a.id,
      source: a.from,
      target: a.to,
      type: 'curve',
      markerEnd: { type: MarkerType.ArrowClosed, color: ARROW_COLORS[color], width: 16, height: 16 },
      data: { color },
      selected: byId.get(a.id)?.selected ?? false,
    }
  })
}
