import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import FlowCanvas from '@/app/components/FlowCanvas'
import { AppHeader } from '@/app/components/AppHeader'
import type { Project, Flow, FlowNode, FlowEdge, Requirement } from '@/types'

export default async function CanvasPage({
  params,
}: {
  params: Promise<{ id: string; flowId: string }>
}) {
  const { id, flowId } = await params

  const [
    { data: project, error: projectError },
    { data: flow, error: flowError },
  ] = await Promise.all([
    supabase.from('project').select('*').eq('id', id).single(),
    supabase.from('flow').select('*').eq('id', flowId).single(),
  ])

  if (projectError || !project || flowError || !flow) notFound()

  const [{ data: nodes }, { data: edges }, { data: requirements }] = await Promise.all([
    supabase.from('flow_node').select('*').eq('flow_id', flowId).order('created_at', { ascending: true }),
    supabase.from('flow_edge').select('*').eq('flow_id', flowId),
    supabase.from('requirement').select('*').eq('flow_id', flowId),
  ])

  const p = project as Project
  const f = flow as Flow

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <AppHeader
        crumbs={[
          { label: p.name, href: `/projects/${id}` },
          { label: f.name, href: `/projects/${id}/flows/${flowId}` },
          { label: 'Canvas' },
        ]}
        right={
          <span className="text-xs text-white/50">
            Drag nodes · Connect handles · Delete edges with Backspace
          </span>
        }
      />

      <div className="flex-1 overflow-hidden">
        <FlowCanvas
          flowId={flowId}
          initialNodes={(nodes as FlowNode[]) ?? []}
          initialEdges={(edges as FlowEdge[]) ?? []}
          requirements={(requirements as Requirement[]) ?? []}
        />
      </div>
    </div>
  )
}
