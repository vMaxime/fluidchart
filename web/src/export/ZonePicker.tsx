import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { ViewportPortal, useReactFlow, useViewport } from '@xyflow/react'
import { a4Area, intersects, type Box, type Orientation } from './printLayout'
import type { ExportZone } from './PrintBoard'

const KEY_STEP = 16
const KEY_STEP_BIG = 80

/** The A4 frame, in board coordinates, for a zone. */
export const zoneBox = (zone: ExportZone): Box => ({ x: zone.x, y: zone.y, ...a4Area(zone.orientation) })

/** The same page turned the other way, around the same centre. */
export function turnZone(zone: ExportZone, orientation: Orientation): ExportZone {
  if (orientation === zone.orientation) return zone
  const from = a4Area(zone.orientation)
  const to = a4Area(orientation)
  return { x: zone.x + (from.width - to.width) / 2, y: zone.y + (from.height - to.height) / 2, orientation }
}

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
  const drag = useRef<{ x: number; y: number; zone: ExportZone } | null>(null)
  const covered = getNodes().some((n) =>
    intersects(frame, {
      x: n.position.x,
      y: n.position.y,
      width: n.measured?.width ?? 200,
      height: n.measured?.height ?? 64,
    }),
  )

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, zone }
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    onChange({ ...d.zone, x: d.zone.x + (e.clientX - d.x) / zoom, y: d.zone.y + (e.clientY - d.y) / zoom })
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
        />
      </ViewportPortal>
      {createPortal(
        <div className="zone-bar" role="toolbar" aria-label="Exporter une zone A4">
          <span className="zone-hint">Déplace la zone sur la partie à exporter</span>
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
