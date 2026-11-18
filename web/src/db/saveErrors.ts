// Tracks whether the last local write failed (quota, Safari "connection to Indexed Database
// server lost", …) so the UI can warn instead of silently dropping the student's work.

let failing = false
const listeners = new Set<() => void>()

function set(next: boolean) {
  if (failing === next) return
  failing = next
  for (const l of listeners) l()
}

export function hasSaveError(): boolean {
  return failing
}

export function subscribeSaveError(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Awaits a repo write; on failure raises the save error and resolves to undefined. */
export async function trackWrite<T>(write: Promise<T>): Promise<T | undefined> {
  try {
    const value = await write
    set(false)
    return value
  } catch (error) {
    console.error('Local save failed', error)
    set(true)
    return undefined
  }
}
