import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useReactFlow } from '@xyflow/react'
import type { Arrow, Id } from '@chart/shared'
import { listArrows, listNotes } from '../db/repo'
import { PrintBoard, pageRule, type ExportZone, type PrintFormat, type PrintNote } from './PrintBoard'
import { ZonePicker } from './ZonePicker'
import { zoneBox } from './printLayout'
import { isTypingTarget } from '../canvas/keys'
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
  const { getInternalNode, getViewport, screenToFlowPosition, fitBounds } = useReactFlow()
  const noteCount = useLiveQuery(async () => (await listNotes(boardId)).length, [boardId])
  const [open, setOpen] = useState(false)
  const [job, setJob] = useState<{
    format: PrintFormat
    name: string
    notes: PrintNote[]
    arrows: Arrow[]
    zone?: ExportZone
  } | null>(null)
  // The A4 frame being placed on the canvas (null: not choosing a zone).
  const [zone, setZone] = useState<ExportZone | null>(null)
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

  // Choosing a zone: Escape cancels.
  useEffect(() => {
    if (!zone) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !isTypingTarget(e) && setZone(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zone === null]) // eslint-disable-line react-hooks/exhaustive-deps

  // The A4 frame starts in the middle of what is on screen; the view zooms out if it does not fit.
  const chooseZone = () => {
    setOpen(false)
    const view = document.querySelector('.react-flow')?.getBoundingClientRect()
    if (!view) return
    const real: ExportZone = { x: 0, y: 0, orientation: 'portrait', scale: 1 }
    const area = zoneBox(real)
    const c = screenToFlowPosition({ x: view.left + view.width / 2, y: view.top + view.height / 2 })
    const start: ExportZone = { ...real, x: c.x - area.width / 2, y: c.y - area.height / 2 }
    setZone(start)
    const { zoom } = getViewport()
    if (area.width * zoom > view.width * 0.9 || area.height * zoom > view.height * 0.9)
      void fitBounds({ ...area, x: start.x, y: start.y }, { padding: 0.18, duration: 200 })
  }

  const start = async (format: PrintFormat, chosen?: ExportZone) => {
    setOpen(false)
    setZone(null)
    // Read from the db: this read runs after writes already started, including the text of a note
    // saved as its editor lost focus to this menu.
    const [rows, arrows] = await Promise.all([listNotes(boardId), listArrows(boardId)])
    const notes = rows.map((note) => ({ note, height: getInternalNode(note.id)?.measured.height ?? 64 }))
    setJob({ format, name, notes, arrows, zone: chosen })
  }

  // While a job is mounted: its @page rule, the board name as document title (the PDF's file name),
  // then the print dialog once fonts and layout are ready. Cleaned up after printing (or a new job).
  useEffect(() => {
    if (!job) return
    const style = document.createElement('style')
    style.dataset.printPage = ''
    style.textContent = pageRule(job.format, job.notes, job.zone)
    document.head.append(style)
    const title = document.title
    document.title = job.name
    let live = true
    const done = () => setJob(null)
    window.addEventListener('afterprint', done)
    // Should afterprint never come (a print prompt dismissed in Safari…), the next press or key
    // on the page cleans up: the print dialog is modal, so none can reach the page before it closes.
    const fallback = () => {
      window.addEventListener('pointerdown', done, { capture: true, once: true })
      window.addEventListener('keydown', done, { capture: true, once: true })
    }
    void document.fonts.ready
      .then(nextFrame)
      .then(nextFrame)
      .then(() => {
        if (!live) return
        window.print()
        fallback()
      })
    return () => {
      live = false
      window.removeEventListener('afterprint', done)
      window.removeEventListener('pointerdown', done, { capture: true })
      window.removeEventListener('keydown', done, { capture: true })
      style.remove()
      document.title = title
    }
  }, [job])

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
          <button role="menuitem" onClick={chooseZone}>
            <span className="export-title">Une zone A4</span>
            <span className="export-hint">Choisis la partie à imprimer, à taille réelle</span>
          </button>
        </div>
      )}
      {zone && (
        <ZonePicker
          zone={zone}
          onChange={setZone}
          onExport={() => void start('printer', zone)}
          onCancel={() => setZone(null)}
        />
      )}
      {job &&
        createPortal(
          <div className="print-root">
            <PrintBoard name={job.name} format={job.format} notes={job.notes} arrows={job.arrows} zone={job.zone} />
          </div>,
          document.body,
        )}
    </div>
  )
}
