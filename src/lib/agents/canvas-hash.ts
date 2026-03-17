import { createHash } from 'crypto'
import type { FlowNode, FlowEdge } from '@/types'

export function computeCanvasHash(nodes: FlowNode[], edges: FlowEdge[]): string {
  const sortedNodes = [...nodes]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(({ id, label, type, requirement_id }) => ({ id, label, type, requirement_id }))
  const sortedEdges = [...edges]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(({ id, source_node_id, target_node_id, label }) => ({ id, source_node_id, target_node_id, label }))
  const payload = JSON.stringify({ nodes: sortedNodes, edges: sortedEdges })
  return createHash('sha256').update(payload).digest('hex')
}
