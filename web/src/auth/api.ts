import type { PinResult } from '@chart/shared'

const postJson = (url: string, body: unknown) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  })

/** Asks the server to check the PIN. Rejects when the network is down (the screen then says so). */
export async function login(pin: string): Promise<PinResult> {
  const res = await postJson('/api/login', { pin })
  if (!res.ok) throw new Error(`login failed: ${res.status}`)
  return (await res.json()) as PinResult
}

/**
 * true / false for a valid session (204 / 401); 'offline' when the server can't answer: network
 * down, server error (502 while the container restarts…) or no answer within `timeoutMs`.
 */
export async function hasSession(timeoutMs = 4000): Promise<boolean | 'offline'> {
  try {
    const res = await fetch('/api/session', { credentials: 'same-origin', signal: AbortSignal.timeout(timeoutMs) })
    if (res.status === 204) return true
    if (res.status === 401) return false
    return 'offline'
  } catch {
    return 'offline'
  }
}
