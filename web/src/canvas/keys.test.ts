import { it, expect } from 'vitest'
import { printableKey } from './keys'

const key = (k: string, mods: Partial<KeyboardEventInit> = {}) => new KeyboardEvent('keydown', { key: k, ...mods })

it('returns the character for letters, digits, accents and punctuation', () => {
  for (const k of ['a', 'G', '7', 'é', '→', '-', ' ']) expect(printableKey(key(k))).toBe(k)
})
it('ignores named keys and shortcuts', () => {
  expect(printableKey(key('Backspace'))).toBeNull()
  expect(printableKey(key('Enter'))).toBeNull()
  expect(printableKey(key('ArrowLeft'))).toBeNull()
  expect(printableKey(key('z', { metaKey: true }))).toBeNull()
  expect(printableKey(key('c', { ctrlKey: true }))).toBeNull()
  expect(printableKey(key('a', { altKey: true }))).toBeNull()
})
