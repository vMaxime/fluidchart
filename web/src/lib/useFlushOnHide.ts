import { useEffect, useRef } from 'react'

/** Runs `flush` when the page is being hidden or unloaded, so pending edits are saved. */
export function useFlushOnHide(flush: () => void): void {
  const latest = useRef(flush)
  useEffect(() => {
    latest.current = flush
  })
  useEffect(() => {
    const onPageHide = () => latest.current()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') latest.current()
    }
    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
}
