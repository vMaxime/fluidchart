/** Text colours (CSS `color:`, never `background-color:`) used in a note's html, lower-cased, unique, in order. */
export function extractTextColors(html: string): string[] {
  const seen = new Set<string>()
  for (const m of html.matchAll(/(?<![-\w])color\s*:\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\))/gi)) seen.add(m[1].toLowerCase())
  return [...seen]
}
