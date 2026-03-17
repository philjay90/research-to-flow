import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  deleteResearchInput,
  deleteAllInputs,
} from '@/app/actions'
import type { Project, ResearchInput, Requirement, Persona, FlowNode, FlowEdge } from '@/types'
import { Button } from '@/components/ui/button'
import { AppHeader } from '@/app/components/AppHeader'
import { DeleteAllButton } from '@/app/components/DeleteAllButton'
import { EditableInputCard } from '@/app/components/EditableInputCard'
import { PersonasTabClient } from '@/app/components/PersonasTabClient'
import { SynthesizePersonasButton } from '@/app/components/SynthesizePersonasButton'
import { HelpTooltip } from '@/app/components/HelpTooltip'
import { JourneyMatrix } from '@/app/components/JourneyMatrix'
import { GenerateJourneyButton } from '@/app/components/GenerateJourneyButton'
import { AddInputButton } from '@/app/components/AddInputButton'
import FlowCanvas from '@/app/components/FlowCanvas'

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; persona?: string }>
}) {
  const { id } = await params
  const { tab = 'inputs', persona: initialPersonaId } = await searchParams
  const supabase = await createClient()

  const { data: project, error: projectError } = await supabase
    .from('project')
    .select('*')
    .eq('id', id)
    .single()

  if (projectError || !project) notFound()

  const [
    { data: inputs },
    { data: requirements },
    { data: personas },
    { data: personaReqLinks },
    { data: flowNodes },
    { data: flowEdges },
  ] = await Promise.all([
    supabase
      .from('research_input')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('requirement')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('persona')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('persona_requirement')
      .select('persona_id, requirement_id, link_source'),
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

  const p = project as Project
  const ins = (inputs ?? []) as ResearchInput[]
  const reqs = (requirements ?? []) as Requirement[]
  const personaList = (personas ?? []) as Persona[]
  const nodes = (flowNodes ?? []) as FlowNode[]
  const edges = (flowEdges ?? []) as FlowEdge[]

  // Build requirementId → synthesis timestamp map (for isSynthesized / isModified in inputs tab)
  const lastSynthAt = new Map<string, string>()
  for (const req of reqs) {
    for (const srcId of req.source_input_ids) {
      const existing = lastSynthAt.get(srcId)
      if (!existing || req.created_at > existing) lastSynthAt.set(srcId, req.created_at)
    }
  }

  const activeTab = ['inputs', 'journey', 'personas', 'canvas'].includes(tab ?? '') ? tab : 'inputs'

  const TAB_HELP: Record<string, string> = {
    inputs: 'Add and/or upload any data or insights that helps inform the product.',
    journey: 'A Stage × Persona matrix mapping your user requirements across the contextual journey of how users interact with the product — from before they open the app to after they put it down. Generate a journey to have AI infer the right stages for your project.',
    personas: 'Synthesized personas based on the inputs provided. Anthropic LLMs will parse through your inputs and develop one or more personas based on those inputs. You can manually edit/add-to/remove them.',
    canvas: 'Interactive flow diagram. Select a persona to see their specific user flow, or view all requirements together. Drag to pan, scroll to zoom, drag between nodes to connect them.',
  }

  // Node count for "all requirements" flow (persona_id = null)
  const allReqNodeCount = nodes.filter((n) => n.persona_id === null).length

  return (
    <>
      <AppHeader
        crumbs={[{ label: p.name }]}
        right={
          activeTab === 'canvas' ? (
            <p className="text-xs text-white/50">
              Drag to connect nodes · Delete key removes edges
            </p>
          ) : undefined
        }
      />

      <main className={`px-8 ${activeTab === 'canvas' ? 'pt-8 pb-0' : 'py-12'}`}>
        {/* Tab switcher */}
        <div className={`flex items-end justify-between border-b border-[#E5E5EA] ${activeTab === 'canvas' ? 'mb-4' : 'mb-8'}`}>
          <div className="flex items-end">
            {[
              { key: 'inputs',   label: 'Inputs',       count: ins.length },
              { key: 'journey',  label: 'User Journeys', count: reqs.length },
              { key: 'personas', label: 'Personas',      count: personaList.length },
              { key: 'canvas',   label: 'Canvas',        count: allReqNodeCount },
            ].map(({ key, label, count }) => (
              <Link
                key={key}
                href={`/projects/${id}?tab=${key}`}
                className={`flex h-11 items-center gap-1.5 px-5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === key
                    ? 'border-[#1D1D1F] text-[#1D1D1F]'
                    : 'border-transparent text-[#1D1D1F] hover:border-[#C7C7CC]'
                }`}
              >
                {label}
                {count > 0 && (
                  <span className="text-xs opacity-60">{count}</span>
                )}
                <HelpTooltip text={TAB_HELP[key]} position="bottom" />
              </Link>
            ))}
          </div>

          <div className="pb-2">
            {activeTab === 'inputs' && (
              <AddInputButton projectId={id} />
            )}
            {activeTab === 'personas' && (
              <SynthesizePersonasButton projectId={id} />
            )}
            {activeTab === 'journey' && reqs.length > 0 && (
              <GenerateJourneyButton projectId={id} hasStages={!!p.journey_stages?.length} />
            )}
          </div>
        </div>

        {/* ── INPUTS TAB ── */}
        {activeTab === 'inputs' && (
          ins.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 text-center shadow-sm">
              <p className="text-lg font-medium text-[#1D1D1F]">No inputs yet</p>
              <p className="mt-2 text-sm text-[#86868B] max-w-sm">
                Add research inputs like interview notes, transcripts, or screenshots to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <ul className="space-y-3">
                {ins.map((input) => {
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
                        onDelete={deleteResearchInput.bind(null, input.id, id)}
                      />
                    </li>
                  )
                })}
              </ul>
              <DeleteAllButton
                action={deleteAllInputs.bind(null, id)}
                label="Delete all inputs"
                confirmMessage="Delete ALL inputs for this project? This cannot be undone."
              />
            </div>
          )
        )}

        {/* ── USER JOURNEYS TAB ── */}
        {activeTab === 'journey' && (
          reqs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 text-center shadow-sm">
              <p className="text-lg font-medium text-[#1D1D1F]">No requirements yet</p>
              <p className="mt-2 text-sm text-[#86868B] max-w-sm">
                Add research inputs, then click{' '}
                <span className="font-medium">Synthesise</span> on each input to generate user requirements.
              </p>
              <Button
                asChild
                className="mt-6 bg-[#F0E100] text-[#1D1D1F] hover:bg-[#d4c900] rounded-full px-5 font-semibold"
              >
                <Link href={`/projects/${id}?tab=inputs`}>Go to Inputs →</Link>
              </Button>
            </div>
          ) : (
            <JourneyMatrix
              projectId={id}
              stages={p.journey_stages}
              requirements={reqs}
              personas={personaList}
              personaReqLinks={(personaReqLinks ?? []) as { persona_id: string; requirement_id: string }[]}
            />
          )
        )}

        {/* ── PERSONAS TAB ── */}
        {activeTab === 'personas' && (
          <>
            {personaList.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 text-center shadow-sm">
                <p className="text-lg font-medium text-[#1D1D1F]">No personas yet</p>
                <p className="mt-2 text-sm text-[#86868B] max-w-sm">
                  Add research inputs, then click{' '}
                  <span className="font-medium">✦ Synthesize Personas</span> above to generate personas.
                </p>
              </div>
            ) : (
              <PersonasTabClient
                personas={personaList}
                projectId={id}
                allRequirements={reqs}
                personaReqLinks={(personaReqLinks ?? []) as { persona_id: string; requirement_id: string; link_source?: 'llm' | 'manual' }[]}
              />
            )}
          </>
        )}

        {/* ── CANVAS TAB ── */}
        {activeTab === 'canvas' && (
          <div
            className="rounded-2xl overflow-hidden border border-[#E5E5EA]"
            style={{ height: 'calc(100vh - 185px)' }}
          >
            <FlowCanvas
              projectId={id}
              initialPersonaId={initialPersonaId ?? ''}
              initialNodes={nodes}
              initialEdges={edges}
              requirements={reqs}
              personas={personaList.map((persona) => ({
                id: persona.id,
                name: persona.name,
                updated_at: persona.updated_at,
              }))}
            />
          </div>
        )}
      </main>
    </>
  )
}
