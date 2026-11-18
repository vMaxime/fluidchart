import { useEffect, useReducer, useRef, useState } from 'react'
import type { PinResult } from '@chart/shared'
import { initialPinState, pinMessage, pinReducer } from './pinGate'
import './PinScreen.css'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

/**
 * "Pavé" lock screen: on-screen keypad + four dots. The keyboard works too (a hidden field keeps
 * focus) and lights the matching key. `verify` asks the server; it rejects when offline.
 */
export function PinScreen({ verify, onUnlock }: { verify(pin: string): Promise<PinResult>; onUnlock(): void }) {
  const [s, dispatch] = useReducer(pinReducer, initialPinState)
  const [now, setNow] = useState(() => Date.now())
  const [lit, setLit] = useState<string | null>(null)
  const [shaking, setShaking] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const ready = s.status === 'idle'

  useEffect(() => {
    if (s.status !== 'checking') return
    let live = true
    // Refresh `now` with the answer, so the countdown starts from the right time (not the last tick).
    const settle = (result: PinResult) => {
      if (!live) return
      const t = Date.now()
      setNow(t)
      dispatch({ type: 'result', result, now: t })
    }
    verify(s.digits).then(settle, () => settle({ ok: false, reason: 'offline' }))
    return () => {
      live = false
    }
  }, [s.status, s.digits, verify])

  useEffect(() => {
    if (s.status === 'open') onUnlock()
  }, [s.status, onUnlock])

  useEffect(() => {
    if (s.status !== 'cooldown' && s.status !== 'locked') return
    const t = setInterval(() => {
      setNow(Date.now())
      dispatch({ type: 'tick', now: Date.now() })
    }, 250)
    return () => clearInterval(t)
  }, [s.status])

  useEffect(() => {
    if (s.wrongCount) setShaking(true)
  }, [s.wrongCount])

  useEffect(() => {
    if (ready) input.current?.focus()
  }, [ready])

  function press(key: string) {
    if (!ready) return
    setLit(key)
    setTimeout(() => setLit((k) => (k === key ? null : k)), 120)
    dispatch(key === '⌫' ? { type: 'erase' } : { type: 'digit', digit: key })
  }

  const message = pinMessage(s, now)
  return (
    <div className="pin" onPointerDown={() => setTimeout(() => input.current?.focus())}>
      <section className="pin-panel" aria-labelledby="pin-title">
        <svg className="pin-mark" viewBox="0 0 40 40" aria-hidden="true">
          <rect x="4" y="5" width="32" height="30" rx="3" fill="#FFE58F" />
          <path d="M26 35v-7a2 2 0 0 1 2-2h8" fill="#F5D46A" />
          <rect x="10" y="13" width="16" height="2.4" rx="1.2" fill="#1c1917" opacity="0.7" />
          <rect x="10" y="19" width="20" height="2.4" rx="1.2" fill="#1c1917" opacity="0.4" />
        </svg>
        <h1 id="pin-title">Entrez votre code</h1>
        <input
          ref={input}
          className="pin-hidden"
          aria-label="Code d'accès"
          inputMode="none"
          autoComplete="off"
          autoFocus
          readOnly
          value={s.digits}
          onKeyDown={(e) => {
            if (/^\d$/.test(e.key)) {
              e.preventDefault()
              press(e.key)
            } else if (e.key === 'Backspace') {
              e.preventDefault()
              press('⌫')
            }
          }}
        />
        <div
          className={[
            'pin-dots',
            shaking && 'shake',
            s.wrong && s.status !== 'open' && 'is-error',
            s.status === 'checking' && 'is-checking',
          ]
            .filter(Boolean)
            .join(' ')}
          onAnimationEnd={() => setShaking(false)}
          aria-hidden="true"
        >
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i < s.digits.length ? 'is-filled' : undefined} />
          ))}
        </div>
        <p className={s.status === 'locked' ? 'pin-msg is-locked' : 'pin-msg'} role="alert">
          {message}
        </p>
        <div className="pin-keys">
          {KEYS.map((k, i) =>
            k ? (
              <button
                key={i}
                className={['pin-key', k === '⌫' && 'is-erase', lit === k && 'is-lit'].filter(Boolean).join(' ')}
                aria-label={k === '⌫' ? 'Effacer' : k}
                disabled={!ready}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => press(k)}
              >
                {k}
              </button>
            ) : (
              <span key={i} />
            ),
          )}
        </div>
      </section>
    </div>
  )
}
