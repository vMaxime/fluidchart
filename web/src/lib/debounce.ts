/** Trailing debounce that can be flushed (run now) or cancelled. */
export function createDebouncer<T>(fn: (v: T) => void, ms: number): { call(v: T): void; flush(): void; cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: { value: T } | undefined
  const cancel = () => {
    clearTimeout(timer)
    timer = undefined
    pending = undefined
  }
  const flush = () => {
    const p = pending
    cancel()
    if (p) fn(p.value)
  }
  return {
    call(v) {
      pending = { value: v }
      clearTimeout(timer)
      timer = setTimeout(flush, ms)
    },
    flush,
    cancel,
  }
}
