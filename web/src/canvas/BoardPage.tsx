import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'wouter'
import type { Id } from '@chart/shared'
import { getBoard } from '../db/repo'
import './BoardPage.css'

export function BoardPage({ id }: { id: Id }) {
  const board = useLiveQuery(() => getBoard(id), [id])
  return (
    <div className="board-page">
      <header>
        <Link href="/">← Cartes</Link>
        <h1>{board?.name}</h1>
      </header>
      <div className="board-body" />
    </div>
  )
}
