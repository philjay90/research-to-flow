import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Project, Persona } from '@/types'
import { AppHeader } from '@/app/components/AppHeader'
import { FlowsTabClient } from '@/app/components/FlowsTabClient'
import { AddFlowButton } from '@/app/components/AddFlowButton'
import { HelpTooltip } from '@/app/components/HelpTooltip'
import { ResearchPanel } from '@/app/components/ResearchPanel'

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab } = await searchParams
  const supabase = await createClient()

  const { data: project, error: projectError } = await supabase
    .from('project')
    .select('*')
    .eq('id', id)
    .single()

  if (projectError || !project) notFound()

  const { data: personas } = await supabase
    .from('persona')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: true })

  const p = project as Project
  const personaList = (personas ?? []) as Persona[]

  const showResearch = p.ux_research_enabled === true
  const activeTab = showResearch && tab === 'research' ? 'research' : 'flows'

  const tabClass = (t: string) =>
    `px-4 py-2 text-sm font-medium rounded-full transition-colors ${
      activeTab === t
        ? 'bg-[#1D1D1F] text-white'
        : 'text-[#86868B] hover:text-[#1D1D1F]'
    }`

  return (
    <>
      <AppHeader crumbs={[{ label: p.name }]} />

      <main className="px-8 py-12">

        {/* ── Tab bar (only shown when research is enabled) ── */}
        {showResearch && (
          <nav className="flex items-center gap-1 mb-8">
            <a href={`/projects/${id}`} className={tabClass('flows')}>
              Flows
            </a>
            <a href={`/projects/${id}?tab=research`} className={tabClass('research')}>
              Research
            </a>
          </nav>
        )}

        {/* ── Flows tab ── */}
        {activeTab === 'flows' && (
          <>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-[#1D1D1F]">Flows</h1>
                <HelpTooltip
                  text="Each Flow bundles a Persona, their User Journey, and a Happy Path Canvas. Add a flow, then add inputs and synthesize to generate the persona."
                  position="right"
                />
                {personaList.length > 0 && (
                  <span className="text-sm opacity-60 text-[#1D1D1F]">{personaList.length}</span>
                )}
              </div>
              <AddFlowButton projectId={id} />
            </div>

            {personaList.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 text-center shadow-sm">
                <p className="text-lg font-medium text-[#1D1D1F]">No flows yet</p>
                <p className="mt-2 text-sm text-[#86868B] max-w-sm">
                  Click <span className="font-medium">+ Add Flow</span> to create your first flow, then add research inputs and synthesize.
                </p>
              </div>
            ) : (
              <FlowsTabClient personas={personaList} projectId={id} />
            )}
          </>
        )}

        {/* ── Research tab ── */}
        {activeTab === 'research' && showResearch && (
          <ResearchPanel
            projectId={id}
            initialBrief={p.ux_research_brief ?? null}
            initialStatus={p.research_status ?? 'idle'}
          />
        )}

      </main>
    </>
  )
}
