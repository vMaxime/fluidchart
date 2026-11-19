import { it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { newArrow, newNote, NOTE_COLORS, type Arrow, type NoteColor } from '@chart/shared'
import { PrintBoard, pageRule, type PrintNote } from './PrintBoard'

const note = (id: string, x: number, y: number, color: NoteColor = 'yellow', html = '<p>x</p>'): PrintNote => ({
  note: { ...newNote('b', { x, y }, color, 0), id, html },
  height: 64,
})
const arrow = (from: string, to: string, color?: Arrow['color']): Arrow => ({
  ...newArrow('b', from, to, 0),
  id: `${from}-${to}`,
  ...(color && { color }),
})

it('revision: one page with every note, its sanitized text and colour, and one coloured path per arrow', () => {
  const { container } = render(
    <PrintBoard
      name="Hémato"
      format="revision"
      notes={[note('a', 100, 50, 'pink', '<p>Anémie<img src="x" onerror="alert(1)"></p>'), note('b', 500, 50)]}
      arrows={[arrow('a', 'b', 'red'), arrow('b', 'a')]}
    />,
  )
  expect(container.querySelectorAll('.print-page')).toHaveLength(1)
  const notes = [...container.querySelectorAll<HTMLElement>('.print-note')]
  expect(notes).toHaveLength(2)
  expect(notes[0]).toHaveTextContent('Anémie')
  expect(notes[0].dataset.color).toBe('pink')
  expect(notes[0]).toHaveStyle({ background: NOTE_COLORS.pink, left: '0px', width: '200px', height: '64px' })
  expect(notes[1]).toHaveStyle({ left: '400px', top: '0px' })
  expect(container.innerHTML).not.toContain('onerror')
  const paths = [...container.querySelectorAll('path.print-arrow')]
  expect(paths.map((p) => p.getAttribute('stroke'))).toEqual(['#dc2626', '#78716c'])
  expect(paths[0].getAttribute('marker-end')).toBe('url(#print-arrowhead-red)')
  expect(container.querySelector('marker#print-arrowhead-red')).not.toBeNull()
})

it('printer: one page per tile, each with « nom · i / n »', () => {
  // 3000px wide at the 8pt scale needs three landscape A4 pages.
  const { container } = render(
    <PrintBoard name="Hémato" format="printer" notes={[note('a', 0, 0), note('b', 2800, 0)]} arrows={[]} />,
  )
  const pages = container.querySelectorAll('.print-page')
  expect(pages).toHaveLength(3)
  expect([...container.querySelectorAll('.print-footer')].map((f) => f.textContent)).toEqual([
    'Hémato · 1 / 3',
    'Hémato · 2 / 3',
    'Hémato · 3 / 3',
  ])
})

it('pageRule gives the board-sized page for revision and A4 in the chosen orientation for printer', () => {
  const wide = [note('a', 0, 0), note('b', 2800, 0)]
  expect(pageRule('revision', wide)).toBe('@page { size: 3064px 128px; margin: 0 }')
  expect(pageRule('printer', wide)).toBe('@page { size: A4 landscape; margin: 10mm }')
  expect(pageRule('printer', [note('a', 0, 0), note('b', 0, 2000)])).toBe('@page { size: A4 portrait; margin: 10mm }')
})
