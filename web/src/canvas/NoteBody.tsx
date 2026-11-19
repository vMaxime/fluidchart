import DOMPurify from 'dompurify'

/** A note's formatted text as displayed (canvas and print): always through DOMPurify. */
export function NoteBody({ html }: { html: string }) {
  return <div className="note-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
}
