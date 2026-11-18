import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
  type OnEdgesChange,
  type OnNodeDrag,
  type OnNodesChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { DEFAULT_NOTE_WIDTH, type Id, type NoteColor } from '@chart/shared'
import { addArrow, addNote, deleteArrows, deleteNotes, listArrows, listNotes, updateNote } from '../db/repo'
import { trackWrite } from '../db/saveErrors'
import { ArrowPreview, useArrowDrag } from './arrowDrag'
import { CanvasContext, type Tool } from './CanvasContext'
import { ElbowEdge } from './ElbowEdge'
import { mergeEdges, mergeNodes, type ArrowFlowEdge, type NoteFlowNode } from './flowMapping'
import { isTypingTarget, printableKey } from './keys'
import { getLastColor, setLastColor } from './lastColor'
import { NoteNode } from './NoteNode'
import { ToolBar } from './ToolBar'
import './canvas.css'

const nodeTypes = { note: NoteNode }
const edgeTypes = { elbow: ElbowEdge }

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
  const { screenToFlowPosition } = useReactFlow()

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

  const startEditing = useCallback((id: Id, initialInput?: string) => setEditing({ id, initialInput }), [])
  // Leaving a note also deselects it, so a stray Backspace right after Escape cannot delete it.
  const stopEditing = useCallback(() => {
    setEditing((cur) => {
      if (cur) setNodes((nds) => nds && nds.map((n) => (n.id === cur.id && n.selected ? { ...n, selected: false } : n)))
      return null
    })
  }, [])
  const recolor = useCallback((id: Id, color: NoteColor) => {
    void trackWrite(updateNote(id, { color }))
    setLastColor(color)
  }, [])

  const arrow = useArrowDrag((from, to) => {
    if (!to) return // missed: stay in arrow mode, Escape to give up
    void trackWrite(addArrow(boardId, from, to))
    setTool('select')
  })

  const createNoteAt = useCallback(
    (clientX: number, clientY: number) => {
      const p = screenToFlowPosition({ x: clientX, y: clientY })
      void trackWrite(addNote(boardId, { x: p.x - DEFAULT_NOTE_WIDTH / 2, y: p.y - 30 }, getLastColor())).then((note) => {
        if (!note) return
        freshIds.current.add(note.id)
        setEditing({ id: note.id })
      })
    },
    [boardId, screenToFlowPosition],
  )

  // Keyboard: typing on the single selected note writes into it; otherwise V / N / A pick a tool.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e) || editingId) return
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
  }, [selected, editingId, startEditing])

  // Removals go through onNodesDelete/onEdgesDelete (tombstones in the db), never local-only.
  const onNodesChange: OnNodesChange<NoteFlowNode> = useCallback((changes) => {
    for (const c of changes.getByType('remove')) changes.remove(c)
    setNodes((nds) => (nds ? changes.applyTo(nds) : nds))
  }, [])
  const onEdgesChange: OnEdgesChange<ArrowFlowEdge> = useCallback((changes) => {
    for (const c of changes.getByType('remove')) changes.remove(c)
    setEdges((eds) => changes.applyTo(eds))
  }, [])
  const onNodeDragStop: OnNodeDrag<NoteFlowNode> = useCallback((_e, _node, dragged) => {
    for (const n of dragged) void trackWrite(updateNote(n.id, { x: n.position.x, y: n.position.y }))
  }, [])

  const context = useMemo(
    () => ({
      tool,
      editingId,
      initialInput: editing?.initialInput,
      paletteFor: editingId ?? (selected.length === 1 ? selected[0].id : null),
      arrowTarget: arrow.drag?.targetId ?? null,
      freshIds: freshIds.current,
      startEditing,
      stopEditing,
      recolor,
      startArrow: arrow.start,
    }),
    [tool, editingId, editing?.initialInput, selected, arrow.drag?.targetId, arrow.start, startEditing, stopEditing, recolor],
  )

  if (!nodes) return null

  return (
    <CanvasContext value={context}>
      <div className={`board-canvas tool-${tool}`}>
        <ToolBar tool={tool} onChange={setTool} />
        <div
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
            onNodesDelete={(ns) => void trackWrite(deleteNotes(ns.map((n) => n.id)))}
            onEdgesDelete={(es) => void trackWrite(deleteArrows(es.map((e) => e.id)))}
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
            <ArrowPreview drag={arrow.drag} />
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
