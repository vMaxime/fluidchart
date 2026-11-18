import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  ReactFlow,
  useReactFlow,
  type OnConnect,
  type OnEdgesChange,
  type OnNodeDrag,
  type OnNodesChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { DEFAULT_NOTE_WIDTH, type Id } from '@chart/shared'
import { addArrow, addNote, deleteArrows, deleteNotes, listArrows, listNotes, updateNote } from '../db/repo'
import { trackWrite } from '../db/saveErrors'
import { CanvasContext } from './CanvasContext'
import { ColorBar } from './ColorBar'
import { FloatingEdge } from './FloatingEdge'
import { mergeEdges, mergeNodes, type ArrowFlowEdge, type NoteFlowNode } from './flowMapping'
import { getLastColor } from './lastColor'
import { NoteNode } from './NoteNode'
import './canvas.css'

const nodeTypes = { note: NoteNode }
const edgeTypes = { floating: FloatingEdge }

export function BoardCanvas({ boardId }: { boardId: Id }) {
  const notes = useLiveQuery(() => listNotes(boardId), [boardId])
  const arrows = useLiveQuery(() => listArrows(boardId), [boardId])
  const [nodes, setNodes] = useState<NoteFlowNode[] | null>(null)
  const [edges, setEdges] = useState<ArrowFlowEdge[]>([])
  const fitOnMount = useRef<boolean | null>(null)
  const [editingId, setEditingId] = useState<Id | null>(null)
  const canvasContext = useMemo(
    () => ({
      editingId,
      startEditing: setEditingId,
      // Leaving a note also deselects it, so a stray Backspace right after Escape cannot delete it.
      stopEditing: () => {
        setEditingId(null)
        if (!editingId) return
        setNodes((nds) => nds && nds.map((n) => (n.id === editingId && n.selected ? { ...n, selected: false } : n)))
      },
    }),
    [editingId],
  )
  const { screenToFlowPosition } = useReactFlow()

  useEffect(() => {
    if (!notes) return
    if (fitOnMount.current === null) fitOnMount.current = notes.length > 0
    setNodes((cur) => mergeNodes(notes, cur ?? []))
  }, [notes])
  useEffect(() => {
    if (arrows) setEdges((cur) => mergeEdges(arrows, cur))
  }, [arrows])

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
  const onConnect: OnConnect = useCallback(
    (c) => {
      if (c.source && c.target) void trackWrite(addArrow(boardId, c.source, c.target))
    },
    [boardId],
  )

  function onDoubleClick(e: MouseEvent) {
    if (!(e.target instanceof Element) || !e.target.classList.contains('react-flow__pane')) return
    const p = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    void trackWrite(addNote(boardId, { x: p.x - DEFAULT_NOTE_WIDTH / 2, y: p.y - 30 }, getLastColor())).then(
      (note) => note && setEditingId(note.id),
    )
  }

  if (!nodes) return null
  const selectedIds = nodes.filter((n) => n.selected).map((n) => n.id)

  return (
    <CanvasContext value={canvasContext}>
      <div className="board-canvas" onDoubleClick={onDoubleClick}>
        <ReactFlow<NoteFlowNode, ArrowFlowEdge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          onConnect={onConnect}
          onNodeDoubleClick={(_e, node) => setEditingId(node.id)}
          onPaneClick={() => setEditingId(null)}
          onNodesDelete={(ns) => void trackWrite(deleteNotes(ns.map((n) => n.id)))}
          onEdgesDelete={(es) => void trackWrite(deleteArrows(es.map((e) => e.id)))}
          connectionMode={ConnectionMode.Loose}
          deleteKeyCode={editingId ? null : ['Backspace', 'Delete']}
          panOnScroll
          zoomOnPinch
          zoomOnScroll={false}
          zoomOnDoubleClick={false}
          selectionOnDrag
          panOnDrag={[1]}
          minZoom={0.1}
          maxZoom={4}
          fitView={fitOnMount.current === true}
          fitViewOptions={{ maxZoom: 1 }}
        >
          <Background variant={BackgroundVariant.Dots} />
        </ReactFlow>
        <ColorBar selectedIds={selectedIds} />
      </div>
    </CanvasContext>
  )
}
