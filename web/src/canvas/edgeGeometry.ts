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

export type Side = 'top' | 'right' | 'bottom' | 'left'

const NEW_W = 200 // DEFAULT_NOTE_WIDTH
const NEW_H = 80 // typical height of a fresh note
const GAP_X = 90
const GAP_Y = 56

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y

/**
 * Top-left corner for a note grown from `source` on `side` (the + knobs): beside it with a gap,
 * then slid along that side past any note already in the way.
 */
export function besidePosition(source: Rect, side: Side, others: Rect[]): { x: number; y: number } {
  const p = {
    right: { x: source.x + source.width + GAP_X, y: source.y },
    left: { x: source.x - GAP_X - NEW_W, y: source.y },
    bottom: { x: source.x + source.width / 2 - NEW_W / 2, y: source.y + source.height + GAP_Y },
    top: { x: source.x + source.width / 2 - NEW_W / 2, y: source.y - GAP_Y - NEW_H },
  }[side]
  for (let i = 0; i < 50; i++) {
    const blocker = others.find((o) => overlaps({ ...p, width: NEW_W, height: NEW_H }, o))
    if (!blocker) break
    if (side === 'left' || side === 'right') p.y = blocker.y + blocker.height + 20
    else p.x = blocker.x + blocker.width + 30
  }
  return p
}
