'use client'

import dynamic from 'next/dynamic'
import type { FlowNode, FlowEdge, Requirement } from '@/types'

const FlowCanvas = dynamic(() => import('@/app/components/FlowCanvas'), { ssr: false })

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

export function FlowCanvasWrapper(props: Props) {
  return <FlowCanvas {...props} />
}
