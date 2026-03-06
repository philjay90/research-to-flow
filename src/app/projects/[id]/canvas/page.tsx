import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { FlowNode, FlowEdge, Requirement } from '@/types'
import { AppHeader } from '@/app/components/AppHeader'
import FlowCanvas from '@/app/components/FlowCanvas'

export default async function CanvasPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: project, error: projectError } = await supabase
    .from('project')
    .select('*')
    .eq('id', id)
    .single()

  if (projectError || !project) notFound()

  const [{ data: nodes }, { data: edges }, { data: requirements }] = await Promise.all([
    supabase
      .from('flow_node')
      .select('*')
      .eq('project_id', id)
      .is('flow_id', null),
    supabase
      .from('flow_edge')
      .select('*')
      .eq('project_id', id)
      .is('flow_id', null),
    supabase
      .from('requirement')
      .select('*')
      .eq('project_id', id),
  ])

  return (
    <>
      <AppHeader
        crumbs={[
          { label: project.name, href: `/projects/${id}` },
          { label: 'Canvas' },
        ]}
        right={
          <p className="text-xs text-white/50">
            Drag to connect nodes · Delete key removes edges
          </p>
        }
      />
      <div style={{ height: 'calc(100vh - 57px)' }}>
        <FlowCanvas
          projectId={id}
          initialNodes={(nodes ?? []) as FlowNode[]}
          initialEdges={(edges ?? []) as FlowEdge[]}
          requirements={(requirements ?? []) as Requirement[]}
        />
      </div>
    </>
  )
}
