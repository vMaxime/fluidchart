import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useReactFlow, ViewportPortal, type XYPosition } from '@xyflow/react'
import type { Id } from '@chart/shared'

export type ArrowDrag = { from: Id; start: XYPosition; end: XYPosition; targetId: Id | null }

function noteAt(x: number, y: number, exclude: Id): Id | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const id = el.closest('.react-flow__node')?.getAttribute('data-id')
    if (id && id !== exclude) return id
  }
  return null
}

/** Arrow tool: press on a note, release on another. `onDrop` gets null when released elsewhere. */
export function useArrowDrag(onDrop: (from: Id, to: Id | null) => void) {
  const { screenToFlowPosition, getInternalNode } = useReactFlow()
  const [drag, setDrag] = useState<ArrowDrag | null>(null)
  const latest = useRef(onDrop)
  useEffect(() => {
    latest.current = onDrop
  })

  const start = useCallback(
    (from: Id, e: ReactPointerEvent) => {
      if (e.button !== 0) return
      e.stopPropagation()
      e.preventDefault()
      const n = getInternalNode(from)
      if (!n) return
      const begin = {
        x: n.internals.positionAbsolute.x + (n.measured.width ?? 0) / 2,
        y: n.internals.positionAbsolute.y + (n.measured.height ?? 0) / 2,
      }
      let targetId: Id | null = null
      const move = (ev: PointerEvent) => {
        targetId = noteAt(ev.clientX, ev.clientY, from)
        setDrag({ from, start: begin, end: screenToFlowPosition({ x: ev.clientX, y: ev.clientY }), targetId })
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        setDrag(null)
        latest.current(from, targetId)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [getInternalNode, screenToFlowPosition],
  )

  return { drag, start }
}

/** The arrow being drawn, in flow coordinates (render inside <ReactFlow>). */
export function ArrowPreview({ drag }: { drag: ArrowDrag | null }) {
  if (!drag) return null
  return (
    <ViewportPortal>
      <svg className="arrow-preview" width="1" height="1" aria-hidden="true">
        <line x1={drag.start.x} y1={drag.start.y} x2={drag.end.x} y2={drag.end.y} />
        <circle cx={drag.end.x} cy={drag.end.y} r={4} />
      </svg>
    </ViewportPortal>
  )
}
