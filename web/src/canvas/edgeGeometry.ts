export type Rect = { x: number; y: number; width: number; height: number }
type Point = { x: number; y: number }

const centre = (r: Rect): Point => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 })

/** Where the segment from the rect's centre toward `toward` crosses the rect's border. */
export function borderPoint(rect: Rect, toward: Point): Point {
  const c = centre(rect)
  const dx = toward.x - c.x
  const dy = toward.y - c.y
  if (dx === 0 && dy === 0) return c
  const k = Math.min(
    dx === 0 ? Infinity : rect.width / 2 / Math.abs(dx),
    dy === 0 ? Infinity : rect.height / 2 / Math.abs(dy),
  )
  return { x: c.x + dx * k, y: c.y + dy * k }
}

/** Arrow endpoints on each rect's border, along the line joining their centres. */
export function floatingEndpoints(source: Rect, target: Rect): { sx: number; sy: number; tx: number; ty: number } {
  const s = borderPoint(source, centre(target))
  const t = borderPoint(target, centre(source))
  return { sx: s.x, sy: s.y, tx: t.x, ty: t.y }
}
