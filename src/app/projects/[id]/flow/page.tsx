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
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header bar */}
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <div className="flex items-center gap-4">
          <a
            href={`/projects/${id}`}
            className="text-sm text-indigo-600 hover:underline"
          >
            ← {(project as Project).name}
          </a>
          <span className="text-sm text-gray-400">/</span>
          <span className="text-sm font-medium text-gray-700">Flow</span>
        </div>
        <span className="text-xs text-gray-400">
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
