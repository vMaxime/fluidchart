import { it, expect, vi } from 'vitest'
import { createDebouncer } from './debounce'

it('calls once with the last value after the delay', () => {
  vi.useFakeTimers(); const fn = vi.fn(); const d = createDebouncer(fn, 400)
  d.call('a'); d.call('b'); vi.advanceTimersByTime(399); expect(fn).not.toHaveBeenCalled()
  vi.advanceTimersByTime(1); expect(fn).toHaveBeenCalledExactlyOnceWith('b'); vi.useRealTimers()
})
it('flush calls immediately with the pending value, then nothing is pending', () => {
  vi.useFakeTimers(); const fn = vi.fn(); const d = createDebouncer(fn, 400)
  d.call('x'); d.flush(); d.flush(); vi.advanceTimersByTime(1000)
  expect(fn).toHaveBeenCalledExactlyOnceWith('x'); vi.useRealTimers()
})
