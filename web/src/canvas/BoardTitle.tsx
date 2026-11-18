import { useEffect, useRef, useState } from 'react'
import type { Id } from '@chart/shared'
import { renameBoard } from '../db/repo'
import { trackWrite } from '../db/saveErrors'

/**
 * The board's name, editable in place. Saves on blur or Enter; Escape restores it.
 * `autoFocus` (a board just created) selects "Sans titre" so typing replaces it.
 */
export function BoardTitle({ id, name, autoFocus }: { id: Id; name: string; autoFocus: boolean }) {
  const [value, setValue] = useState(name)
  const focused = useRef(false)
  const cancelled = useRef(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!focused.current) setValue(name)
  }, [name])

  useEffect(() => {
    if (!autoFocus) return
    input.current?.focus()
    input.current?.select()
  }, [autoFocus])

  return (
    <input
      ref={input}
      className="board-title"
      aria-label="Nom de la carte"
      value={value}
      spellCheck={false}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => {
        focused.current = true
        e.target.select()
      }}
      onBlur={() => {
        focused.current = false
        if (cancelled.current) {
          cancelled.current = false
          return
        }
        void trackWrite(renameBoard(id, value))
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          cancelled.current = true
          setValue(name)
          e.currentTarget.blur()
        }
      }}
    />
  )
}
