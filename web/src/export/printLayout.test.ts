import { it, expect } from 'vitest'
import { boardBounds, printerLayout, revisionPage, smallestTextPx } from './printLayout'

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
