import { it, expect } from 'vitest'
import {
  a4Area,
  boardBounds,
  intersects,
  MIN_ZONE_SCALE,
  printerLayout,
  resizeZone,
  revisionPage,
  smallestTextPx,
  turnZone,
  zoneBox,
  zoneTextPt,
} from './printLayout'

const MM = 96 / 25.4
const OVERLAP = 10 * MM
const box = (width: number, height: number) => ({ x: 0, y: 0, width, height })
const textPt = (px: number, scale: number) => px * scale * 0.75

it('a small board fits one page at its real size, landscape when wide', () => {
  const wide = printerLayout(box(600, 300), 14)
  expect(wide).toMatchObject({ orientation: 'landscape', scale: 1, tiles: [{ x: 0, y: 0 }] })
  const tall = printerLayout(box(300, 600), 14)
  expect(tall).toMatchObject({ orientation: 'portrait', scale: 1, tiles: [{ x: 0, y: 0 }] })
})

it('a medium board is scaled down onto one page while 14px text stays ≥ 8pt', () => {
  const l = printerLayout(box(1200, 600), 14)
  expect(l.orientation).toBe('landscape')
  expect(l.tiles).toHaveLength(1)
  expect(l.scale).toBeCloseTo((277 * MM) / 1200, 9)
  expect(textPt(14, l.scale)).toBeGreaterThanOrEqual(8)
})

it('a board too big for one readable page is cut into overlapping tiles that cover it', () => {
  const W = 3738
  const H = 1789
  const l = printerLayout(box(W, H), 14)
  expect(l.orientation).toBe('landscape')
  expect(l.tiles.length).toBe(9)
  expect(textPt(14, l.scale)).toBeCloseTo(8, 9)
  const xs = [...new Set(l.tiles.map((t) => t.x))]
  const ys = [...new Set(l.tiles.map((t) => t.y))]
  for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeCloseTo(l.area.width - OVERLAP, 9)
  for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeCloseTo(l.area.height - OVERLAP, 9)
  expect(xs[xs.length - 1] + l.area.width).toBeGreaterThanOrEqual(W * l.scale)
  expect(ys[ys.length - 1] + l.area.height).toBeGreaterThanOrEqual(H * l.scale)
  expect(l.tiles[1]).toEqual({ x: xs[1], y: 0 }) // row by row
})

it('smaller text raises the scale', () => {
  expect(smallestTextPx(['<p><span style="font-size: 12px;">a</span></p>', '<p>b</p>'])).toBe(12)
  expect(smallestTextPx(['<p><span style="font-size: 22px;">a</span></p>'])).toBe(14)
  expect(printerLayout(box(3738, 1789), 12).scale).toBeCloseTo((8 * 4) / 3 / 12, 9)
})

it('boardBounds encloses every note', () => {
  expect(boardBounds([])).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  expect(
    boardBounds([
      { x: -50, y: 20, width: 200, height: 64 },
      { x: 300, y: -10, width: 100, height: 300 },
    ]),
  ).toEqual({ x: -50, y: -10, width: 450, height: 300 })
})

it('revisionPage pads by 32px and shrinks a board larger than 19200px', () => {
  expect(revisionPage(box(1000, 500))).toEqual({ width: 1064, height: 564, scale: 1 })
  const huge = revisionPage(box(30000, 1000))
  expect(huge.width).toBeCloseTo(19200, 9)
  expect(huge.scale).toBeCloseTo((19200 - 64) / 30000, 9)
  expect(huge.height).toBeCloseTo(1000 * huge.scale + 64, 9)
})

it('a tiny or zero font size can neither enlarge the board nor explode the page count', () => {
  expect(
    smallestTextPx(['<p><span style="font-size: 0px;">caché</span><span style="font-size: 1px;">x</span></p>']),
  ).toBe(10)
  const l = printerLayout(box(3000, 2000), smallestTextPx(['<p><span style="font-size: 1px;">x</span></p>']))
  expect(l.scale).toBeLessThanOrEqual(1)
  expect(l.tiles.length).toBeLessThanOrEqual(printerLayout(box(3000, 2000), 10).tiles.length)
})

it('a4Area is the printable A4 sheet at real size, swapped when landscape', () => {
  expect(a4Area('portrait')).toEqual({ width: 190 * MM, height: 269 * MM })
  expect(a4Area('landscape')).toEqual({ width: 277 * MM, height: 182 * MM })
})

it('intersects: boxes sharing area, not boxes merely touching or apart', () => {
  const a = { x: 0, y: 0, width: 100, height: 100 }
  expect(intersects(a, { x: 50, y: 50, width: 100, height: 100 })).toBe(true)
  expect(intersects(a, { x: 100, y: 0, width: 50, height: 50 })).toBe(false)
  expect(intersects(a, { x: -200, y: 0, width: 50, height: 50 })).toBe(false)
  expect(intersects(a, { x: 10, y: 10, width: 5, height: 5 })).toBe(true)
})

it('zoneBox: the A4 frame covers more board the smaller its scale', () => {
  expect(zoneBox({ x: 10, y: 20, orientation: 'portrait', scale: 1 })).toEqual({ x: 10, y: 20, ...a4Area('portrait') })
  const half = zoneBox({ x: 0, y: 0, orientation: 'landscape', scale: 0.5 })
  expect(half.width).toBeCloseTo(2 * 277 * MM, 9)
  expect(half.height).toBeCloseTo(2 * 182 * MM, 9)
})

it('turnZone keeps the centre and the scale; turning back restores the zone', () => {
  const z = { x: 100, y: 200, orientation: 'portrait' as const, scale: 0.5 }
  const t = turnZone(z, 'landscape')
  const [a, b] = [zoneBox(z), zoneBox(t)]
  expect(t.scale).toBe(0.5)
  expect(b.x + b.width / 2).toBeCloseTo(a.x + a.width / 2, 9)
  expect(b.y + b.height / 2).toBeCloseTo(a.y + a.height / 2, 9)
  expect(b.width).toBeGreaterThan(b.height)
  const back = turnZone(t, 'portrait')
  expect(back.x).toBeCloseTo(z.x, 9)
  expect(back.y).toBeCloseTo(z.y, 9)
  expect(turnZone(z, 'portrait')).toBe(z)
})

it('resizeZone: the corner moves, the top-left stays; the scale never goes above 1 nor under the minimum', () => {
  const z = { x: 5, y: 6, orientation: 'portrait' as const, scale: 1 }
  const wide = resizeZone(z, 2 * 190 * MM)
  expect(wide).toMatchObject({ x: 5, y: 6, orientation: 'portrait' })
  expect(wide.scale).toBeCloseTo(0.5, 9)
  expect(resizeZone(z, 10).scale).toBe(1)
  expect(resizeZone(z, 1e9).scale).toBe(MIN_ZONE_SCALE)
})

it('zoneTextPt: the smallest text on paper, in pt (14px at real size is 10.5pt)', () => {
  const z = { x: 0, y: 0, orientation: 'portrait' as const, scale: 1 }
  expect(zoneTextPt(['<p>x</p>'], z)).toBeCloseTo(10.5, 9)
  expect(zoneTextPt(['<p>x</p>'], { ...z, scale: 0.5 })).toBeCloseTo(5.25, 9)
  expect(zoneTextPt(['<span style="font-size: 12px">x</span>'], z)).toBeCloseTo(9, 9)
})
