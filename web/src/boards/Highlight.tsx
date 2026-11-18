import { fold } from './filterBoards'

/** Shows `text` with the accent-insensitive match of `query` wrapped in <mark>. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const q = fold(query.trim())
  if (!q) return <>{text}</>
  const chars = [...text]
  const folded = chars.map(fold) // one entry per visible character ("Œ" → "oe")
  const idx = folded.join('').indexOf(q)
  if (idx < 0) return <>{text}</>
  let pos = 0
  let start = -1
  let end = chars.length
  folded.forEach((f, i) => {
    if (start < 0 && pos + f.length > idx) start = i
    if (end === chars.length && pos + f.length >= idx + q.length) end = i + 1
    pos += f.length
  })
  return (
    <>
      {chars.slice(0, start).join('')}
      <mark>{chars.slice(start, end).join('')}</mark>
      {chars.slice(end).join('')}
    </>
  )
}
