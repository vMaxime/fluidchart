const toHex = (color: string) => {
  const rgb = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (!rgb) return color.toLowerCase()
  return (
    '#' +
    rgb
      .slice(1, 4)
      .map((n) => Number(n).toString(16).padStart(2, '0'))
      .join('')
  )
}

/**
 * Text colours (CSS `color:`, never `background-color:`) used in a note's html: hex, lower-cased,
 * unique, in order. rgb() is converted so a colour written either way is listed once.
 */
export function extractTextColors(html: string): string[] {
  const seen = new Set<string>()
  for (const m of html.matchAll(/(?<![-\w])color\s*:\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\))/gi)) seen.add(toHex(m[1]))
  return [...seen]
}
