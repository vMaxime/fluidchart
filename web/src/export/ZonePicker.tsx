import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { ViewportPortal, useReactFlow, useViewport } from '@xyflow/react'
import type { Note } from '@chart/shared'
import { intersects, resizeZone, turnZone, zoneBox, zoneTextPt, type ExportZone } from './printLayout'

const KEY_STEP = 16
const KEY_STEP_BIG = 80
/** Smallest text that stays comfortable to read on paper. */
const READABLE_PT = 8
const frenchNumber = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

/**
 * « Exporter une zone A4 »: a page-shaped frame laid over the board, to drag onto the part to
 * export, and a bar to turn the page, export it or cancel. What the frame covers prints at real size.
 */
export function ZonePicker({
  zone,
  onChange,
  onExport,
  onCancel,
}: {
  zone: ExportZone
  onChange: (zone: ExportZone) => void
  onExport: () => void
  onCancel: () => void
}) {
  const { getNodes } = useReactFlow()
  const { zoom } = useViewport()
  const frame = zoneBox(zone)
  const drag = useRef<{ x: number; y: number; zone: ExportZone; resize: boolean } | null>(null)
  const inside = getNodes().filter((n) =>
    intersects(frame, {
      x: n.position.x,
      y: n.position.y,
      width: n.measured?.width ?? 200,
      height: n.measured?.height ?? 64,
    }),
  )
  const covered = inside.length > 0
  const textPt = zoneTextPt(
    inside.map((n) => (n.data as { note: Note }).note.html),
    zone,
  )

  // Pressing the frame moves it; pressing its corner handle resizes it.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const resize = e.target instanceof HTMLElement && e.target.classList.contains('zone-handle')
    drag.current = { x: e.clientX, y: e.clientY, zone, resize }
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const [dx, dy] = [(e.clientX - d.x) / zoom, (e.clientY - d.y) / zoom]
    if (d.resize) onChange(resizeZone(d.zone, zoneBox(d.zone).width + Math.max(dx, dy * a4Ratio(d.zone))))
    else onChange({ ...d.zone, x: d.zone.x + dx, y: d.zone.y + dy })
  }
  const onPointerUp = () => {
    drag.current = null
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? KEY_STEP_BIG : KEY_STEP
    const move: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    if (e.key === '+' || e.key === '-' || e.key === '=') {
      e.preventDefault()
      onChange(resizeZone(zone, frame.width * (e.key === '-' ? 1.1 : 1 / 1.1)))
      return
    }
    const by = move[e.key]
    if (!by) return
    e.preventDefault()
    onChange({ ...zone, x: zone.x + by[0], y: zone.y + by[1] })
  }

  return (
    <>
      <ViewportPortal>
        <div
          className="zone-frame nopan"
          role="group"
          aria-label="Zone de la page A4"
          tabIndex={0}
          data-testid="export-zone"
          aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown + -"
          style={{
            left: frame.x,
            top: frame.y,
            width: frame.width,
            height: frame.height,
            borderWidth: 2 / zoom,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
        >
          <span className="zone-handle" style={{ width: 16 / zoom, height: 16 / zoom, borderWidth: 2 / zoom }} />
        </div>
      </ViewportPortal>
      {createPortal(
        <div className="zone-bar" role="toolbar" aria-label="Exporter une zone A4">
          <span className="zone-hint">
            Déplace la zone, agrandis-la par son coin
            <span className={textPt < READABLE_PT ? 'zone-text zone-text-small' : 'zone-text'}>
              Texte le plus petit : {frenchNumber.format(textPt)} pt
            </span>
          </span>
          <span className="zone-turn" role="group" aria-label="Orientation">
            {(['portrait', 'landscape'] as const).map((o) => (
              <button key={o} aria-pressed={zone.orientation === o} onClick={() => onChange(turnZone(zone, o))}>
                {o === 'portrait' ? 'Portrait' : 'Paysage'}
              </button>
            ))}
          </span>
          <button
            className="zone-go"
            disabled={!covered}
            title={covered ? undefined : 'Aucun post-it dans la zone'}
            onClick={onExport}
          >
            Exporter cette zone
          </button>
          <button onClick={onCancel}>Annuler</button>
        </div>,
        document.body,
      )}
    </>
  )
}

/** Height of a frame for each unit of width: the A4 ratio of its orientation. */
const a4Ratio = (zone: ExportZone) => {
  const { width, height } = zoneBox({ ...zone, scale: 1 })
  return width / height
}
