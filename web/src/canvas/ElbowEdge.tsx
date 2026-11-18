import { BaseEdge, getSmoothStepPath, useInternalNode, type EdgeProps, type InternalNode } from '@xyflow/react'
import { sideAnchors, type Rect } from './edgeGeometry'
import type { ArrowFlowEdge } from './flowMapping'

const toRect = (n: InternalNode): Rect => ({
  x: n.internals.positionAbsolute.x,
  y: n.internals.positionAbsolute.y,
  width: n.measured.width ?? 0,
  height: n.measured.height ?? 0,
})

/** Right-angled arrow between the facing sides of two notes, recomputed as they move or grow. */
export function ElbowEdge({ id, source, target, markerEnd, selected }: EdgeProps<ArrowFlowEdge>) {
  const s = useInternalNode(source)
  const t = useInternalNode(target)
  if (!s || !t) return null
  const a = sideAnchors(toRect(s), toRect(t))
  const [path] = getSmoothStepPath({
    sourceX: a.sx,
    sourceY: a.sy,
    sourcePosition: a.sPos,
    targetX: a.tx,
    targetY: a.ty,
    targetPosition: a.tPos,
    borderRadius: 10,
    offset: 18,
  })
  return <BaseEdge id={id} path={path} markerEnd={markerEnd} className={selected ? 'arrow selected' : 'arrow'} />
}
