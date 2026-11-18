import { it, expect, vi, afterEach } from 'vitest'
import { requestPersistentStorage } from './persistStorage'
afterEach(() => vi.unstubAllGlobals())
const stub = (storage: unknown) => vi.stubGlobal('navigator', { storage })

it('does not ask again when already persisted', async () => {
  const persist = vi.fn(); stub({ persisted: async () => true, persist })
  expect(await requestPersistentStorage()).toBe(true); expect(persist).not.toHaveBeenCalled()
})
it('asks when not persisted and returns the answer', async () => {
  stub({ persisted: async () => false, persist: async () => true })
  expect(await requestPersistentStorage()).toBe(true)
})
it('returns false without the Storage API or when persist rejects', async () => {
  stub(undefined); expect(await requestPersistentStorage()).toBe(false)
  stub({ persisted: async () => false, persist: async () => { throw new Error('no') } })
  expect(await requestPersistentStorage()).toBe(false)
})
