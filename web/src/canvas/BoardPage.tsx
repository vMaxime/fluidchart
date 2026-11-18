import { useLiveQuery } from 'dexie-react-hooks'
import { ReactFlowProvider } from '@xyflow/react'
import { Link } from 'wouter'
import type { Id } from '@chart/shared'
import { getBoard } from '../db/repo'
import { BoardCanvas } from './BoardCanvas'
import { BoardTitle } from './BoardTitle'
import { useJustCreated } from './useJustCreated'
import './BoardPage.css'

export function BoardPage({ id }: { id: Id }) {
  const justCreated = useJustCreated()
  // undefined = still loading; null = no such board (never existed, or deleted here or elsewhere).
  const board = useLiveQuery(async () => {
    const b = await getBoard(id)
    return b && !b.deleted ? b : null
  }, [id])
  return (
    <div className="board-page">
      <header>
        <Link href="/">← Cartes</Link>
        {board && <BoardTitle id={id} name={board.name} autoFocus={justCreated} />}
      </header>
      <div className="board-body">
        {board === null && (
          <p className="board-missing">
            Carte introuvable. <Link href="/">Retour aux cartes</Link>
          </p>
        )}
        {board && (
          <ReactFlowProvider>
            <BoardCanvas boardId={id} />
          </ReactFlowProvider>
        )}
      </div>
    </div>
  )
}
