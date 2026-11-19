import { afterEach, it, expect, vi } from 'vitest'
import { hasSession } from './api'

afterEach(() => vi.unstubAllGlobals())
const respond = (status: number) => vi.stubGlobal('fetch', async () => new Response(null, { status }))

it('204 is a session, 401 is none', async () => {
  respond(204)
  expect(await hasSession()).toBe(true)
  respond(401)
  expect(await hasSession()).toBe(false)
})

it('a server error or an unreachable server reads as offline, not as "no session"', async () => {
  respond(502)
  expect(await hasSession()).toBe('offline')
  vi.stubGlobal('fetch', async () => Promise.reject(new TypeError('Failed to fetch')))
  expect(await hasSession()).toBe('offline')
})

it('a hung connection gives up and reads as offline', async () => {
  vi.stubGlobal('fetch', (_url: string, init?: RequestInit) =>
    new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason))),
  )
  expect(await hasSession(50)).toBe('offline')
})
