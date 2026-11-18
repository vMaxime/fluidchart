import { useEffect, useState } from 'react'

/**
 * True when this board page was reached through "Nouvelle carte" (history state set by the list).
 * The flag is read in the initializer (pure: StrictMode runs it twice) and cleared in an effect,
 * so a reload does not refocus the title.
 */
export function useJustCreated(): boolean {
  const [justCreated] = useState(() => (history.state as { justCreated?: boolean } | null)?.justCreated === true)
  useEffect(() => {
    if (justCreated) history.replaceState({ ...history.state, justCreated: false }, '')
  }, [justCreated])
  return justCreated
}
