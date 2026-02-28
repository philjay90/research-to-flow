'use client'

import React, { useCallback, useRef, useState, useTransition } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnConnect,
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { saveNodePosition, saveEdge, deleteEdge, generateFlow } from '@/app/actions'
import type { FlowNode, FlowEdge, Requirement } from '@/types'

// Brand palette constants
const EDGE_COLOR = '#19323C'
const STEP_COLOR = '#19323C'
const DECISION_COLOR = '#CBA328'

// Threshold: if target is this many px above source, treat as a back-edge
const BACK_EDGE_THRESHOLD = 30

interface Props {
  flowId: string
  initialNodes: FlowNode[]
  initialEdges: FlowEdge[]
  requirements: Requirement[]
}

function toRFNodes(nodes: FlowNode[]): Node[] {
  return nodes.map((n) => ({
    id: n.id,
    position: { x: n.position_x, y: n.position_y },
    data: { label: n.label },
    type: n.type === 'decision' ? 'decisionNode' : 'stepNode',
  }))
}

/**
 * Convert DB edges to React Flow edges.
 * Back-edges (target sits above source) are routed through the left/right
 * handles instead of bottom/top so they don't produce awkward downward loops.
 * All edges use `smoothstep` for clean orthogonal routing.
 */
function toRFEdges(edges: FlowEdge[], nodes: FlowNode[]): Edge[] {
  const posMap = new Map(nodes.map((n) => [n.id, n.position_y]))
  const typeMap = new Map(nodes.map((n) => [n.id, n.type]))

  return edges.map((e) => {
    const sourceY = posMap.get(e.source_node_id) ?? 0
    const targetY = posMap.get(e.target_node_id) ?? 0
    const sourceType = typeMap.get(e.source_node_id)

    // Back-edge: target is significantly above source → route via sides
    const isBackEdge = targetY < sourceY - BACK_EDGE_THRESHOLD
    const sourceHandle = isBackEdge
      ? sourceType === 'decision' ? 'right' : 'right-out'
      : undefined
    const targetHandle = isBackEdge ? 'left-in' : undefined

    return {
      id: e.id,
      source: e.source_node_id,
      target: e.target_node_id,
      sourceHandle,
      targetHandle,
      type: 'smoothstep',

      label: e.label ?? undefined,
      labelStyle: { fontSize: 11, fontWeight: 600, fill: '#19323C' },
      labelBgStyle: { fill: '#F3F7F0', fillOpacity: 0.95 },
      labelBgPadding: [4, 6] as [number, number],
      labelBgBorderRadius: 4,
      markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR },
      style: { stroke: EDGE_COLOR, strokeWidth: 1.5 },
    }
  })
}

// ── Node components ──────────────────────────────────────────────────────────

function StepNode({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="w-52 rounded-xl border-2 bg-white shadow-sm" style={{ borderColor: STEP_COLOR }}>
      <Handle type="target" position={Position.Top} style={{ background: STEP_COLOR, borderColor: '#fff' }} />
      <Handle type="target" id="left-in" position={Position.Left} style={{ background: STEP_COLOR, borderColor: '#fff' }} />
      <div className="px-4 py-3 text-center">
        <p className="text-xs font-medium leading-snug" style={{ color: STEP_COLOR }}>{data.label as string}</p>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: STEP_COLOR, borderColor: '#fff' }} />
      <Handle type="source" id="right-out" position={Position.Right} style={{ background: STEP_COLOR, borderColor: '#fff' }} />
    </div>
  )
}

function DecisionNode({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="relative flex h-28 w-52 items-center justify-center">
      <Handle type="target" position={Position.Top} style={{ top: 0, background: DECISION_COLOR, borderColor: '#fff', zIndex: 10 }} />
      <Handle type="target" id="left-in" position={Position.Left} style={{ left: 0, background: DECISION_COLOR, borderColor: '#fff', zIndex: 10 }} />
      <div className="absolute h-20 w-20 rotate-45 rounded-md border-2" style={{ borderColor: DECISION_COLOR, backgroundColor: '#FDF6DC' }} />
      <div className="relative z-10 px-6 text-center">
        <p className="text-xs font-medium leading-snug" style={{ color: '#19323C' }}>{data.label as string}</p>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ bottom: 0, background: DECISION_COLOR, borderColor: '#fff', zIndex: 10 }} />
      <Handle type="source" id="right" position={Position.Right} style={{ right: 0, background: DECISION_COLOR, borderColor: '#fff', zIndex: 10 }} />
    </div>
  )
}

const nodeTypes = { stepNode: StepNode, decisionNode: DecisionNode }

// ── Canvas ───────────────────────────────────────────────────────────────────

export default function FlowCanvas({ flowId, initialNodes, initialEdges, requirements }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState(toRFNodes(initialNodes))
  const [edges, setEdges, onEdgesChange] = useEdgesState(toRFEdges(initialEdges, initialNodes))
  const [isPending, startTransition] = useTransition()
  const [generateError, setGenerateError] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveNodePosition(node.id, node.position.x, node.position.y)
    }, 500)
  }, [])

  const onConnect: OnConnect = useCallback(
    async (connection) => {
      if (!connection.source || !connection.target) return
      const dbId = await saveEdge(flowId, connection.source, connection.target)
      if (!dbId) return
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: dbId,
            type: 'smoothstep',
      
            markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR },
            style: { stroke: EDGE_COLOR, strokeWidth: 1.5 },
          },
          eds
        )
      )
    },
    [flowId, setEdges]
  )

  const onEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    deletedEdges.forEach((e) => deleteEdge(e.id))
  }, [])

  const handleGenerateFlow = () => {
    setGenerateError(null)
    startTransition(async () => {
      const result = await generateFlow(flowId)
      if (result?.error) {
        setGenerateError(result.error)
        return
      }
      window.location.reload()
    })
  }

  return (
    <div className="relative h-full w-full">
      {/* Generate Flow button */}
      <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 flex flex-col items-center gap-2">
        <button
          onClick={handleGenerateFlow}
          disabled={isPending || requirements.length === 0}
          className="flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium text-white shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: isPending ? '#d63558' : '#EE4266' }}
        >
          {isPending ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Generating…
            </>
          ) : (
            '✦ Generate Flow'
          )}
        </button>
        {generateError && <p className="text-xs text-red-500">{generateError}</p>}
        {requirements.length === 0 && !isPending && (
          <p className="text-xs" style={{ color: '#7286A0' }}>Synthesise requirements first</p>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-16 left-4 z-10 flex flex-col gap-1.5 rounded-lg border bg-white p-3 text-xs shadow-sm" style={{ color: '#19323C', borderColor: '#d1d9e0' }}>
        <div className="flex items-center gap-2">
          <div className="h-3 w-5 rounded border-2" style={{ borderColor: STEP_COLOR, backgroundColor: '#fff' }} />
          <span>Step</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rotate-45 rounded-sm border-2" style={{ borderColor: DECISION_COLOR, backgroundColor: '#FDF6DC' }} />
          <span>Decision</span>
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        fitView
        fitViewOptions={{ padding: 0.15 }}
      >
        <Background gap={16} color="#d1d9e0" />
        <Controls />
        <MiniMap
          nodeColor={(n) => (n.type === 'decisionNode' ? DECISION_COLOR : STEP_COLOR)}
          maskColor="rgba(243,247,240,0.7)"
        />
      </ReactFlow>
    </div>
  )
}
