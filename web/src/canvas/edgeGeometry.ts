import { Position } from '@xyflow/react'

export type Rect = { x: number; y: number; width: number; height: number }

const centre = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 })

/**
 * Attach an elbow arrow to the facing sides of two notes: left/right when the target is
 * mostly beside the source, top/bottom when it is mostly above or below.
 */
export function sideAnchors(s: Rect, t: Rect) {
  const sc = centre(s)
  const tc = centre(t)
  const dx = tc.x - sc.x
  const dy = tc.y - sc.y
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0
      ? { sx: s.x + s.width, sy: sc.y, sPos: Position.Right, tx: t.x, ty: tc.y, tPos: Position.Left }
      : { sx: s.x, sy: sc.y, sPos: Position.Left, tx: t.x + t.width, ty: tc.y, tPos: Position.Right }
  }
  return dy > 0
    ? { sx: sc.x, sy: s.y + s.height, sPos: Position.Bottom, tx: tc.x, ty: t.y, tPos: Position.Top }
    : { sx: sc.x, sy: s.y, sPos: Position.Top, tx: tc.x, ty: t.y + t.height, tPos: Position.Bottom }
}
