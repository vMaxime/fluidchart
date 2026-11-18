import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ReactFlowProvider } from '@xyflow/react'
import { Link } from 'wouter'
import type { Id } from '@chart/shared'
import { getBoard } from '../db/repo'
import { BoardCanvas } from './BoardCanvas'
import { BoardTitle } from './BoardTitle'
import './BoardPage.css'

/** True once, right after "Nouvelle carte" navigated here; cleared so a reload does not refocus. */
function consumeJustCreated(): boolean {
  const justCreated = (history.state as { justCreated?: boolean } | null)?.justCreated === true
  if (justCreated) history.replaceState({ ...history.state, justCreated: false }, '')
  return justCreated
}

export function BoardPage({ id }: { id: Id }) {
  const [justCreated] = useState(consumeJustCreated)
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
