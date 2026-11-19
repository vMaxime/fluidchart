import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useReactFlow } from '@xyflow/react'
import type { Arrow, Id } from '@chart/shared'
import { listArrows, listNotes } from '../db/repo'
import { PrintBoard, pageRule, type PrintFormat, type PrintNote } from './PrintBoard'
import './export.css'

const FORMATS: { format: PrintFormat; title: string; hint: string }[] = [
  { format: 'revision', title: 'Format révision', hint: "Une page à la taille de la carte, pour l'écran" },
  { format: 'printer', title: 'Format imprimante', hint: 'A4, découpé si besoin, pour le papier' },
]
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

/**
 * « Exporter en PDF »: lays the board out for paper in a hidden print document, then opens the
 * browser's print dialog (Save as PDF, or print). Everything happens on the device, offline too.
 */
export function ExportMenu({ boardId, name }: { boardId: Id; name: string }) {
  const { getInternalNode } = useReactFlow()
  const noteCount = useLiveQuery(async () => (await listNotes(boardId)).length, [boardId])
  const [open, setOpen] = useState(false)
  const [job, setJob] = useState<{ format: PrintFormat; notes: PrintNote[]; arrows: Arrow[] } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const empty = !noteCount

  // The menu closes on Escape or a press outside it.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  const start = async (format: PrintFormat) => {
    setOpen(false)
    // Read from the db: this read runs after writes already started, including the text of a note
    // saved as its editor lost focus to this menu.
    const [rows, arrows] = await Promise.all([listNotes(boardId), listArrows(boardId)])
    const notes = rows.map((note) => ({ note, height: getInternalNode(note.id)?.measured.height ?? 64 }))
    setJob({ format, notes, arrows })
  }

  // While a job is mounted: its @page rule, the board name as document title (the PDF's file name),
  // then the print dialog once fonts and layout are ready. Cleaned up after printing (or a new job).
  useEffect(() => {
    if (!job) return
    const style = document.createElement('style')
    style.dataset.printPage = ''
    style.textContent = pageRule(job.format, job.notes)
    document.head.append(style)
    const title = document.title
    document.title = name
    let live = true
    const done = () => setJob(null)
    window.addEventListener('afterprint', done)
    void document.fonts.ready
      .then(nextFrame)
      .then(nextFrame)
      .then(() => live && window.print())
    return () => {
      live = false
      window.removeEventListener('afterprint', done)
      style.remove()
      document.title = title
    }
  }, [job, name])

  return (
    <div className="export" ref={root}>
      <button
        className="export-button"
        disabled={empty}
        title={empty ? 'Rien à exporter' : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Exporter en PDF
      </button>
      {open && (
        <div className="export-menu" role="menu" aria-label="Format du PDF">
          {FORMATS.map((f) => (
            <button key={f.format} role="menuitem" onClick={() => void start(f.format)}>
              <span className="export-title">{f.title}</span>
              <span className="export-hint">{f.hint}</span>
            </button>
          ))}
        </div>
      )}
      {job &&
        createPortal(
          <div className="print-root">
            <PrintBoard name={name} format={job.format} notes={job.notes} arrows={job.arrows} />
          </div>,
          document.body,
        )}
    </div>
  )
}
