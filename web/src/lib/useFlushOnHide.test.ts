import { it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFlushOnHide } from './useFlushOnHide'

it('flushes on pagehide and when the tab becomes hidden, stops after unmount', () => {
  const flush = vi.fn()
  const { unmount } = renderHook(() => useFlushOnHide(flush))
  window.dispatchEvent(new Event('pagehide'))
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  document.dispatchEvent(new Event('visibilitychange'))
  expect(flush).toHaveBeenCalledTimes(2)
  unmount(); window.dispatchEvent(new Event('pagehide'))
  expect(flush).toHaveBeenCalledTimes(2)
})
