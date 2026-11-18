import { it, expect } from 'vitest'
import { initialPinState, pinMessage, pinReducer, type PinState } from './pinGate'

const typed = (digits: string, s: PinState = initialPinState) =>
  [...digits].reduce((st, d) => pinReducer(st, { type: 'digit', digit: d }), s)
const HOUR = 3_600_000

it('collects up to 4 digits, then waits for the server', () => {
  const s = typed('246')
  expect(s).toMatchObject({ digits: '246', status: 'idle' })
  expect(typed('8', s)).toMatchObject({ digits: '2468', status: 'checking' })
  expect(typed('9', typed('8', s)).digits).toBe('2468') // ignored while checking
})

it('erase removes the last digit', () => {
  expect(pinReducer(typed('24'), { type: 'erase' }).digits).toBe('2')
})

it('a right code opens', () => {
  expect(pinReducer(typed('2468'), { type: 'result', result: { ok: true }, now: 0 }).status).toBe('open')
})

it('a wrong code clears the dots and starts the cooldown; keys are ignored until it ends', () => {
  const s = pinReducer(typed('1111'), {
    type: 'result',
    result: { ok: false, reason: 'wrong', retryAfterMs: 3000 },
    now: 1000,
  })
  expect(s).toMatchObject({ status: 'cooldown', digits: '', retryAt: 4000, wrong: true })
  expect(typed('1', s).digits).toBe('')
  expect(pinReducer(s, { type: 'tick', now: 3999 }).status).toBe('cooldown')
  expect(pinReducer(s, { type: 'tick', now: 4000 }).status).toBe('idle')
})

it('the server can impose the cooldown too (same rule both sides)', () => {
  const s = pinReducer(typed('1111'), {
    type: 'result',
    result: { ok: false, reason: 'cooldown', retryAfterMs: 1200 },
    now: 0,
  })
  expect(s).toMatchObject({ status: 'cooldown', retryAt: 1200 })
})

it('too many attempts overall locks new logins until the window frees up, then lets you try again', () => {
  const s = pinReducer(typed('1111'), {
    type: 'result',
    result: { ok: false, reason: 'locked', retryAfterMs: 5 * HOUR },
    now: 0,
  })
  expect(s.status).toBe('locked')
  expect(typed('2468', s).digits).toBe('')
  expect(pinReducer(s, { type: 'tick', now: 5 * HOUR - 1 }).status).toBe('locked')
  expect(pinReducer(s, { type: 'tick', now: 5 * HOUR }).status).toBe('idle')
})

it('offline lets you try again at once', () => {
  expect(pinReducer(typed('2468'), { type: 'result', result: { ok: false, reason: 'offline' }, now: 0 })).toMatchObject(
    { status: 'idle', digits: '', offline: true },
  )
})

it('messages: wrong code with countdown, lock with a readable delay, offline', () => {
  const wrong = pinReducer(typed('1111'), {
    type: 'result',
    result: { ok: false, reason: 'wrong', retryAfterMs: 3000 },
    now: 0,
  })
  expect(pinMessage(wrong, 0)).toBe('Code incorrect. Nouvel essai dans 3 s')
  expect(pinMessage(wrong, 2100)).toBe('Code incorrect. Nouvel essai dans 1 s')
  expect(pinMessage(pinReducer(wrong, { type: 'tick', now: 3000 }), 3000)).toBe('Code incorrect.')
  const locked = (ms: number) =>
    pinReducer(typed('1111'), { type: 'result', result: { ok: false, reason: 'locked', retryAfterMs: ms }, now: 0 })
  expect(pinMessage(locked(5 * HOUR), 0)).toBe('Trop de codes incorrects pour le moment. Réessayez dans 5 h.')
  expect(pinMessage(locked(20 * 60_000), 0)).toBe('Trop de codes incorrects pour le moment. Réessayez dans 20 min.')
  expect(pinMessage(locked(40_000), 0)).toBe('Trop de codes incorrects pour le moment. Réessayez dans 40 s.')
  expect(
    pinMessage(pinReducer(typed('2468'), { type: 'result', result: { ok: false, reason: 'offline' }, now: 0 }), 0),
  ).toBe('Connexion impossible. Le premier déverrouillage de cet appareil demande une connexion.')
  expect(pinMessage(initialPinState, 0)).toBeNull()
})
