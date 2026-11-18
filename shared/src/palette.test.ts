import { it, expect } from 'vitest'
import { NOTE_COLOR_ORDER, NOTE_COLORS, DEFAULT_NOTE_COLOR } from './palette'

it('palette has 6 colors, each with a hex value', () => {
  expect(NOTE_COLOR_ORDER).toEqual(['yellow', 'pink', 'blue', 'green', 'orange', 'purple'])
  for (const c of NOTE_COLOR_ORDER) expect(NOTE_COLORS[c]).toMatch(/^#[0-9A-F]{6}$/i)
  expect(DEFAULT_NOTE_COLOR).toBe('yellow')
})
