import { afterEach, it, expect, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { hasSaveError, subscribeSaveError, trackWrite } from './saveErrors'
import { SaveErrorBanner } from '../app/SaveErrorBanner'

afterEach(async () => { await trackWrite(Promise.resolve()); vi.restoreAllMocks() })

it('a rejected write raises the save error, a later successful write clears it', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const seen: boolean[] = []
  const unsubscribe = subscribeSaveError(() => seen.push(hasSaveError()))
  expect(await trackWrite(Promise.reject(new Error('QuotaExceededError')))).toBeUndefined()
  expect(hasSaveError()).toBe(true)
  expect(await trackWrite(Promise.resolve(42))).toBe(42)
  expect(hasSaveError()).toBe(false)
  expect(seen).toEqual([true, false])
  unsubscribe()
})

it('the banner is shown only while a save is failing', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  render(<SaveErrorBanner />)
  expect(screen.queryByRole('alert')).toBeNull()
  await act(() => trackWrite(Promise.reject(new Error('boom'))))
  expect(screen.getByRole('alert')).toHaveTextContent('Enregistrement impossible')
  await act(() => trackWrite(Promise.resolve()))
  expect(screen.queryByRole('alert')).toBeNull()
})
