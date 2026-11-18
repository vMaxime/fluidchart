import { PIN_LENGTH, PIN_MAX_FAILURES, type PinResult } from '@chart/shared'

export type PinStatus = 'idle' | 'checking' | 'cooldown' | 'banned' | 'open'

export type PinState = {
  status: PinStatus
  digits: string
  /** When the cooldown ends (ms since epoch). */
  retryAt: number | null
  /** Attempts left before the permanent block, after a wrong code. */
  attemptsLeft: number | null
  offline: boolean
  /** Bumps on every wrong code, so the dots can shake again. */
  wrongCount: number
}

export type PinAction =
  | { type: 'digit'; digit: string }
  | { type: 'erase' }
  | { type: 'result'; result: PinResult; now: number }
  | { type: 'tick'; now: number }

export const initialPinState: PinState = {
  status: 'idle',
  digits: '',
  retryAt: null,
  attemptsLeft: null,
  offline: false,
  wrongCount: 0,
}

/** The PIN screen's rules: 4 digits, then the server decides; cooldowns and bans freeze the keypad. */
export function pinReducer(s: PinState, a: PinAction): PinState {
  switch (a.type) {
    case 'digit':
      if (s.status !== 'idle' || !/^\d$/.test(a.digit)) return s
      {
        const digits = s.digits + a.digit
        return { ...s, digits, offline: false, status: digits.length === PIN_LENGTH ? 'checking' : 'idle' }
      }
    case 'erase':
      return s.status === 'idle' ? { ...s, digits: s.digits.slice(0, -1) } : s
    case 'tick':
      return s.status === 'cooldown' && s.retryAt !== null && a.now >= s.retryAt
        ? { ...s, status: 'idle', retryAt: null }
        : s
    case 'result': {
      const r = a.result
      if (r.ok) return { ...s, status: 'open', digits: '' }
      switch (r.reason) {
        case 'wrong':
          return {
            ...s,
            status: 'cooldown',
            digits: '',
            retryAt: a.now + r.retryAfterMs,
            attemptsLeft: r.attemptsLeft,
            wrongCount: s.wrongCount + 1,
          }
        case 'cooldown':
          return { ...s, status: 'cooldown', digits: '', retryAt: a.now + r.retryAfterMs }
        case 'banned':
          return { ...s, status: 'banned', digits: '', retryAt: null, wrongCount: s.wrongCount + 1 }
        case 'offline':
          return { ...s, status: 'idle', digits: '', offline: true }
      }
    }
  }
}

/** The line under the dots. */
export function pinMessage(s: PinState, now: number): string | null {
  if (s.status === 'banned')
    return `Cet appareil est bloqué après ${PIN_MAX_FAILURES} codes incorrects. Demandez à l'administrateur de le débloquer.`
  if (s.offline) return 'Connexion impossible. Le premier déverrouillage de cet appareil demande une connexion.'
  const parts: string[] = []
  if (s.attemptsLeft !== null)
    parts.push(
      s.attemptsLeft <= 1
        ? 'Code incorrect. Dernier essai avant blocage.'
        : `Code incorrect. Encore ${s.attemptsLeft} essais avant blocage.`,
    )
  if (s.status === 'cooldown' && s.retryAt !== null)
    parts.push(`Nouvel essai dans ${Math.max(1, Math.ceil((s.retryAt - now) / 1000))} s`)
  return parts.length ? parts.join(' ') : null
}
