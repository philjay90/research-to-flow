import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import FlowCanvas from '@/app/components/FlowCanvas'
import type { Project, FlowNode, FlowEdge, Requirement } from '@/types'

export default async function FlowPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { data: project, error: projectError } = await supabase
    .from('project')
    .select('*')
    .eq('id', id)
    .single()

  if (projectError || !project) notFound()

  const [{ data: nodes }, { data: edges }, { data: requirements }] = await Promise.all([
    supabase.from('flow_node').select('*').eq('project_id', id).order('created_at', { ascending: true }),
    supabase.from('flow_edge').select('*').eq('project_id', id),
    supabase.from('requirement').select('*').eq('project_id', id),
  ])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header bar */}
      <header className="flex items-center justify-between bg-[#19323C] px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${id}`}
            className="text-sm text-white/80 hover:text-white transition-colors"
          >
            ← {(project as Project).name}
          </Link>
          <span className="text-sm text-white/30">/</span>
          <span className="text-sm font-medium text-white">Flow</span>
        </div>
        <span className="text-xs text-white/50">
          Drag nodes · Connect handles · Delete edges with Backspace
        </span>
      </header>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden">
        <FlowCanvas
          projectId={id}
          initialNodes={(nodes as FlowNode[]) ?? []}
          initialEdges={(edges as FlowEdge[]) ?? []}
          requirements={(requirements as Requirement[]) ?? []}
        />
      </div>
    </div>
  )
}
