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
    // Each <br> starts a new line.
    const lines = block
      .split(/<br\s*\/?>/i)
      .reduce((sum, part) => sum + Math.max(1, Math.ceil(textLength(part) / perLine)), 0)
    height += lines * LINE_HEIGHT * font + BLOCK_GAP
  }
  return Math.max(MIN_HEIGHT, Math.ceil(height))
}

const NODE_GAP = 40
const RANK_GAP = 70

/**
 * The arrows that discover each note first, breadth-first from the notes nothing points to: a
 * forest. Laying out the forest keeps every layout edge one rank long — dagre otherwise adds a
 * dummy node per rank an arrow skips, which explodes on long or backward arrows. The canvas still
 * draws every arrow.
 */
function spanningForest(count: number, arrows: [number, number][]): [number, number][] {
  const next = Array.from({ length: count }, () => [] as number[])
  const incoming = new Array<number>(count).fill(0)
  for (const [from, to] of arrows) {
    next[from].push(to)
    incoming[to]++
  }
  const seen = new Array<boolean>(count).fill(false)
  const forest: [number, number][] = []
  const visit = (root: number) => {
    if (seen[root]) return
    seen[root] = true
    const queue = [root]
    for (let head = 0; head < queue.length; head++)
      for (const to of next[queue[head]])
        if (!seen[to]) {
          seen[to] = true
          forest.push([queue[head], to])
          queue.push(to)
        }
  }
  for (let i = 0; i < count; i++) if (incoming[i] === 0) visit(i)
  for (let i = 0; i < count; i++) visit(i) // notes only reachable through a cycle
  return forest
}

/** Top-down layered layout along the arrows; returns each note's top-left corner. */
export function layoutNotes(
  notes: { id: string; width: number; height: number }[],
  arrows: { from: string; to: string }[],
): Map<string, { x: number; y: number }> {
  // dagre keeps nodes in plain objects: never hand it caller ids ('__proto__', 'constructor' …).
  const index = new Map(notes.map((n, i) => [n.id, i]))
  const links = arrows
    .filter((a) => index.has(a.from) && index.has(a.to) && a.from !== a.to)
    .map((a) => [index.get(a.from)!, index.get(a.to)!] as [number, number])
  const key = (i: number) => `n${i}`
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: NODE_GAP, ranksep: RANK_GAP })
  g.setDefaultEdgeLabel(() => ({}))
  notes.forEach((n, i) => g.setNode(key(i), { width: n.width, height: n.height }))
  for (const [from, to] of spanningForest(notes.length, links)) g.setEdge(key(from), key(to))
  dagre.layout(g)
  // dagre centres each note in its rank; notes of a rank read better with their tops aligned.
  const rankTop = new Map<number, number>()
  notes.forEach((n, i) => {
    const { y, rank = 0 } = g.node(key(i))
    rankTop.set(rank, Math.min(rankTop.get(rank) ?? Infinity, y - n.height / 2))
  })
  const at = new Map<string, { x: number; y: number }>()
  notes.forEach((n, i) => {
    const { x, rank = 0 } = g.node(key(i))
    at.set(n.id, { x: Math.round(x - n.width / 2), y: Math.round(rankTop.get(rank)!) })
  })
  return at
}
