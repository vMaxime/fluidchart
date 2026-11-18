/**
 * Asks the browser not to evict this site's data (IndexedDB) under storage pressure.
 * Never throws: returns whether storage is persistent.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    const storage = navigator.storage
    if (!storage?.persisted || !storage.persist) return false
    if (await storage.persisted()) return true
    return await storage.persist()
  } catch {
    return false
  }
}
