import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useLocation } from 'wouter'
import { NOTE_COLORS, UNTITLED_BOARD, type Id } from '@chart/shared'
import { createBoard, deleteBoard, listBoards, renameBoard, restoreBoard } from '../db/repo'
import { trackWrite } from '../db/saveErrors'
import { filterBoards } from './filterBoards'
import { Highlight } from './Highlight'
import { notesLabel, relativeTime } from './relativeTime'
import { RowMenu } from './RowMenu'
import { UndoToast } from './UndoToast'
import { SyncBadge } from '../sync/SyncBadge'
import './BoardList.css'

/**
 * Home: dense, keyboard-first list of boards (most recently edited first).
 * ↑↓ move · Entrée open · F2 rename · Suppr delete (undoable) · / search · N new board.
 */
export function BoardList() {
  const boards = useLiveQuery(listBoards)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [renaming, setRenaming] = useState<Id | null>(null)
  const [undo, setUndo] = useState<{ id: Id; name: string } | null>(null)
  const [, navigate] = useLocation()
  const search = useRef<HTMLInputElement>(null)
  const rows = useRef<(HTMLLIElement | null)[]>([])
  const visible = boards ? filterBoards(boards, query) : []

  useEffect(() => {
    if (active >= visible.length) setActive(Math.max(0, visible.length - 1))
  }, [visible.length, active])

  const open = useCallback((id: Id) => navigate(`/b/${id}`), [navigate])
  const create = useCallback(async () => {
    const board = await trackWrite(createBoard(UNTITLED_BOARD))
    if (board) navigate(`/b/${board.id}`, { state: { justCreated: true } })
  }, [navigate])
  const remove = useCallback((id: Id, name: string) => {
    void trackWrite(deleteBoard(id))
    setUndo({ id, name })
  }, [])
  const closeUndo = useCallback(() => setUndo(null), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (renaming || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement
      const typing = /^(INPUT|TEXTAREA)$/.test(target.tagName)
      const current = visible[active]
      if (e.key === '/' && !typing) {
        e.preventDefault()
        search.current?.focus()
      } else if ((e.key === 'n' || e.key === 'N') && !typing) {
        e.preventDefault()
        void create()
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const next = Math.min(visible.length - 1, Math.max(0, active + (e.key === 'ArrowDown' ? 1 : -1)))
        setActive(next)
        rows.current[next]?.focus()
      } else if (e.key === 'Enter' && current && (!typing || target === search.current)) {
        e.preventDefault()
        open(current.id)
      } else if (e.key === 'F2' && current) {
        e.preventDefault()
        setRenaming(current.id)
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && current) {
        e.preventDefault()
        remove(current.id, current.name)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, active, renaming, create, open, remove])

  return (
    <div className="home">
      <main className="home-main">
        <header className="home-head">
          <h1>Cartes</h1>
          {boards && <span className="home-count">{boards.length}</span>}
          <SyncBadge />
          <button className="home-new" onClick={() => void create()}>
            <span aria-hidden="true">+</span> Nouvelle carte <kbd aria-hidden="true">N</kbd>
          </button>
        </header>

        <label className="home-search">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
          <input
            ref={search}
            type="search"
            placeholder="Rechercher une carte…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setQuery('')
                e.currentTarget.blur()
              }
            }}
          />
          <kbd aria-hidden="true">/</kbd>
        </label>

        {boards && visible.length === 0 && <p className="home-empty">Aucune carte</p>}
        <ul className="home-rows" role="listbox" aria-label="Cartes">
          {visible.map((b, i) => (
            <li
              key={b.id}
              ref={(el) => {
                rows.current[i] = el
              }}
              role="option"
              aria-selected={i === active}
              tabIndex={i === active ? 0 : -1}
              className={i === active ? 'home-row is-active' : 'home-row'}
              data-testid="board"
              onMouseMove={() => i !== active && setActive(i)}
              onClick={() => renaming !== b.id && open(b.id)}
            >
              <span className="home-dots" aria-hidden="true">
                {b.colors.map((c) => (
                  <span key={c} style={{ background: NOTE_COLORS[c] }} />
                ))}
              </span>
              <span className="home-name">
                {renaming === b.id ? (
                  <RenameField
                    name={b.name}
                    onDone={(next) => {
                      setRenaming(null)
                      if (next !== null) void trackWrite(renameBoard(b.id, next))
                      rows.current[i]?.focus()
                    }}
                  />
                ) : (
                  <Highlight text={b.name} query={query} />
                )}
              </span>
              <span className="home-meta">{notesLabel(b.noteCount)}</span>
              <span className="home-date">{relativeTime(b.lastEditedAt)}</span>
              <RowMenu
                name={b.name}
                onOpen={() => open(b.id)}
                onRename={() => setRenaming(b.id)}
                onDelete={() => remove(b.id, b.name)}
              />
            </li>
          ))}
        </ul>

        {boards && boards.length > 0 && (
          <p className="home-keys" aria-hidden="true">
            <kbd>↑</kbd>
            <kbd>↓</kbd> naviguer · <kbd>Entrée</kbd> ouvrir · <kbd>F2</kbd> renommer · <kbd>Suppr</kbd> supprimer
          </p>
        )}
      </main>
      <UndoToast undo={undo} onUndo={(id) => void trackWrite(restoreBoard(id))} onClose={closeUndo} />
    </div>
  )
}

/** Inline rename: Enter or blur saves, Escape cancels (onDone(null)). */
function RenameField({ name, onDone }: { name: string; onDone: (next: string | null) => void }) {
  const done = useRef(false)
  const finish = (value: string | null) => {
    if (done.current) return
    done.current = true
    onDone(value)
  }
  return (
    <input
      className="home-rename"
      aria-label="Nom de la carte"
      defaultValue={name}
      autoFocus
      spellCheck={false}
      onFocus={(e) => e.target.select()}
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => finish(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') finish(e.currentTarget.value)
        if (e.key === 'Escape') finish(null)
      }}
    />
  )
}
