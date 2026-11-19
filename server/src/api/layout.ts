import dagre from '@dagrejs/dagre'

// Mirrors `.note` in web/src/canvas/canvas.css: 12px padding top and bottom, 14px left and right,
// line-height 1.4, 4px under each paragraph, 64px minimum height.
const PADDING_Y = 24
const PADDING_X = 28
const LINE_HEIGHT = 1.4
const BLOCK_GAP = 4
const MIN_HEIGHT = 64
const NORMAL_SIZE = 14
/** Average glyph width as a share of the font size (a little generous, so notes rarely overlap). */
const GLYPH = 0.55

const textLength = (html: string) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&[#\w]+;/g, 'x')
    .trim().length

/**
 * The height a note will take on the canvas once its text is rendered — an estimate, since the
 * server cannot measure text. Used only to lay out notes that came without positions.
 */
export function estimateNoteHeight(html: string, width: number): number {
  const blocks = [...html.matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => m[2])
  let height = PADDING_Y
  for (const block of blocks.length ? blocks : [html]) {
    const sizes = [...block.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]))
    const font = Math.max(NORMAL_SIZE, ...sizes)
    const perLine = Math.max(1, Math.floor((width - PADDING_X) / (GLYPH * font)))
    const lines = Math.max(1, Math.ceil(textLength(block) / perLine))
    height += lines * LINE_HEIGHT * font + BLOCK_GAP
  }
  return Math.max(MIN_HEIGHT, Math.ceil(height))
}

const NODE_GAP = 40
const RANK_GAP = 70

/** Top-down layered layout along the arrows; returns each note's top-left corner. */
export function layoutNotes(
  notes: { id: string; width: number; height: number }[],
  arrows: { from: string; to: string }[],
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: NODE_GAP, ranksep: RANK_GAP })
  g.setDefaultEdgeLabel(() => ({}))
  for (const n of notes) g.setNode(n.id, { width: n.width, height: n.height })
  for (const a of arrows) g.setEdge(a.from, a.to)
  dagre.layout(g)
  // dagre centres each note in its rank; notes of a rank read better with their tops aligned.
  const rankTop = new Map<number, number>()
  for (const n of notes) {
    const { y, rank = 0 } = g.node(n.id)
    rankTop.set(rank, Math.min(rankTop.get(rank) ?? Infinity, y - n.height / 2))
  }
  const at = new Map<string, { x: number; y: number }>()
  for (const n of notes) {
    const { x, rank = 0 } = g.node(n.id)
    at.set(n.id, { x: Math.round(x - n.width / 2), y: Math.round(rankTop.get(rank)!) })
  }
  return at
}
