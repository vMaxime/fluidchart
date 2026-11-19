import { it, expect } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { setSyncState } from './syncStatus'
import { SyncBadge } from './SyncBadge'

it('shows the sync state in words', () => {
  render(<SyncBadge />)
  for (const [state, label] of [
    ['synced', 'Synchronisé'],
    ['pending', 'Enregistrement…'],
    ['offline', 'Hors ligne'],
    ['error', 'Erreur de synchro'],
  ] as const) {
    act(() => setSyncState(state))
    expect(screen.getByText(label)).toBeInTheDocument()
  }
})
