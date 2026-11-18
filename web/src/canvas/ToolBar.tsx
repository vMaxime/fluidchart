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
export function ToolBar({ tool, onChange }: { tool: Tool; onChange(tool: Tool): void }) {
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
            <span id={`tool-tip-${t.tool}`} role="tooltip" className="toolbar-tip" data-instant={tip.instant || undefined}>
              {t.label}
              <kbd>{t.shortcut}</kbd>
            </span>
          )}
        </div>
      ))}
    </aside>
  )
}
