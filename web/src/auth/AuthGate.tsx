import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { startSync } from '../sync/syncEngine'
import { setSyncState, useSyncState } from '../sync/syncStatus'
import { hasSession, login } from './api'
import { PinScreen } from './PinScreen'

const UNLOCKED_KEY = 'chart.unlocked'
const remembered = () => {
  try {
    return localStorage.getItem(UNLOCKED_KEY) === '1'
  } catch {
    return false
  }
}
const remember = () => {
  try {
    localStorage.setItem(UNLOCKED_KEY, '1')
  } catch {
    // storage blocked: the device will just ask for the PIN when offline
  }
}

/**
 * Shows the app once the device holds a valid session, or offline if it was unlocked before
 * (local data stays usable without network). Otherwise, or when the session expires during a sync,
 * shows the PIN screen; nothing local is touched, and syncing resumes after unlocking.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [gate, setGate] = useState<'checking' | 'open' | 'pin'>('checking')
  const syncState = useSyncState()

  useEffect(() => {
    let live = true
    void hasSession().then((session) => {
      if (!live) return
      if (session === true) remember()
      setGate(session === true || (session === 'offline' && remembered()) ? 'open' : 'pin')
    })
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    if (gate === 'open') return startSync()
  }, [gate])

  useEffect(() => {
    if (syncState === 'locked' && gate === 'open') setGate('pin')
  }, [syncState, gate])

  const unlock = useCallback(() => {
    remember()
    setSyncState('pending')
    setGate('open')
  }, [])

  if (gate === 'checking') return null
  if (gate === 'pin') return <PinScreen verify={login} onUnlock={unlock} />
  return <>{children}</>
}
