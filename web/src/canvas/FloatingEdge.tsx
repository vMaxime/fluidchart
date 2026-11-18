import { BaseEdge, getStraightPath, useInternalNode, type EdgeProps, type InternalNode } from '@xyflow/react'
import type { ArrowFlowEdge } from './flowMapping'
import { floatingEndpoints, type Rect } from './edgeGeometry'

const toRect = (n: InternalNode): Rect => ({
  x: n.internals.positionAbsolute.x,
  y: n.internals.positionAbsolute.y,
  width: n.measured.width ?? 0,
  height: n.measured.height ?? 0,
})

/** Straight arrow between the borders of two notes, recomputed as they move or grow. */
export function FloatingEdge({ id, source, target, markerEnd, selected }: EdgeProps<ArrowFlowEdge>) {
  const s = useInternalNode(source)
  const t = useInternalNode(target)
  if (!s || !t) return null
  const { sx, sy, tx, ty } = floatingEndpoints(toRect(s), toRect(t))
  const [path] = getStraightPath({ sourceX: sx, sourceY: sy, targetX: tx, targetY: ty })
  return <BaseEdge id={id} path={path} markerEnd={markerEnd} className={selected ? 'arrow selected' : 'arrow'} />
}
