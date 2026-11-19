import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
  type InternalNode,
  type OnEdgesChange,
  type XYPosition,
  type OnNodeDrag,
  type OnNodesChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { DEFAULT_NOTE_WIDTH, type Id, type NoteColor } from '@chart/shared'
import { addArrow, addNote, deleteArrows, deleteNotes, listArrows, listNotes, updateNote } from '../db/repo'
import { trackWrite } from '../db/saveErrors'
import { db } from '../db/db'
import { createHistory } from './history'
import { ArrowPreview, useArrowDrag } from './arrowDrag'
import { CanvasContext, type Tool } from './CanvasContext'
import { CurveEdge } from './CurveEdge'
import { besidePosition, type Rect, type Side } from './edgeGeometry'
import { mergeEdges, mergeNodes, type ArrowFlowEdge, type NoteFlowNode } from './flowMapping'
import { isTypingTarget, printableKey } from './keys'
import { getLastColor, setLastColor } from './lastColor'
import { NoteNode } from './NoteNode'
import { ToolBar } from './ToolBar'
import './canvas.css'

const nodeTypes = { note: NoteNode }
const edgeTypes = { curve: CurveEdge }

/** Frame the board once its notes are measured (React Flow 13: a bare padding number means pixels). */
function FitOnce({ enabled }: { enabled: boolean }) {
  const initialized = useNodesInitialized()
  const { fitView } = useReactFlow()
  const done = useRef(false)
  useEffect(() => {
    if (!enabled || !initialized || done.current) return
    done.current = true
    void fitView({ padding: '8%', maxZoom: 1 })
  }, [enabled, initialized, fitView])
  return null
}

export function BoardCanvas({ boardId }: { boardId: Id }) {
  const notes = useLiveQuery(() => listNotes(boardId), [boardId])
  const arrows = useLiveQuery(() => listArrows(boardId), [boardId])
  const [nodes, setNodes] = useState<NoteFlowNode[] | null>(null)
  const [edges, setEdges] = useState<ArrowFlowEdge[]>([])
  const fitOnMount = useRef<boolean | null>(null)
  const [tool, setTool] = useState<Tool>('select')
  const [editing, setEditing] = useState<{ id: Id; initialInput?: string } | null>(null)
  const freshIds = useRef(new Set<Id>())
  const { screenToFlowPosition, getInternalNode, getNodes, getViewport, setCenter } = useReactFlow<NoteFlowNode>()
  const flowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!notes) return
    if (fitOnMount.current === null) fitOnMount.current = notes.length > 0
    setNodes((cur) => mergeNodes(notes, cur ?? []))
  }, [notes])
  useEffect(() => {
    if (arrows) setEdges((cur) => mergeEdges(arrows, cur))
  }, [arrows])

  const editingId = editing?.id ?? null
  const selected = useMemo(() => nodes?.filter((n) => n.selected) ?? [], [nodes])

  // Undo / redo for this board (in memory). Each user action records the rows it changed.
  const history = useMemo(() => createHistory(), [boardId])
  useSyncExternalStore(history.subscribe, history.version)

  // A writing session (open → close) is one undo step: remember the text it started from.
  const session = useRef<{ id: Id; html: string } | null>(null)
  const beginEditing = useCallback((id: Id, html: string, initialInput?: string) => {
    session.current = { id, html }
    setEditing({ id, initialInput })
  }, [])
  const startEditing = useCallback(
    (id: Id, initialInput?: string) =>
      beginEditing(id, getNodes().find((n) => n.id === id)?.data.note.html ?? '', initialInput),
    [beginEditing, getNodes],
  )
  // Leaving a note also deselects it, so a stray Backspace right after Escape cannot delete it.
  const stopEditing = useCallback(
    (finalHtml?: string) => {
      const start = session.current
      session.current = null
      if (start && finalHtml !== undefined && finalHtml !== start.html)
        void db.notes.get(start.id).then((row) => {
          if (!row) return
          const { dirty: _dirty, ...note } = row
          history.push([
            {
              table: 'notes',
              id: start.id,
              before: { ...note, html: start.html },
              after: { ...note, html: finalHtml },
            },
          ])
        })
      setEditing((cur) => {
        if (cur)
          setNodes((nds) => nds && nds.map((n) => (n.id === cur.id && n.selected ? { ...n, selected: false } : n)))
        return null
      })
    },
    [history],
  )
  const recolor = useCallback(
    (id: Id, color: NoteColor) => {
      void trackWrite(history.record(() => updateNote(id, { color })))
      setLastColor(color)
    },
    [history],
  )

  const arrow = useArrowDrag((from, { to }) => {
    if (!to) return // missed: stay in arrow mode, Escape to give up
    void trackWrite(history.record(() => addArrow(boardId, from, to)))
    setTool('select')
  })

  /** Glide the view when a note grown from a + lands off-screen, so its text is visible while typed. */
  const reveal = useCallback(
    (centre: XYPosition) => {
      const box = flowRef.current?.getBoundingClientRect()
      if (!box) return
      const { x, y, zoom } = getViewport()
      const sx = centre.x * zoom + x
      const sy = centre.y * zoom + y
      const m = 120
      if (sx < m || sx > box.width - m || sy < m || sy > box.height - m)
        void setCenter(centre.x, centre.y, { zoom, duration: 220 })
    },
    [getViewport, setCenter],
  )

  /** New note connected from `from`, same colour, opened for typing. */
  const growConnected = useCallback(
    (from: Id, topLeft: XYPosition) => {
      const color = getNodes().find((n) => n.id === from)?.data.note.color ?? getLastColor()
      void trackWrite(
        history.record(async () => {
          const note = await addNote(boardId, topLeft, color)
          await addArrow(boardId, from, note.id)
          return note
        }),
      ).then((note) => {
        if (!note) return
        freshIds.current.add(note.id)
        beginEditing(note.id, note.html)
        reveal({ x: topLeft.x + DEFAULT_NOTE_WIDTH / 2, y: topLeft.y + 40 })
      })
    },
    [boardId, getNodes, reveal, history, beginEditing],
  )

  const growBeside = useCallback(
    (from: Id, side: Side) => {
      const toRect = (n: InternalNode): Rect => ({
        x: n.internals.positionAbsolute.x,
        y: n.internals.positionAbsolute.y,
        width: n.measured.width ?? DEFAULT_NOTE_WIDTH,
        height: n.measured.height ?? 64,
      })
      const source = getInternalNode(from)
      if (!source) return
      const others = getNodes().flatMap((n) => {
        const internal = getInternalNode(n.id)
        return internal ? [toRect(internal)] : []
      })
      growConnected(from, besidePosition(toRect(source), side, others))
    },
    [getInternalNode, getNodes, growConnected],
  )

  // + knobs: tap grows beside, drag onto a note connects, drag onto empty canvas grows there.
  const knob = useArrowDrag<Side>((from, { to, at, moved }, side) => {
    if (!moved) growBeside(from, side)
    else if (to) void trackWrite(history.record(() => addArrow(boardId, from, to)))
    else if (at) growConnected(from, { x: at.x - DEFAULT_NOTE_WIDTH / 2, y: at.y - 30 })
  })
  const drag = arrow.drag ?? knob.drag

  const createNoteAt = useCallback(
    (clientX: number, clientY: number) => {
      const p = screenToFlowPosition({ x: clientX, y: clientY })
      void trackWrite(
        history.record(() => addNote(boardId, { x: p.x - DEFAULT_NOTE_WIDTH / 2, y: p.y - 30 }, getLastColor())),
      ).then((note) => {
        if (!note) return
        freshIds.current.add(note.id)
        beginEditing(note.id, note.html)
      })
    },
    [boardId, screenToFlowPosition, history, beginEditing],
  )

  // Keyboard: typing on the single selected note writes into it; otherwise V / N / A pick a tool.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e) || editingId) return // while typing, ⌘Z belongs to the editor
      const key = e.key.toLowerCase()
      if ((e.metaKey || e.ctrlKey) && !e.altKey && (key === 'z' || key === 'y')) {
        e.preventDefault()
        void trackWrite(key === 'y' || e.shiftKey ? history.redo() : history.undo())
        return
      }
      if (selected.length === 1) {
        if (e.key === 'Enter') {
          e.preventDefault()
          return startEditing(selected[0].id)
        }
        const ch = printableKey(e)
        if (ch) {
          e.preventDefault()
          return startEditing(selected[0].id, ch)
        }
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'escape' || k === 'v') setTool('select')
      else if (k === 'n') setTool('note')
      else if (k === 'a') setTool('arrow')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, editingId, startEditing, history])

  // Removals go through onDelete (tombstones in the db, one undo step), never local-only.
  const onNodesChange: OnNodesChange<NoteFlowNode> = useCallback((changes) => {
    for (const c of changes.getByType('remove')) changes.remove(c)
    setNodes((nds) => (nds ? changes.applyTo(nds) : nds))
  }, [])
  const onEdgesChange: OnEdgesChange<ArrowFlowEdge> = useCallback((changes) => {
    for (const c of changes.getByType('remove')) changes.remove(c)
    setEdges((eds) => changes.applyTo(eds))
  }, [])
  const onNodeDragStop: OnNodeDrag<NoteFlowNode> = useCallback(
    (_e, _node, dragged) => {
      void trackWrite(
        history.record(() => Promise.all(dragged.map((n) => updateNote(n.id, { x: n.position.x, y: n.position.y })))),
      )
    },
    [history],
  )

  const context = useMemo(
    () => ({
      tool,
      editingId,
      initialInput: editing?.initialInput,
      paletteFor: editingId ?? (selected.length === 1 ? selected[0].id : null),
      arrowTarget: drag?.targetId ?? null,
      freshIds: freshIds.current,
      startEditing,
      stopEditing,
      recolor,
      startArrow: (id: Id, e: React.PointerEvent) => arrow.start(id, e, undefined),
      startKnob: (id: Id, side: Side, e: React.PointerEvent) => knob.start(id, e, side),
      growBeside,
    }),
    [
      tool,
      editingId,
      editing?.initialInput,
      selected,
      drag?.targetId,
      arrow,
      knob.start,
      growBeside,
      startEditing,
      stopEditing,
      recolor,
    ],
  )

  if (!nodes) return null

  return (
    <CanvasContext value={context}>
      <div className={`board-canvas tool-${tool}`}>
        <ToolBar
          tool={tool}
          onChange={setTool}
          canUndo={history.canUndo()}
          canRedo={history.canRedo()}
          onUndo={() => void trackWrite(history.undo())}
          onRedo={() => void trackWrite(history.redo())}
        />
        <div
          ref={flowRef}
          className="board-flow"
          onDoubleClick={(e) => {
            if (tool === 'select' && e.target instanceof Element && e.target.classList.contains('react-flow__pane'))
              createNoteAt(e.clientX, e.clientY)
          }}
        >
          <ReactFlow<NoteFlowNode, ArrowFlowEdge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            forceColorMode="light"
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={onNodeDragStop}
            onNodeDoubleClick={(_e, node) => tool === 'select' && startEditing(node.id)}
            onPaneClick={(e) => {
              if (tool === 'note') {
                createNoteAt(e.clientX, e.clientY)
                setTool('select')
              } else stopEditing()
            }}
            onDelete={({ nodes: gone, edges: cut }) =>
              void trackWrite(
                history.record(async () => {
                  await deleteNotes(gone.map((n) => n.id))
                  await deleteArrows(cut.map((e) => e.id))
                }),
              )
            }
            nodesDraggable={tool === 'select'}
            nodesConnectable={false}
            selectionOnDrag={tool === 'select'}
            deleteKeyCode={editingId ? null : ['Backspace', 'Delete']}
            disableKeyboardA11y
            panOnScroll
            zoomOnPinch
            zoomOnScroll={false}
            zoomOnDoubleClick={false}
            panOnDrag={[1]}
            minZoom={0.1}
            maxZoom={4}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#d6d3d1" />
            <ArrowPreview drag={drag} />
            <FitOnce enabled={fitOnMount.current === true} />
          </ReactFlow>
        </div>
        {tool !== 'select' && (
          <p className="tool-hint" key={tool}>
            {tool === 'note'
              ? 'Cliquez sur le canvas pour poser un post-it'
              : "Glissez d'un post-it à un autre · Échap pour annuler"}
          </p>
        )}
      </div>
    </CanvasContext>
  )
}
