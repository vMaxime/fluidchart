import { it, expect } from 'vitest'
import { estimateNoteHeight, layoutNotes } from './layout'

type Box = { id: string; width: number; height: number }
const overlaps = (boxes: Box[], at: Map<string, { x: number; y: number }>) => {
  for (const a of boxes)
    for (const b of boxes) {
      if (a.id >= b.id) continue
      const p = at.get(a.id)!
      const q = at.get(b.id)!
      if (p.x < q.x + b.width && q.x < p.x + a.width && p.y < q.y + b.height && q.y < p.y + a.height) return true
    }
  return false
}

it('a longer text or a narrower note is taller, never under 64', () => {
  expect(estimateNoteHeight('<p></p>', 200)).toBe(64)
  expect(estimateNoteHeight('<p>Insuline</p>', 200)).toBe(64)
  const long = `<p>${'Sécrétée par les cellules bêta des îlots de Langerhans. '.repeat(5)}</p>`
  expect(estimateNoteHeight(long, 200)).toBeGreaterThan(64)
  expect(estimateNoteHeight(long, 200)).toBeGreaterThan(estimateNoteHeight(long, 400))
  const list = '<ul><li><p>Captage du glucose</p></li><li><p>Glycogénogenèse</p></li><li><p>Lipolyse</p></li></ul>'
  expect(estimateNoteHeight(`<p>Effets</p>${list}`, 200)).toBeGreaterThan(estimateNoteHeight('<p>Effets</p>', 200))
})

it('a 22px title is taller than the same text at 14px', () => {
  const text = 'Régulation de la glycémie à jeun et après un repas'
  expect(estimateNoteHeight(`<p><span style="font-size: 22px;">${text}</span></p>`, 200)).toBeGreaterThan(
    estimateNoteHeight(`<p>${text}</p>`, 200),
  )
})

it('a parent sits above its children, the children side by side', () => {
  const boxes = [
    { id: 'a', width: 200, height: 80 },
    { id: 'b', width: 200, height: 64 },
    { id: 'c', width: 240, height: 120 },
  ]
  const at = layoutNotes(boxes, [
    { from: 'a', to: 'b' },
    { from: 'a', to: 'c' },
  ])
  expect(at.get('b')!.y).toBeGreaterThanOrEqual(at.get('a')!.y + 80 + 69)
  expect(at.get('b')!.y).toBe(at.get('c')!.y)
  for (const p of at.values()) expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true)
  expect(overlaps(boxes, at)).toBe(false)
})

it('cycles and isolated notes lay out without overlap', () => {
  const boxes = ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({ id, width: 200 + i * 20, height: 64 + i * 30 }))
  const at = layoutNotes(boxes, [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'a' },
    { from: 'b', to: 'c' },
    { from: 'c', to: 'a' },
  ])
  expect([...at.keys()].sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
  expect(overlaps(boxes, at)).toBe(false)
})

it('line breaks count as lines', () => {
  const eight = '<p>a<br>b<br>c<br>d<br>e<br>f<br>g<br>h</p>'
  expect(estimateNoteHeight(eight, 200)).toBeGreaterThanOrEqual(Math.ceil(24 + 8 * 1.4 * 14 + 4))
})

it('many arrows going back up lay out fast and without overlap', () => {
  const boxes = Array.from({ length: 300 }, (_, i) => ({ id: `n${i}`, width: 200, height: 64 + (i % 5) * 20 }))
  const arrows = [
    ...boxes.slice(1).map((b, i) => ({ from: `n${i}`, to: b.id })),
    ...boxes.slice(1).map((b) => ({ from: b.id, to: 'n0' })),
  ]
  const start = performance.now()
  const at = layoutNotes(boxes, arrows)
  expect(performance.now() - start).toBeLessThan(1000)
  expect(overlaps(boxes, at)).toBe(false)
})

it('a board at the API limits (1000 notes, 2000 arrows) lays out in under 2 s', () => {
  let seed = 7
  const random = (n: number) => Math.floor(((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31) * n)
  const boxes = Array.from({ length: 1000 }, (_, i) => ({ id: `n${i}`, width: 200, height: 64 + random(100) }))
  const arrows = Array.from({ length: 2000 }, () => ({ from: `n${random(1000)}`, to: `n${random(1000)}` }))
  const start = performance.now()
  const at = layoutNotes(boxes, arrows)
  expect(performance.now() - start).toBeLessThan(2000)
  expect(at.size).toBe(1000)
  expect(overlaps(boxes, at)).toBe(false)
})
