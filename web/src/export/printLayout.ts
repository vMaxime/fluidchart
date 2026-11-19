/** Page layout of a board exported as PDF (all lengths in CSS px: 96 per inch). */

export type Box = { x: number; y: number; width: number; height: number }

const MM = 96 / 25.4
const PT = 4 / 3
const NORMAL_TEXT_PX = 14
/** The smallest text must stay at least this size on paper. */
const MIN_TEXT_PT = 8
/** Revision format: margin around the board. */
const REVISION_PAD = 32
/** Largest page a PDF allows: 200 inches. */
const MAX_PAGE_PX = 200 * 96
/** Printer format, A4 with 10mm margins and 8mm kept for the footer. */
const AREA = {
  portrait: { width: 190 * MM, height: 269 * MM },
  landscape: { width: 277 * MM, height: 182 * MM },
}
const OVERLAP = 10 * MM

export function boardBounds(rects: Box[]): Box {
  if (rects.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  const x = Math.min(...rects.map((r) => r.x))
  const y = Math.min(...rects.map((r) => r.y))
  const right = Math.max(...rects.map((r) => r.x + r.width))
  const bottom = Math.max(...rects.map((r) => r.y + r.height))
  return { x, y, width: right - x, height: bottom - y }
}

/** The smallest text size used on the board, in px (normal text is 14px). */
export function smallestTextPx(htmls: string[]): number {
  let smallest = NORMAL_TEXT_PX
  for (const html of htmls)
    for (const m of html.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) smallest = Math.min(smallest, Number(m[1]))
  return smallest
}

/** One page the size of the board plus a margin; a board beyond the PDF page limit is scaled down. */
export function revisionPage(bounds: Box): { width: number; height: number; scale: number } {
  const room = MAX_PAGE_PX - 2 * REVISION_PAD
  const scale = Math.min(1, room / Math.max(bounds.width, bounds.height, 1))
  return {
    width: bounds.width * scale + 2 * REVISION_PAD,
    height: bounds.height * scale + 2 * REVISION_PAD,
    scale,
  }
}

export type Orientation = 'portrait' | 'landscape'
export type PrinterLayout = {
  orientation: Orientation
  scale: number
  /** Usable area of one page (no margins, no footer). */
  area: { width: number; height: number }
  /** Top-left corner of each page, in scaled board px, row by row. */
  tiles: { x: number; y: number }[]
}

const ORIENTATIONS: Orientation[] = ['landscape', 'portrait']

/**
 * A4 pages: one page when the smallest text stays at least 8pt (never enlarged), otherwise tiles
 * at exactly that size, overlapping by 10mm, in the orientation that needs fewer pages.
 */
export function printerLayout(bounds: Box, smallestPx: number): PrinterLayout {
  const W = Math.max(bounds.width, 1)
  const H = Math.max(bounds.height, 1)
  /** Tie-break: follow the board's shape. */
  const byShape: Orientation = W > H ? 'landscape' : 'portrait'
  const minScale = (MIN_TEXT_PT * PT) / smallestPx

  const fit = (o: Orientation) => Math.min(1, AREA[o].width / W, AREA[o].height / H)
  const [l, p] = [fit('landscape'), fit('portrait')]
  const best: Orientation = l === p ? byShape : l > p ? 'landscape' : 'portrait'
  if (fit(best) >= minScale) return { orientation: best, scale: fit(best), area: AREA[best], tiles: [{ x: 0, y: 0 }] }

  const grid = (o: Orientation) => {
    const { width, height } = AREA[o]
    const count = (size: number, room: number) => Math.max(1, Math.ceil((size * minScale - OVERLAP) / (room - OVERLAP)))
    return { cols: count(W, width), rows: count(H, height) }
  }
  const pages = (o: Orientation) => grid(o).cols * grid(o).rows
  const [a, b] = ORIENTATIONS.map(pages)
  const orientation: Orientation = a === b ? byShape : a < b ? 'landscape' : 'portrait'
  const { cols, rows } = grid(orientation)
  const area = AREA[orientation]
  const tiles: { x: number; y: number }[] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) tiles.push({ x: c * (area.width - OVERLAP), y: r * (area.height - OVERLAP) })
  return { orientation, scale: minScale, area, tiles }
}
