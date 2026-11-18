import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useLocation } from 'wouter'
import { UNTITLED_BOARD, type Id } from '@chart/shared'
import { createBoard, deleteBoard, listBoards, renameBoard } from '../db/repo'
import { trackWrite } from '../db/saveErrors'
import { filterBoards } from './filterBoards'
import './BoardList.css'

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })

export function BoardList() {
  const boards = useLiveQuery(listBoards)
  const [query, setQuery] = useState('')
  const [renamingId, setRenamingId] = useState<Id | null>(null)
  const [, navigate] = useLocation()

  async function onCreate() {
    const board = await trackWrite(createBoard(UNTITLED_BOARD))
    if (board) navigate(`/b/${board.id}`, { state: { justCreated: true } })
  }

  function onDelete(id: Id, name: string) {
    if (window.confirm(`Supprimer la carte « ${name} » ?`)) void trackWrite(deleteBoard(id))
  }

  const visible = boards && filterBoards(boards, query)

  return (
    <main className="board-list">
      <header>
        <h1>Cartes</h1>
        <button className="primary" onClick={onCreate}>
          Nouvelle carte
        </button>
      </header>
      <input
        className="search"
        type="search"
        placeholder="Rechercher une carte…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {visible && visible.length === 0 && <p className="empty">Aucune carte</p>}
      <ul>
        {visible?.map((b) => (
          <li key={b.id}>
            {renamingId === b.id ? (
              <RenameInput
                name={b.name}
                onDone={(name) => {
                  setRenamingId(null)
                  if (name !== null) void trackWrite(renameBoard(b.id, name))
                }}
              />
            ) : (
              <Link href={`/b/${b.id}`}>{b.name}</Link>
            )}
            <span className="meta">{dateFormat.format(b.lastEditedAt)}</span>
            <button className="ghost" aria-label={`Renommer ${b.name}`} onClick={() => setRenamingId(b.id)}>
              Renommer
            </button>
            <button className="ghost danger" aria-label={`Supprimer ${b.name}`} onClick={() => onDelete(b.id, b.name)}>
              Supprimer
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}

/** Enter or blur saves, Escape cancels (onDone(null)). */
function RenameInput({ name, onDone }: { name: string; onDone: (name: string | null) => void }) {
  const done = useRef(false)
  const finish = (value: string | null) => {
    if (done.current) return
    done.current = true
    onDone(value)
  }
  return (
    <input
      aria-label="Nom de la carte"
      defaultValue={name}
      autoFocus
      onFocus={(e) => e.target.select()}
      onBlur={(e) => finish(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(e.currentTarget.value)
        if (e.key === 'Escape') finish(null)
      }}
    />
  )
}
