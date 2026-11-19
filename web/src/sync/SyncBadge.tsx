import { useSyncState, type SyncState } from './syncStatus'
import './SyncBadge.css'

const LABELS: Record<SyncState, string> = {
  synced: 'Synchronisé',
  pending: 'Enregistrement…',
  offline: 'Hors ligne',
  error: 'Erreur de synchro',
  locked: 'Hors ligne',
}

/** Quiet sync indicator for the page headers. */
export function SyncBadge() {
  const state = useSyncState()
  return (
    <span className={`sync-badge is-${state}`} aria-live="polite">
      <span className="sync-dot" aria-hidden="true" />
      {LABELS[state]}
    </span>
  )
}
