'use client'

import { useCallback, useRef, useState, useTransition } from 'react'
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

interface Props {
  projectId: string
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

function toRFEdges(edges: FlowEdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    label: e.label ?? undefined,
    labelStyle: { fontSize: 11, fontWeight: 600, fill: '#4b5563' },
    labelBgStyle: { fill: '#f9fafb', fillOpacity: 0.9 },
    labelBgPadding: [4, 6] as [number, number],
    labelBgBorderRadius: 4,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
    style: { stroke: '#6366f1', strokeWidth: 2 },
  }))
}

// Rounded rectangle — for linear task steps
function StepNode({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="w-52 rounded-xl border-2 border-indigo-400 bg-white shadow-sm">
      <Handle type="target" position={Position.Top} className="!bg-indigo-400 !border-white" />
      <Handle type="target" id="left-in" position={Position.Left} className="!bg-indigo-400 !border-white" />
      <div className="px-4 py-3 text-center">
        <p className="text-xs font-medium leading-snug text-gray-800">{data.label as string}</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-400 !border-white" />
      <Handle type="source" id="right-out" position={Position.Right} className="!bg-indigo-400 !border-white" />
    </div>
  )
}

// Diamond — for branching decision points
function DecisionNode({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="relative flex h-28 w-52 items-center justify-center">
      <Handle type="target" position={Position.Top} style={{ top: 0 }} className="!bg-amber-500 !border-white !z-10" />
      <Handle type="target" id="left-in" position={Position.Left} style={{ left: 0 }} className="!bg-amber-500 !border-white !z-10" />
      {/* Rotated square forms the diamond background */}
      <div className="absolute h-20 w-20 rotate-45 rounded-md border-2 border-amber-400 bg-amber-50" />
      {/* Content counter-rotates to stay upright */}
      <div className="relative z-10 px-6 text-center">
        <p className="text-xs font-medium leading-snug text-amber-900">{data.label as string}</p>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ bottom: 0 }} className="!bg-amber-500 !border-white !z-10" />
      <Handle type="source" id="right" position={Position.Right} style={{ right: 0 }} className="!bg-amber-500 !border-white !z-10" />
    </div>
  )
}

const nodeTypes = { stepNode: StepNode, decisionNode: DecisionNode }

export default function FlowCanvas({ projectId, initialNodes, initialEdges, requirements }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState(toRFNodes(initialNodes))
  const [edges, setEdges, onEdgesChange] = useEdgesState(toRFEdges(initialEdges))
  const [isPending, startTransition] = useTransition()
  const [generateError, setGenerateError] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onNodeDragStop = useCallback((_event: MouseEvent, node: Node) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveNodePosition(node.id, node.position.x, node.position.y)
    }, 500)
  }, [])

  const onConnect: OnConnect = useCallback(
    async (connection) => {
      if (!connection.source || !connection.target) return
      const dbId = await saveEdge(projectId, connection.source, connection.target)
      if (!dbId) return
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: dbId,
            markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
            style: { stroke: '#6366f1', strokeWidth: 2 },
          },
          eds
        )
      )
    },
    [projectId, setEdges]
  )

  const onEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    deletedEdges.forEach((e) => deleteEdge(e.id))
  }, [])

  const handleGenerateFlow = () => {
    setGenerateError(null)
    startTransition(async () => {
      const result = await generateFlow(projectId)
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
          className="flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-md hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
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
          <p className="text-xs text-gray-400">Synthesise requirements first</p>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-16 left-4 z-10 flex flex-col gap-1.5 rounded-lg border bg-white p-3 text-xs text-gray-600 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-5 rounded border-2 border-indigo-400 bg-white" />
          <span>Step</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rotate-45 rounded-sm border-2 border-amber-400 bg-amber-50" />
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
        fitView
        fitViewOptions={{ padding: 0.15 }}
      >
        <Background gap={16} color="#e5e7eb" />
        <Controls />
        <MiniMap
          nodeColor={(n) => (n.type === 'decisionNode' ? '#fbbf24' : '#818cf8')}
          maskColor="rgba(255,255,255,0.7)"
        />
      </ReactFlow>
    </div>
  )
}
