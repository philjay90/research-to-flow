import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { FlowNode, FlowEdge, Requirement } from '@/types'
import { AppHeader } from '@/app/components/AppHeader'
import FlowCanvas from '@/app/components/FlowCanvas'

export default async function CanvasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ persona?: string }>
}) {
  const { id } = await params
  const { persona: initialPersonaId } = await searchParams
  const supabase = await createClient()

  const { data: project, error: projectError } = await supabase
    .from('project')
    .select('*')
    .eq('id', id)
    .single()

  if (projectError || !project) notFound()

  // Load ALL nodes/edges for the project (unfiltered by persona_id).
  // FlowCanvas filters client-side when the persona selector changes.
  const [{ data: nodes }, { data: edges }, { data: requirements }, { data: personas }] = await Promise.all([
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
      .select('id, created_at, updated_at, business_opportunity, user_story, acceptance_criteria, dfv_tag, source_input_ids, project_id, flow_id, status')
      .eq('project_id', id),
    // Include updated_at so the client can detect if personas changed since last generation
    supabase
      .from('persona')
      .select('id, name, updated_at')
      .eq('project_id', id)
      .order('created_at', { ascending: true }),
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
          initialPersonaId={initialPersonaId ?? ''}
          initialNodes={(nodes ?? []) as FlowNode[]}
          initialEdges={(edges ?? []) as FlowEdge[]}
          requirements={(requirements ?? []) as Requirement[]}
          personas={(personas ?? []) as { id: string; name: string; updated_at: string }[]}
        />
      </div>
    </>
  )
}
