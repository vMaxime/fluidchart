import { useContext } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useInternalNode,
  type EdgeProps,
  type InternalNode,
} from '@xyflow/react'
import { ARROW_COLORS, DEFAULT_ARROW_COLOR } from '@chart/shared'
import { ArrowPalette } from './ArrowPalette'
import { CanvasContext } from './CanvasContext'
import { sideAnchors, type Rect } from './edgeGeometry'
import type { ArrowFlowEdge } from './flowMapping'

const toRect = (n: InternalNode): Rect => ({
  x: n.internals.positionAbsolute.x,
  y: n.internals.positionAbsolute.y,
  width: n.measured.width ?? 0,
  height: n.measured.height ?? 0,
})

/**
 * Smooth curved arrow between the facing sides of two notes, recomputed as they move or grow.
 * When it is the only thing selected, its colour palette floats above its middle.
 */
export function CurveEdge({ id, source, target, markerEnd, selected, data }: EdgeProps<ArrowFlowEdge>) {
  const ctx = useContext(CanvasContext)
  const s = useInternalNode(source)
  const t = useInternalNode(target)
  if (!s || !t) return null
  const a = sideAnchors(toRect(s), toRect(t))
  const [path, labelX, labelY] = getBezierPath({
    sourceX: a.sx,
    sourceY: a.sy,
    sourcePosition: a.sPos,
    targetX: a.tx,
    targetY: a.ty,
    targetPosition: a.tPos,
  })
  const color = data?.color ?? DEFAULT_ARROW_COLOR
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        className={selected ? 'arrow selected' : 'arrow'}
        style={{ stroke: ARROW_COLORS[color] }}
      />
      {ctx.arrowPaletteFor === id && (
        <EdgeLabelRenderer>
          <div
            className="arrow-palette-anchor nodrag nopan"
            style={{ transform: `translate(-50%, -100%) translate(${labelX}px, ${labelY - 12}px)` }}
          >
            <ArrowPalette color={color} onPick={(c) => ctx.recolorArrow(id, c)} />
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
