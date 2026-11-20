import { getBezierPath } from '@xyflow/react'
import { ARROW_COLOR_ORDER, ARROW_COLORS, DEFAULT_ARROW_COLOR, NOTE_COLORS, type Arrow, type Note } from '@chart/shared'
import { NoteBody } from '../canvas/NoteBody'
import { sideAnchors } from '../canvas/edgeGeometry'
import { boardBounds, printerLayout, revisionPage, smallestTextPx, type Box } from './printLayout'
import './print.css'

export type PrintNote = { note: Note; height: number }
export type PrintFormat = 'revision' | 'printer'

const MM = 96 / 25.4
const FOOTER = 8 * MM
/** Printer pages stay 1mm short of the printable height: no rounding can spill a blank page. */
const SAFETY = 1 * MM
const PAD = 32

const rectOf = ({ note, height }: PrintNote): Box => ({ x: note.x, y: note.y, width: note.width, height })
const boundsOf = (notes: PrintNote[]) => boardBounds(notes.map(rectOf))

/** The @page rule for this export: the board's own size, or A4 in the orientation chosen. */
export function pageRule(format: PrintFormat, notes: PrintNote[]): string {
  const bounds = boundsOf(notes)
  if (format === 'revision') {
    const page = revisionPage(bounds)
    return `@page { size: ${Math.ceil(page.width)}px ${Math.ceil(page.height)}px; margin: 0 }`
  }
  const { orientation } = printerLayout(bounds, smallestTextPx(notes.map((n) => n.note.html)))
  return `@page { size: A4 ${orientation}; margin: 10mm }`
}

/** The whole board in its own coordinates (top-left of its bounds at 0, 0): notes, then arrows. */
function Drawing({ notes, arrows, bounds }: { notes: PrintNote[]; arrows: Arrow[]; bounds: Box }) {
  const rects = new Map(notes.map((n) => [n.note.id, { ...rectOf(n), x: n.note.x - bounds.x, y: n.note.y - bounds.y }]))
  return (
    <>
      {notes.map(({ note, height }) => (
        <div
          key={note.id}
          className="note print-note"
          data-color={note.color}
          style={{
            left: note.x - bounds.x,
            top: note.y - bounds.y,
            width: note.width,
            height,
            background: NOTE_COLORS[note.color],
          }}
        >
          <NoteBody html={note.html} />
        </div>
      ))}
      <svg className="print-arrows" width={bounds.width} height={bounds.height}>
        <defs>
          {ARROW_COLOR_ORDER.map((c) => (
            // Same closed head as the canvas (React Flow's ArrowClosed marker).
            <marker
              key={c}
              id={`print-arrowhead-${c}`}
              viewBox="-10 -10 20 20"
              markerWidth="16"
              markerHeight="16"
              markerUnits="strokeWidth"
              orient="auto-start-reverse"
              refX="0"
              refY="0"
            >
              <polyline
                points="-5,-4 0,0 -5,4 -5,-4"
                fill={ARROW_COLORS[c]}
                stroke={ARROW_COLORS[c]}
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </marker>
          ))}
        </defs>
        {arrows.map((a) => {
          const s = rects.get(a.from)
          const t = rects.get(a.to)
          if (!s || !t) return null
          const p = sideAnchors(s, t)
          const [path] = getBezierPath({
            sourceX: p.sx,
            sourceY: p.sy,
            sourcePosition: p.sPos,
            targetX: p.tx,
            targetY: p.ty,
            targetPosition: p.tPos,
          })
          const color = a.color ?? DEFAULT_ARROW_COLOR
          return (
            <path
              key={a.id}
              className="print-arrow"
              d={path}
              fill="none"
              stroke={ARROW_COLORS[color]}
              strokeWidth="1.5"
              markerEnd={`url(#print-arrowhead-${color})`}
            />
          )
        })}
      </svg>
    </>
  )
}

/** The board laid out for paper: one board-sized page (revision) or numbered A4 tiles (printer). */
export function PrintBoard({
  name,
  notes,
  arrows,
  format,
}: {
  name: string
  notes: PrintNote[]
  arrows: Arrow[]
  format: PrintFormat
}) {
  const bounds = boundsOf(notes)
  const drawing = <Drawing notes={notes} arrows={arrows} bounds={bounds} />
  if (format === 'revision') {
    const page = revisionPage(bounds)
    return (
      <div className="print-page print-revision" style={{ width: page.width, height: page.height }}>
        <div className="print-board" style={{ transform: `translate(${PAD}px, ${PAD}px) scale(${page.scale})` }}>
          {drawing}
        </div>
      </div>
    )
  }
  const layout = printerLayout(bounds, smallestTextPx(notes.map((n) => n.note.html)))
  const { area, tiles, scale } = layout
  return (
    <>
      {tiles.map((tile, i) => (
        <div
          key={i}
          className="print-page print-a4"
          style={{ width: area.width, height: area.height + FOOTER - SAFETY }}
        >
          <div className="print-tile" style={{ width: area.width, height: area.height }}>
            <div className="print-board" style={{ transform: `translate(${-tile.x}px, ${-tile.y}px) scale(${scale})` }}>
              {drawing}
            </div>
          </div>
          <footer className="print-footer">
            {name} · {i + 1} / {tiles.length}
          </footer>
        </div>
      ))}
    </>
  )
}
