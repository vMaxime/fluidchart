import { it, expect } from 'vitest'
import * as auth from './auth'

it('pins the PIN rules agreed with the author (no IP ban)', () => {
  expect(auth.PIN_LENGTH).toBe(4)
  expect(auth.PIN_COOLDOWN_MS).toBe(3000)
  expect('PIN_MAX_FAILURES' in auth).toBe(false)
})
