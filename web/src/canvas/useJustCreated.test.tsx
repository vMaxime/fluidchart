import { StrictMode } from 'react'
import { afterEach, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useJustCreated } from './useJustCreated'

afterEach(() => history.replaceState(null, ''))

it('reports a board just created, even under StrictMode double rendering, then clears the flag', () => {
  history.replaceState({ justCreated: true }, '')
  const { result } = renderHook(() => useJustCreated(), { wrapper: StrictMode })
  expect(result.current).toBe(true)
  expect((history.state as { justCreated?: boolean }).justCreated).toBe(false) // a reload will not refocus
})

it('is false when arriving any other way', () => {
  expect(renderHook(() => useJustCreated(), { wrapper: StrictMode }).result.current).toBe(false)
})
