import { it, expect } from 'vitest'
import { PIN_COOLDOWN_MS, PIN_LENGTH, PIN_MAX_FAILURES } from './auth'

it('pins the PIN rules agreed with the author', () => {
  expect(PIN_LENGTH).toBe(4)
  expect(PIN_COOLDOWN_MS).toBe(3000)
  expect(PIN_MAX_FAILURES).toBe(3)
})
