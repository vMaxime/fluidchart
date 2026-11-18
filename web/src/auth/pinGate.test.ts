import { it, expect } from 'vitest'
import { initialPinState, pinMessage, pinReducer, type PinState } from './pinGate'

const typed = (digits: string, s: PinState = initialPinState) =>
  [...digits].reduce((st, d) => pinReducer(st, { type: 'digit', digit: d }), s)

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
    result: { ok: false, reason: 'wrong', attemptsLeft: 2, retryAfterMs: 3000 },
    now: 1000,
  })
  expect(s).toMatchObject({ status: 'cooldown', digits: '', retryAt: 4000, attemptsLeft: 2 })
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

it('banned is final', () => {
  const s = pinReducer(typed('1111'), { type: 'result', result: { ok: false, reason: 'banned' }, now: 0 })
  expect(s.status).toBe('banned')
  expect(typed('2468', s).digits).toBe('')
  expect(pinReducer(s, { type: 'tick', now: 99_999 }).status).toBe('banned')
})

it('offline lets you try again at once', () => {
  expect(pinReducer(typed('2468'), { type: 'result', result: { ok: false, reason: 'offline' }, now: 0 })).toMatchObject(
    { status: 'idle', digits: '', offline: true },
  )
})

it('messages warn before the permanent block and count the cooldown down', () => {
  const after = (attemptsLeft: number) =>
    pinReducer(typed('1111'), {
      type: 'result',
      result: { ok: false, reason: 'wrong', attemptsLeft, retryAfterMs: 3000 },
      now: 0,
    })
  expect(pinMessage(after(2), 0)).toBe('Code incorrect. Encore 2 essais avant blocage. Nouvel essai dans 3 s')
  expect(pinMessage(after(1), 2100)).toBe('Code incorrect. Dernier essai avant blocage. Nouvel essai dans 1 s')
  expect(pinMessage(pinReducer(after(1), { type: 'tick', now: 3000 }), 3000)).toBe(
    'Code incorrect. Dernier essai avant blocage.',
  )
  expect(
    pinMessage(pinReducer(typed('1111'), { type: 'result', result: { ok: false, reason: 'banned' }, now: 0 }), 0),
  ).toBe("Cet appareil est bloqué après 3 codes incorrects. Demandez à l'administrateur de le débloquer.")
  expect(
    pinMessage(pinReducer(typed('2468'), { type: 'result', result: { ok: false, reason: 'offline' }, now: 0 }), 0),
  ).toBe('Connexion impossible. Le premier déverrouillage de cet appareil demande une connexion.')
  expect(pinMessage(initialPinState, 0)).toBeNull()
})
