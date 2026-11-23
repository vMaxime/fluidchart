/** The character a keydown would type, or null for named keys (Enter, arrows…) and shortcuts. */
export function printableKey(e: KeyboardEvent): string | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null
  return [...e.key].length === 1 ? e.key : null
}

/** True when the event comes from a text field or a rich-text editor. */
export function isTypingTarget(e: Event): boolean {
  const t = e.target
  return t instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)
}
