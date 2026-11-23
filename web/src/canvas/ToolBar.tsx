import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { Tool } from './CanvasContext'

const TOOLS: { tool: Tool; label: string; shortcut: string; icon: ReactElement }[] = [
  {
    tool: 'select',
    label: 'Sélectionner',
    shortcut: 'V',
    icon: <path d="M5 3l10 6.5-4.6 1.1 2.7 5.2-1.9 1-2.7-5.2L5 15z" />,
  },
  {
    tool: 'note',
    label: 'Ajouter un post-it',
    shortcut: 'N',
    icon: (
      <>
        <path d="M4 4h12v8l-4 4H4z" />
        <path className="stroke" d="M12 16v-4h4" />
      </>
    ),
  },
  {
    tool: 'arrow',
    label: 'Ajouter une flèche',
    shortcut: 'A',
    icon: <path className="stroke" d="M4 16L15 5M9 5h6v6" />,
  },
]

const SHOW_DELAY_MS = 400
const WARM_MS = 300

/**
 * Left tool column. Tooltips wait before the first one appears, then show instantly with no
 * animation while the pointer moves between tools (Emil Kowalski's tooltip rule).
 */
const ACTIONS = [
  {
    key: 'undo',
    label: 'Annuler',
    shortcut: '⌘Z',
    icon: <path className="stroke" d="M7 6L4 9l3 3M4 9h7a4 4 0 0 1 0 8H9" />,
  },
  {
    key: 'redo',
    label: 'Rétablir',
    shortcut: '⇧⌘Z',
    icon: <path className="stroke" d="M13 6l3 3-3 3M16 9H9a4 4 0 0 0 0 8h2" />,
  },
  {
    key: 'duplicate',
    label: 'Dupliquer',
    shortcut: '⌘D',
    icon: (
      <>
        <rect className="stroke" x="7" y="7" width="9" height="9" rx="1.5" />
        <path className="stroke" d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7" />
      </>
    ),
  },
] as const

export function ToolBar(props: {
  tool: Tool
  onChange(tool: Tool): void
  canUndo: boolean
  canRedo: boolean
  onUndo(): void
  onRedo(): void
  canDuplicate: boolean
  onDuplicate(): void
}) {
  const { tool, onChange } = props
  const [tip, setTip] = useState<{ index: number; instant: boolean } | null>(null)
  const showTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const coolTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const warm = useRef(false)

  useEffect(
    () => () => {
      clearTimeout(showTimer.current)
      clearTimeout(coolTimer.current)
    },
    [],
  )

  function show(index: number) {
    clearTimeout(showTimer.current)
    clearTimeout(coolTimer.current)
    if (warm.current) return setTip({ index, instant: true })
    showTimer.current = setTimeout(() => {
      warm.current = true
      setTip({ index, instant: false })
    }, SHOW_DELAY_MS)
  }

  function hide() {
    clearTimeout(showTimer.current)
    setTip(null)
    coolTimer.current = setTimeout(() => (warm.current = false), WARM_MS)
  }

  return (
    <aside className="toolbar" aria-label="Outils">
      {TOOLS.map((t, i) => (
        <div key={t.tool} className="toolbar-slot">
          <button
            className={tool === t.tool ? 'toolbar-btn is-active' : 'toolbar-btn'}
            aria-label={t.label}
            aria-pressed={tool === t.tool}
            aria-keyshortcuts={t.shortcut}
            aria-describedby={tip?.index === i ? `tool-tip-${t.tool}` : undefined}
            onPointerEnter={() => show(i)}
            onPointerLeave={hide}
            onFocus={(e) => e.currentTarget.matches(':focus-visible') && show(i)}
            onBlur={hide}
            onClick={() => onChange(t.tool)}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              {t.icon}
            </svg>
          </button>
          {tip?.index === i && (
            <span
              id={`tool-tip-${t.tool}`}
              role="tooltip"
              className="toolbar-tip"
              data-instant={tip.instant || undefined}
            >
              {t.label}
              <kbd>{t.shortcut}</kbd>
            </span>
          )}
        </div>
      ))}
      <span className="toolbar-sep" aria-hidden="true" />
      {ACTIONS.map((a, j) => {
        const i = TOOLS.length + j
        const enabled = { undo: props.canUndo, redo: props.canRedo, duplicate: props.canDuplicate }[a.key]
        const onClick = { undo: props.onUndo, redo: props.onRedo, duplicate: props.onDuplicate }[a.key]
        const shortcut = { undo: 'Meta+Z', redo: 'Meta+Shift+Z', duplicate: 'Meta+D' }[a.key]
        return (
          <div key={a.key} className="toolbar-slot">
            <button
              className="toolbar-btn"
              aria-label={a.label}
              aria-keyshortcuts={shortcut}
              aria-describedby={tip?.index === i ? `tool-tip-${a.key}` : undefined}
              disabled={!enabled}
              onPointerEnter={() => show(i)}
              onPointerLeave={hide}
              onFocus={(e) => e.currentTarget.matches(':focus-visible') && show(i)}
              onBlur={hide}
              onClick={onClick}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                {a.icon}
              </svg>
            </button>
            {tip?.index === i && (
              <span
                id={`tool-tip-${a.key}`}
                role="tooltip"
                className="toolbar-tip"
                data-instant={tip.instant || undefined}
              >
                {a.label}
                <kbd>{a.shortcut}</kbd>
              </span>
            )}
          </div>
        )
      })}
    </aside>
  )
}
