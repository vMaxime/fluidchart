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

/** true / false for a valid session, 'offline' when the server cannot be reached. */
export async function hasSession(): Promise<boolean | 'offline'> {
  try {
    return (await fetch('/api/session', { credentials: 'same-origin' })).status === 204
  } catch {
    return 'offline'
  }
}
