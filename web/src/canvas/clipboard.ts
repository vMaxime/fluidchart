/** Text of a note as plain text: one line per paragraph, `- ` for bullets, no markup. */
export function noteText(html: string): string {
  const root = new DOMParser().parseFromString(html, 'text/html').body
  const inline = (n: Node): string =>
    n.nodeType === Node.TEXT_NODE
      ? (n.textContent ?? '')
      : n.nodeName === 'BR'
        ? '\n'
        : [...n.childNodes].map(inline).join('')
  const list = (el: Element, depth: number): string[] => {
    const out: string[] = []
    ;[...el.children].forEach((li, i) => {
      const bullet = '  '.repeat(depth) + (el.nodeName === 'OL' ? `${i + 1}. ` : '- ')
      let first = true
      for (const part of li.children) {
        if (part.nodeName === 'UL' || part.nodeName === 'OL') out.push(...list(part, depth + 1))
        else {
          out.push((first ? bullet : '  '.repeat(depth + 1)) + inline(part))
          first = false
        }
      }
      if (first && li.children.length === 0) out.push(bullet + inline(li))
    })
    return out
  }
  const lines = (parent: Element): string[] =>
    [...parent.children].flatMap((el) => (el.nodeName === 'UL' || el.nodeName === 'OL' ? list(el, 0) : [inline(el)]))
  return lines(root).join('\n').replace(/\n+$/, '')
}

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Pasted plain text as a note's html: one paragraph per line, blank lines kept; null when empty. */
export function textToHtml(text: string): string | null {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  while (lines.length && !lines[0].trim()) lines.shift()
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
  return lines.length ? lines.map((l) => `<p>${escape(l)}</p>`).join('') : null
}
