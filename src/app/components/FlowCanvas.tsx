'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  getBezierPath,
  type Node,
  type Edge,
  type EdgeProps,
  type OnConnect,
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { saveNodePosition, saveEdge, deleteEdge, generateFlow } from '@/app/actions'
import { LoadingDots } from '@/app/components/LoadingDots'
import type { FlowNode, FlowEdge, Requirement } from '@/types'

// Brand palette constants
const EDGE_COLOR = '#1D1D1F'
const STEP_COLOR = '#1D1D1F'
const DECISION_COLOR = '#C97D60'

// Threshold: if target is this many px above source, treat as a back-edge
const BACK_EDGE_THRESHOLD = 30

// Threshold: if target is this many px to the right of source, treat as a cross-column forward edge
const CROSS_FORWARD_THRESHOLD = 180

// Lane header width (must match COLUMN_W in actions/index.ts)
const LANE_HEADER_W = 300

// Decision node visual dimensions (must stay in sync with NODE_H_DECISION in actions/index.ts)
const DEC_W = 200
const DEC_H = 120

interface PersonaSummary {
  id: string
  name: string
  updated_at: string
}

interface Props {
  projectId: string
  initialPersonaId?: string
  initialNodes: FlowNode[]
  initialEdges: FlowEdge[]
  requirements: Requirement[]
  personas: PersonaSummary[]
}

function toRFNodes(nodes: FlowNode[]): Node[] {
  return nodes.map((n) => {
    if (n.type === 'laneHeader') {
      return {
        id: n.id,
        position: { x: n.position_x, y: n.position_y },
        data: { label: n.label },
        type: 'laneHeaderNode',
        draggable: false,
        selectable: false,
        focusable: false,
      }
    }
    return {
      id: n.id,
      position: { x: n.position_x, y: n.position_y },
      data: { label: n.label },
      type: n.type === 'decision' ? 'decisionNode' : 'stepNode',
    }
  })
}

/**
 * Convert DB edges to React Flow edges.
 * Back-edges (target sits above source) are routed through left/right handles.
 * Cross-column forward edges (target is far to the right) also use right/left handles.
 * Lane header nodes are excluded from all edge connections.
 */
function toRFEdges(edges: FlowEdge[], nodes: FlowNode[]): Edge[] {
  const posMap = new Map(nodes.map((n) => [n.id, { x: n.position_x, y: n.position_y }]))
  const typeMap = new Map(nodes.map((n) => [n.id, n.type]))
  const laneHeaderIds = new Set(nodes.filter((n) => n.type === 'laneHeader').map((n) => n.id))

  return edges
    .filter((e) => !laneHeaderIds.has(e.source_node_id) && !laneHeaderIds.has(e.target_node_id))
    .map((e) => {
      const sourcePos = posMap.get(e.source_node_id) ?? { x: 0, y: 0 }
      const targetPos = posMap.get(e.target_node_id) ?? { x: 0, y: 0 }
      const sourceType = typeMap.get(e.source_node_id)

      const isBackEdge = targetPos.y < sourcePos.y - BACK_EDGE_THRESHOLD
      const isCrossForward = !isBackEdge && targetPos.x - sourcePos.x > CROSS_FORWARD_THRESHOLD

      const sourceHandle = isBackEdge || isCrossForward
        ? sourceType === 'decision' ? 'right' : 'right-out'
        : undefined
      const targetHandle = isBackEdge || isCrossForward ? 'left-in' : undefined

      return {
        id: e.id,
        source: e.source_node_id,
        target: e.target_node_id,
        sourceHandle,
        targetHandle,
        type: 'labelledEdge',
        label: e.label ?? undefined,
        data: { isBackEdge, isCrossForward },
        markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR, width: 22, height: 22 },
        style: { stroke: EDGE_COLOR, strokeWidth: 2.5 },
      }
    })
}

// ── Custom edge ───────────────────────────────────────────────────────────────

function LabelledEdge({
  id,
  sourceX, sourceY,
  targetX, targetY,
  sourcePosition, targetPosition,
  label,
  style,
  markerEnd,
  data,
}: EdgeProps) {
  const isBackEdge = !!(data as Record<string, unknown>)?.isBackEdge
  const isCrossForward = !!(data as Record<string, unknown>)?.isCrossForward

  // Cross-column forward edges use a bezier arc so they don't step horizontally
  // through intermediate column nodes. Back-edges and normal edges use smooth-step.
  const [edgePath] = isCrossForward
    ? getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
    : getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 8 })

  // Label positioning:
  // - cross-forward: centered horizontally between source and target, above
  // - back-edge: near source exit point
  // - normal: above the target arrival point
  const labelTransform = isCrossForward
    ? `translate(-50%, -100%) translate(${(sourceX + targetX) / 2}px, ${Math.min(sourceY, targetY) - 8}px)`
    : isBackEdge
    ? `translate(0%, -50%) translate(${sourceX + 16}px, ${sourceY}px)`
    : `translate(-50%, -100%) translate(${targetX}px, ${targetY - 36}px)`

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: labelTransform,
              zIndex: 10000,
              pointerEvents: 'all',
              fontSize: 11,
              fontWeight: 700,
              color: '#19323C',
              backgroundColor: '#ffffff',
              padding: '2px 8px',
              borderRadius: 4,
              boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
              whiteSpace: 'nowrap',
            }}
            className="nodrag nopan"
          >
            {label as string}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

// ── Node components ──────────────────────────────────────────────────────────

function StepNode({ data }: { data: Record<string, unknown> }) {
  return (
    <div
      style={{ width: 220, border: `2.5px solid ${STEP_COLOR}` }}
      className="rounded-xl bg-white shadow-md"
    >
      <Handle type="target" position={Position.Top} style={{ background: STEP_COLOR, borderColor: '#fff', width: 10, height: 10 }} />
      <Handle type="target" id="left-in" position={Position.Left} style={{ background: STEP_COLOR, borderColor: '#fff', width: 10, height: 10 }} />
      <div className="px-4 py-3 text-center">
        <p className="text-xs font-semibold leading-snug" style={{ color: STEP_COLOR }}>
          {data.label as string}
        </p>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: STEP_COLOR, borderColor: '#fff', width: 10, height: 10 }} />
      <Handle type="source" id="right-out" position={Position.Right} style={{ background: STEP_COLOR, borderColor: '#fff', width: 10, height: 10 }} />
    </div>
  )
}

function DecisionNode({ data }: { data: Record<string, unknown> }) {
  return (
    <div style={{ position: 'relative', width: DEC_W, height: DEC_H }}>
      <svg
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        width={DEC_W}
        height={DEC_H}
      >
        <polygon
          points={`${DEC_W / 2},0 ${DEC_W},${DEC_H / 2} ${DEC_W / 2},${DEC_H} 0,${DEC_H / 2}`}
          fill="#FAF0EB"
          stroke={DECISION_COLOR}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      </svg>

      <Handle type="target" position={Position.Top} style={{ background: DECISION_COLOR, borderColor: '#fff', zIndex: 10, width: 10, height: 10 }} />
      <Handle type="target" id="left-in" position={Position.Left} style={{ background: DECISION_COLOR, borderColor: '#fff', zIndex: 10, width: 10, height: 10 }} />

      <div
        style={{
          position: 'relative',
          zIndex: 10,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `8px ${DEC_W * 0.22}px`,
        }}
      >
        <p style={{ fontSize: 11, fontWeight: 600, color: '#19323C', textAlign: 'center', lineHeight: 1.35 }}>
          {data.label as string}
        </p>
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: DECISION_COLOR, borderColor: '#fff', zIndex: 10, width: 10, height: 10 }} />
      <Handle type="source" id="right" position={Position.Right} style={{ background: DECISION_COLOR, borderColor: '#fff', zIndex: 10, width: 10, height: 10 }} />
    </div>
  )
}

function LaneHeaderNode({ data }: { data: Record<string, unknown> }) {
  return (
    <div
      style={{
        width: LANE_HEADER_W,
        background: '#1D1D1F',
        borderRadius: 10,
        padding: '8px 16px',
        pointerEvents: 'none',
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#ffffff',
          textAlign: 'center',
          margin: 0,
        }}
      >
        {data.label as string}
      </p>
    </div>
  )
}

const nodeTypes = { stepNode: StepNode, decisionNode: DecisionNode, laneHeaderNode: LaneHeaderNode }
const edgeTypes = { labelledEdge: LabelledEdge }

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Latest ISO timestamp from an array of strings (ignores nullish values). */
function maxDate(dates: (string | null | undefined)[]): string | null {
  const valid = dates.filter(Boolean) as string[]
  if (!valid.length) return null
  return valid.reduce((a, b) => (a > b ? a : b))
}

// ── Canvas ───────────────────────────────────────────────────────────────────

export default function FlowCanvas({ projectId, initialPersonaId = '', initialNodes, initialEdges, requirements, personas }: Props) {
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(initialPersonaId)

  // Derive the subset of nodes/edges for the current persona selection.
  // Lane header nodes (type === 'laneHeader') are always included — they are project-level
  // and should appear as column headers regardless of which persona is selected.
  const filteredNodes = useMemo(() => {
    return initialNodes.filter((n) =>
      n.type === 'laneHeader' ||
      (selectedPersonaId ? n.persona_id === selectedPersonaId : n.persona_id === null)
    )
  }, [initialNodes, selectedPersonaId])

  const filteredEdges = useMemo(() => {
    return initialEdges.filter((e) =>
      selectedPersonaId ? e.persona_id === selectedPersonaId : e.persona_id === null
    )
  }, [initialEdges, selectedPersonaId])

  const [nodes, setNodes, onNodesChange] = useNodesState(toRFNodes(filteredNodes))
  const [edges, setEdges, onEdgesChange] = useEdgesState(toRFEdges(filteredEdges, filteredNodes))

  // Re-initialise React Flow when the persona selection changes.
  useEffect(() => {
    setNodes(toRFNodes(filteredNodes))
    setEdges(toRFEdges(filteredEdges, filteredNodes))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPersonaId])

  const [isPending, startTransition] = useTransition()
  const [generateError, setGenerateError] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Smart button state ───────────────────────────────────────────────────

  /**
   * Determine whether the generate button should be active.
   * Lane header nodes are excluded from the "has flow" check — only step/decision
   * nodes that represent actual requirements count.
   *
   * hasFlow   — there are non-header nodes for the current persona selection
   * upToDate  — no requirement or persona has been updated after the last generation
   */
  const flowNodes = filteredNodes.filter((n) => n.type !== 'laneHeader')
  const hasFlow = flowNodes.length > 0

  const latestGeneratedAt = hasFlow
    ? maxDate(flowNodes.map((n) => n.created_at))
    : null

  const latestDataChangedAt = maxDate([
    ...requirements.flatMap((r) => [r.created_at, r.updated_at]),
    ...personas.map((p) => p.updated_at),
  ])

  const upToDate =
    hasFlow &&
    latestGeneratedAt !== null &&
    (latestDataChangedAt === null || latestDataChangedAt <= latestGeneratedAt)

  const buttonDisabled = isPending || requirements.length === 0 || upToDate

  const buttonLabel = isPending
    ? null // shown separately with spinner
    : !hasFlow
    ? '✦ Generate Flow'
    : upToDate
    ? '✓ Up to date'
    : '↺ Re-generate'

  const buttonStyle: React.CSSProperties = upToDate
    ? { backgroundColor: '#E5E5EA', color: '#86868B' }
    : { backgroundColor: isPending ? '#d4c900' : '#F0E100', color: '#1D1D1F' }

  // ── Event handlers ───────────────────────────────────────────────────────

  const onNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    // Lane header nodes are not user-draggable — skip position save
    if (node.type === 'laneHeaderNode') return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveNodePosition(node.id, node.position.x, node.position.y)
    }, 500)
  }, [])

  const onConnect: OnConnect = useCallback(
    async (connection) => {
      if (!connection.source || !connection.target) return
      const dbId = await saveEdge(projectId, connection.source, connection.target, selectedPersonaId || null)
      if (!dbId) return
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: dbId,
            type: 'labelledEdge',
            data: { isBackEdge: false, isCrossForward: false },
            markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR, width: 22, height: 22 },
            style: { stroke: EDGE_COLOR, strokeWidth: 2.5 },
          },
          eds
        )
      )
    },
    [projectId, selectedPersonaId, setEdges]
  )

  const onEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    deletedEdges.forEach((e) => deleteEdge(e.id))
  }, [])

  const handleGenerateFlow = () => {
    setGenerateError(null)
    startTransition(async () => {
      const result = await generateFlow(projectId, selectedPersonaId || null)
      if (result?.error) {
        setGenerateError(result.error)
        return
      }
      // Preserve current persona selection in the URL so the page
      // re-opens on the same persona after reload instead of "All requirements"
      const url = new URL(window.location.href)
      if (selectedPersonaId) {
        url.searchParams.set('persona', selectedPersonaId)
      } else {
        url.searchParams.delete('persona')
      }
      window.location.href = url.toString()
    })
  }

  return (
    <div className="relative h-full w-full">
      {/* Toolbar: persona selector + generate button */}
      <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          {/* Persona selector */}
          {personas.length > 0 && (
            <select
              value={selectedPersonaId}
              onChange={(e) => setSelectedPersonaId(e.target.value)}
              disabled={isPending}
              className="rounded-full border border-[#D2D2D7] bg-white px-3 py-2 text-sm text-[#1D1D1F] shadow-md focus:border-[#1D1D1F] focus:outline-none disabled:opacity-60"
            >
              <option value="">All requirements</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}

          {/* Generate / Re-generate / Up-to-date button */}
          <button
            onClick={handleGenerateFlow}
            disabled={buttonDisabled}
            className="flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold shadow-md transition-colors disabled:cursor-not-allowed"
            style={buttonStyle}
          >
            {isPending ? <LoadingDots /> : buttonLabel}
          </button>
        </div>

        {generateError && <p className="text-xs text-red-500">{generateError}</p>}
        {requirements.length === 0 && !isPending && (
          <p className="text-xs" style={{ color: '#86868B' }}>Synthesise requirements first</p>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-16 left-4 z-10 flex flex-col gap-1.5 rounded-lg border bg-white p-3 text-xs shadow-sm" style={{ color: '#1D1D1F', borderColor: '#d2d2d7' }}>
        <div className="flex items-center gap-2">
          <div className="h-3 w-5 rounded" style={{ border: `2.5px solid ${STEP_COLOR}`, backgroundColor: '#fff' }} />
          <span>Step</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rotate-45 rounded-sm" style={{ border: `2.5px solid ${DECISION_COLOR}`, backgroundColor: '#FDF6DC' }} />
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
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'labelledEdge' }}
        fitView
        fitViewOptions={{ padding: 0.15 }}
      >
        <Background gap={16} color="#d2d2d7" />
        <Controls />
        <MiniMap
          nodeColor={(n) => (n.type === 'decisionNode' ? DECISION_COLOR : STEP_COLOR)}
          maskColor="rgba(243,247,240,0.7)"
        />
      </ReactFlow>
    </div>
  )
}
