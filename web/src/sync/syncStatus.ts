import { useSyncExternalStore } from 'react'

/** What the header badge shows. 'locked' means the server wants the PIN again (session expired). */
export type SyncState = 'synced' | 'pending' | 'offline' | 'error' | 'locked'

let state: SyncState = 'synced'
const listeners = new Set<() => void>()

export function getSyncState(): SyncState {
  return state
}

export function setSyncState(next: SyncState): void {
  if (next === state) return
  state = next
  for (const l of listeners) l()
}

export function subscribeSyncState(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribeSyncState, getSyncState)
}
