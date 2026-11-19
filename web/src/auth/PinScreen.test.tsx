import { afterEach, it, expect, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { PinResult } from '@chart/shared'
import { PinScreen } from './PinScreen'

afterEach(() => vi.useRealTimers())

const flush = () => act(async () => {})
const press = (label: string) => fireEvent.click(screen.getByRole('button', { name: label }))

it('the keyboard types the code; a right code unlocks', async () => {
  const verify = vi.fn(async (): Promise<PinResult> => ({ ok: true }))
  const onUnlock = vi.fn()
  render(<PinScreen verify={verify} onUnlock={onUnlock} />)
  const input = screen.getByLabelText("Code d'accès")
  expect(input).toHaveFocus()
  for (const d of '2468') fireEvent.keyDown(input, { key: d })
  await flush()
  expect(verify).toHaveBeenCalledWith('2468')
  expect(onUnlock).toHaveBeenCalled()
})

it('the on-screen keys type and erase', async () => {
  const verify = vi.fn(async (): Promise<PinResult> => ({ ok: true }))
  render(<PinScreen verify={verify} onUnlock={() => {}} />)
  for (const k of ['1', '3']) press(k)
  press('Effacer')
  for (const k of ['4', '6', '8']) press(k)
  await flush()
  expect(verify).toHaveBeenCalledWith('1468')
})

it('a wrong code says so and freezes the keypad for the cooldown', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  vi.setSystemTime(0)
  const verify = vi.fn(async (): Promise<PinResult> => ({
    ok: false,
    reason: 'wrong',
    retryAfterMs: 3000,
  }))
  render(<PinScreen verify={verify} onUnlock={() => {}} />)
  for (const k of ['1', '1', '1', '1']) press(k)
  await flush()
  expect(screen.getByRole('alert')).toHaveTextContent('Code incorrect. Nouvel essai dans 3 s')
  expect(screen.getByRole('button', { name: '5' })).toBeDisabled()
  await act(async () => {
    vi.setSystemTime(3000)
    vi.advanceTimersByTime(3000)
  })
  expect(screen.getByRole('button', { name: '5' })).toBeEnabled()
  expect(screen.getByRole('alert')).toHaveTextContent('Code incorrect.')
})

it('too many attempts overall freezes the keypad with the delay', async () => {
  const verify = vi.fn(async (): Promise<PinResult> => ({ ok: false, reason: 'locked', retryAfterMs: 3 * 3_600_000 }))
  render(<PinScreen verify={verify} onUnlock={() => {}} />)
  for (const k of ['9', '9', '9', '9']) press(k)
  await flush()
  expect(screen.getByRole('alert')).toHaveTextContent('Réessayez dans 3 h')
  expect(screen.getByRole('button', { name: '1' })).toBeDisabled()
})

it('a network failure reads as offline and lets you retry', async () => {
  const verify = vi.fn(async (): Promise<PinResult> => {
    throw new TypeError('Failed to fetch')
  })
  render(<PinScreen verify={verify} onUnlock={() => {}} />)
  for (const k of ['2', '4', '6', '8']) press(k)
  await flush()
  expect(screen.getByRole('alert')).toHaveTextContent('Connexion impossible')
  expect(screen.getByRole('button', { name: '1' })).toBeEnabled()
})
