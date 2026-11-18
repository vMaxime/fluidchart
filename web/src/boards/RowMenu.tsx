import { useEffect, useRef, useState } from 'react'

/** "⋯" menu for a board row: Ouvrir / Renommer / Supprimer. Scales in from its corner. */
export function RowMenu({
  name,
  onOpen,
  onRename,
  onDelete,
}: {
  name: string
  onOpen(): void
  onRename(): void
  onDelete(): void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', esc, true)
    root.current?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus()
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', esc, true)
    }
  }, [open])

  const item = (label: string, action: () => void, danger = false) => (
    <button
      role="menuitem"
      className={danger ? 'menu-item danger' : 'menu-item'}
      onClick={() => {
        setOpen(false)
        action()
      }}
    >
      {label}
    </button>
  )

  return (
    <div
      className={open ? 'menu is-open' : 'menu'}
      ref={root}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        className="menu-trigger"
        aria-label={`Actions pour ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="3.5" cy="8" r="1.3" />
          <circle cx="8" cy="8" r="1.3" />
          <circle cx="12.5" cy="8" r="1.3" />
        </svg>
      </button>
      {open && (
        <div className="menu-pop" role="menu" aria-label={`Actions pour ${name}`}>
          {item('Ouvrir', onOpen)}
          {item('Renommer', onRename)}
          {item('Supprimer', onDelete, true)}
        </div>
      )}
    </div>
  )
}
