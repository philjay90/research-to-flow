import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Project, Persona, Requirement, PersonaRequirement, FlowNode, FlowEdge } from '@/types'
import { AppHeader } from '@/app/components/AppHeader'
import { ProvenanceLegend } from '@/app/components/ProvenanceDot'
import { HelpTooltip } from '@/app/components/HelpTooltip'
import { GenerateJourneyButton } from '@/app/components/GenerateJourneyButton'
import { JourneyMatrix } from '@/app/components/JourneyMatrix'
import { PersonaDetailClient } from '../../personas/[personaId]/PersonaDetailClient'
import { FlowCanvasWrapper } from '@/app/components/FlowCanvasWrapper'

export default async function FlowDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; personaId: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id, personaId } = await params
  const { tab = 'user-group' } = await searchParams
  const supabase = await createClient()

  // Fetch project + persona + requirements in parallel (requirements needed for downstream queries)
  const [
    { data: project, error: projectError },
    { data: persona, error: personaError },
    { data: allRequirements },
  ] = await Promise.all([
    supabase.from('project').select('*').eq('id', id).single(),
    supabase.from('persona').select('*').eq('id', personaId).single(),
    supabase
      .from('requirement')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (projectError || !project || personaError || !persona) notFound()

  const p = project as Project
  const pers = persona as Persona
  const reqs = (allRequirements ?? []) as Requirement[]
  const reqIds = reqs.map((r) => r.id)

  // Fetch the remaining data in parallel (all depend on reqIds or personaId)
  const [
    { data: personaLinks },
    { data: allProjectLinks },
    { data: allPersonaReqLinks },
    { data: flowNodes },
    { data: flowEdges },
  ] = await Promise.all([
    supabase
      .from('persona_requirement')
      .select('requirement_id, link_source')
      .eq('persona_id', personaId),
    reqIds.length > 0
      ? supabase
          .from('persona_requirement')
          .select('requirement_id')
          .in('requirement_id', reqIds)
      : Promise.resolve({ data: [] }),
    reqIds.length > 0
      ? supabase
          .from('persona_requirement')
          .select('persona_id, requirement_id')
          .in('requirement_id', reqIds)
      : Promise.resolve({ data: [] }),
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
  ])

  const nodes = (flowNodes ?? []) as FlowNode[]
  const edges = (flowEdges ?? []) as FlowEdge[]

  // Build persona detail props
  const linkedIds = new Set(
    (personaLinks ?? []).map((l: Pick<PersonaRequirement, 'requirement_id'>) => l.requirement_id)
  )
  const linkSourceMap = new Map(
    (personaLinks ?? []).map((l: Pick<PersonaRequirement, 'requirement_id' | 'link_source'>) => [
      l.requirement_id,
      l.link_source,
    ])
  )

  const linkedRequirements = reqs
    .filter((r) => linkedIds.has(r.id))
    .map((r) => ({ ...r, link_source: linkSourceMap.get(r.id) as 'llm' | 'manual' }))

  const requirementIdsWithAnyPersona = Array.from(
    new Set((allProjectLinks ?? []).map((l: { requirement_id: string }) => l.requirement_id))
  )

  const personaReqLinks = (allPersonaReqLinks ?? []) as { persona_id: string; requirement_id: string }[]

  const activeTab = ['user-group', 'journey', 'canvas'].includes(tab) ? tab : 'user-group'

  const TAB_HELP: Record<string, string> = {
    'user-group': 'The user group this flow is built around, including their goals and pain points.',
    journey: 'The user journey stages and linked requirements for this flow.',
    canvas: 'The happy path flow canvas for this user group.',
  }

  const isCanvas = activeTab === 'canvas'

  return (
    <>
      <AppHeader
        crumbs={[
          { label: p.name, href: `/projects/${id}?tab=flows` },
          { label: pers.name },
        ]}
      />

      <main className={isCanvas ? 'px-8 pt-8 pb-0' : 'px-8 py-12'}>
        {/* Tab bar */}
        <div className="flex items-end justify-between border-b border-[#E5E5EA] mb-8">
          <div className="flex items-end">
            {[
              { key: 'user-group', label: 'User Group' },
              { key: 'journey',    label: 'Journey' },
              { key: 'canvas',     label: 'Canvas' },
            ].map(({ key, label }) => (
              <Link
                key={key}
                href={`/projects/${id}/flows/${personaId}?tab=${key}`}
                className={`flex h-11 items-center gap-1.5 px-5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === key
                    ? 'border-[#1D1D1F] text-[#1D1D1F]'
                    : 'border-transparent text-[#1D1D1F] hover:border-[#C7C7CC]'
                }`}
              >
                {label}
                <HelpTooltip text={TAB_HELP[key]} position="bottom" />
              </Link>
            ))}
          </div>

          <div className="pb-2">
            {activeTab === 'journey' && (
              <GenerateJourneyButton
                projectId={id}
                hasStages={!!(p.journey_stages && p.journey_stages.length > 0)}
              />
            )}
          </div>
        </div>

        {/* ── USER GROUP TAB ── */}
        {activeTab === 'user-group' && (
          <div>
            {/* Page header */}
            <div className="mb-8">
              <div className="mb-1 flex items-center gap-2">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
                  style={{ backgroundColor: '#1D1D1F' }}
                >
                  {pers.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">{pers.name}</h1>
                  {pers.role_title && (
                    <p className="text-sm text-[#86868B]">{pers.role_title}</p>
                  )}
                </div>
              </div>
              <div className="mt-4">
                <ProvenanceLegend />
              </div>
            </div>

            <PersonaDetailClient
              persona={pers}
              projectId={id}
              linkedRequirements={linkedRequirements}
              allRequirements={reqs}
              requirementIdsWithAnyPersona={requirementIdsWithAnyPersona}
            />
          </div>
        )}

        {/* ── JOURNEY TAB ── */}
        {activeTab === 'journey' && (
          reqs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 text-center shadow-sm">
              <p className="text-lg font-medium text-[#1D1D1F]">No requirements yet</p>
              <p className="mt-2 text-sm text-[#86868B] max-w-sm">
                Synthesize flows from your inputs first, then generate the journey.
              </p>
            </div>
          ) : (
            <JourneyMatrix
              projectId={id}
              stages={p.journey_stages}
              requirements={reqs}
              personas={[pers]}
              personaReqLinks={personaReqLinks}
            />
          )
        )}

        {/* ── CANVAS TAB ── */}
        {activeTab === 'canvas' && (
          <div
            className="rounded-2xl overflow-hidden border border-[#E5E5EA]"
            style={{ height: 'calc(100vh - 185px)' }}
          >
            <FlowCanvasWrapper
              projectId={id}
              initialPersonaId={personaId}
              initialNodes={nodes}
              initialEdges={edges}
              requirements={reqs}
              personas={[{ id: pers.id, name: pers.name, updated_at: pers.updated_at }]}
            />
          </div>
        )}
      </main>
    </>
  )
}
