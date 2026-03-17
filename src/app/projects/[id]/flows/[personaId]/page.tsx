import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Project, Persona, Requirement, PersonaRequirement, ResearchInput, FlowNode, FlowEdge } from '@/types'
import { AppHeader } from '@/app/components/AppHeader'
import { ProvenanceLegend } from '@/app/components/ProvenanceDot'
import { HelpTooltip } from '@/app/components/HelpTooltip'
import { GenerateJourneyButton } from '@/app/components/GenerateJourneyButton'
import { JourneyMatrix } from '@/app/components/JourneyMatrix'
import { PersonaDetailClient } from '../../personas/[personaId]/PersonaDetailClient'
import { FlowCanvasWrapper } from '@/app/components/FlowCanvasWrapper'
import { MockupPanel } from '@/app/components/MockupPanel'
import { GenerateMockupButton } from '@/app/components/GenerateMockupButton'
import { AddInputButton } from '@/app/components/AddInputButton'
import { SynthesizeFlowButton } from '@/app/components/SynthesizeFlowButton'
import { RegeneratePersonaButton } from '@/app/components/RegeneratePersonaButton'
import { EditableInputCard } from '@/app/components/EditableInputCard'
import { DeleteAllButton } from '@/app/components/DeleteAllButton'
import { deleteResearchInput, deleteAllFlowInputs } from '@/app/actions'

const INPUT_TYPE_ORDER = ['interview_notes', 'transcript', 'screenshot', 'business_requirements', 'other'] as const
const INPUT_TYPE_LABELS: Record<string, string> = {
  interview_notes: 'Interview Notes',
  transcript: 'Transcripts',
  screenshot: 'Screenshots',
  business_requirements: 'Business Requirements',
  other: 'Other',
}

export default async function FlowDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; personaId: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id, personaId } = await params
  const { tab = 'inputs' } = await searchParams
  const supabase = await createClient()

  // Fetch project + persona + requirements in parallel
  const [
    { data: project, error: projectError },
    { data: persona, error: personaError },
    { data: allRequirements },
    { data: flowInputsRaw },
  ] = await Promise.all([
    supabase.from('project').select('*').eq('id', id).single(),
    supabase.from('persona').select('*').eq('id', personaId).single(),
    supabase
      .from('requirement')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('research_input')
      .select('*')
      .eq('project_id', id)
      .eq('flow_id', personaId)
      .order('created_at', { ascending: true }),
  ])

  if (projectError || !project || personaError || !persona) notFound()

  const p = project as Project
  const pers = persona as Persona
  const reqs = (allRequirements ?? []) as Requirement[]
  const ins = (flowInputsRaw ?? []) as ResearchInput[]
  const reqIds = reqs.map((r) => r.id)

  // Fetch the remaining data in parallel
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

  // Build requirementId → synthesis timestamp map (for isSynthesized / isModified on input cards)
  const lastSynthAt = new Map<string, string>()
  for (const req of reqs) {
    for (const srcId of req.source_input_ids) {
      const existing = lastSynthAt.get(srcId)
      if (!existing || req.created_at > existing) lastSynthAt.set(srcId, req.created_at)
    }
  }

  // Column layout for inputs tab
  const inputsByType = new Map<string, ResearchInput[]>()
  for (const input of ins) {
    const group = inputsByType.get(input.type) ?? []
    group.push(input)
    inputsByType.set(input.type, group)
  }
  const activeInputTypes = INPUT_TYPE_ORDER.filter((t) => inputsByType.has(t))

  const activeTab = ['inputs', 'persona', 'journey', 'canvas', 'mockup'].includes(tab) ? tab : 'inputs'

  const TAB_HELP: Record<string, string> = {
    inputs: 'Research inputs specific to this flow. Add inputs here, then click Synthesize to generate the persona.',
    persona: 'The persona this flow is built around, including their goals and pain points.',
    journey: 'The user journey stages and linked requirements for this flow.',
    canvas: 'The happy path flow canvas for this persona.',
    mockup: 'AI-generated UI mockup and HTML prototype for this flow.',
  }

  const isCanvas = activeTab === 'canvas'

  return (
    <>
      <AppHeader
        crumbs={[
          { label: p.name, href: `/projects/${id}` },
          { label: pers.name },
        ]}
      />

      <main className={isCanvas ? 'px-8 pt-8 pb-0' : 'px-8 py-12'}>
        {/* Tab bar */}
        <div className="flex items-end justify-between border-b border-[#E5E5EA] mb-8">
          <div className="flex items-end">
            {[
              { key: 'inputs',  label: 'Inputs',  count: ins.length },
              { key: 'persona', label: 'Persona',  count: 0 },
              { key: 'journey', label: 'Journey',  count: 0 },
              { key: 'canvas',  label: 'Canvas',   count: 0 },
              { key: 'mockup',  label: 'Mockup',   count: 0 },
            ].map(({ key, label, count }) => (
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
                {count > 0 && <span className="text-xs opacity-60">{count}</span>}
                <HelpTooltip text={TAB_HELP[key]} position="bottom" />
              </Link>
            ))}
          </div>

          <div className="pb-2">
            {activeTab === 'inputs' && (
              <div className="flex items-center gap-2">
                <SynthesizeFlowButton projectId={id} personaId={personaId} />
                <AddInputButton projectId={id} flowId={personaId} />
              </div>
            )}
            {activeTab === 'persona' && (
              <RegeneratePersonaButton projectId={id} personaId={personaId} />
            )}
            {activeTab === 'journey' && (
              <GenerateJourneyButton
                projectId={id}
                hasStages={!!(p.journey_stages && p.journey_stages.length > 0)}
              />
            )}
            {activeTab === 'mockup' && (
              <GenerateMockupButton
                projectId={id}
                personaId={personaId}
                currentStatus={pers.mockup_status}
              />
            )}
          </div>
        </div>

        {/* ── INPUTS TAB ── */}
        {activeTab === 'inputs' && (
          ins.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 text-center shadow-sm">
              <p className="text-lg font-medium text-[#1D1D1F]">No inputs yet</p>
              <p className="mt-2 text-sm text-[#86868B] max-w-sm">
                Add research inputs like interview notes, transcripts, or screenshots.
                Then click <span className="font-medium">✦ Synthesize</span> to generate the persona.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex gap-5 items-start overflow-x-auto pb-2">
                {activeInputTypes.map((type) => (
                  <div key={type} className="flex-1 min-w-[260px] space-y-3">
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                        {INPUT_TYPE_LABELS[type]}
                      </p>
                      <span className="text-[11px] text-[#86868B] opacity-60">
                        {inputsByType.get(type)!.length}
                      </span>
                    </div>
                    <ul className="space-y-3">
                      {inputsByType.get(type)!.map((input) => {
                        const synthAt = lastSynthAt.get(input.id)
                        const isSynthesized = !!synthAt
                        const isModified = isSynthesized && input.updated_at > synthAt!
                        return (
                          <li key={input.id}>
                            <EditableInputCard
                              inputId={input.id}
                              projectId={id}
                              type={input.type}
                              sourceLabel={input.source_label}
                              content={input.content}
                              attachmentUrl={input.attachment_url}
                              isSynthesized={isSynthesized}
                              isModified={isModified}
                              onDelete={deleteResearchInput.bind(null, input.id, id, personaId)}
                            />
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
              <DeleteAllButton
                action={deleteAllFlowInputs.bind(null, personaId, id)}
                label="Delete all inputs"
                confirmMessage="Delete ALL inputs for this flow? This cannot be undone."
              />
            </div>
          )
        )}

        {/* ── PERSONA TAB ── */}
        {activeTab === 'persona' && (
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
                Add inputs and synthesize the persona first to generate requirements.
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

        {/* ── MOCKUP TAB ── */}
        {activeTab === 'mockup' && (
          <MockupPanel
            projectId={id}
            personaId={personaId}
            initialStatus={pers.mockup_status}
            initialPendingDiff={pers.mockup_pending_diff}
            initialScreens={pers.mockup_screens}
            initialPrototypeHtml={pers.mockup_prototype_html}
            initialFigmaJson={pers.mockup_figma_json}
          />
        )}
      </main>
    </>
  )
}
