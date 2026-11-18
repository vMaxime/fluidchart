import { afterEach, it, expect, vi } from 'vitest'
import { getLastColor, setLastColor } from './lastColor'
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

it('defaults to yellow', () => {
  expect(getLastColor()).toBe('yellow')
})
it('reads back the saved color', () => {
  setLastColor('pink')
  expect(getLastColor()).toBe('pink')
})
it('ignores an invalid stored value', () => {
  localStorage.setItem('chart.lastColor', 'magenta')
  expect(getLastColor()).toBe('yellow')
})
it('does not crash when localStorage throws', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  expect(() => setLastColor('blue')).not.toThrow()
  expect(getLastColor()).toBe('yellow')
})
