import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  addResearchInput,
  deleteResearchInput,
  updateProject,
  deleteAllInputs,
} from '@/app/actions'
import type { Project, ResearchInput, Requirement, Persona } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AppHeader } from '@/app/components/AppHeader'
import { EditableHeader } from '@/app/components/EditableHeader'
import { DeleteAllButton } from '@/app/components/DeleteAllButton'
import { EditableInputCard } from '@/app/components/EditableInputCard'
import { PersonaCard } from '@/app/components/PersonaCard'
import { SynthesizePersonasButton } from '@/app/components/SynthesizePersonasButton'
import { ProvenanceLegend } from '@/app/components/ProvenanceDot'
import { HelpTooltip } from '@/app/components/HelpTooltip'
import { JourneyMatrix } from '@/app/components/JourneyMatrix'
import { GenerateJourneyButton } from '@/app/components/GenerateJourneyButton'

const INPUT_TYPE_LABELS: Record<string, string> = {
  interview_notes: 'Notes',
  transcript: 'Transcript',
  screenshot: 'Screenshot',
  business_requirements: 'Business Requirements',
  other: 'Other',
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab = 'inputs' } = await searchParams
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
      .select('persona_id, requirement_id'),
  ])

  const p = project as Project
  const ins = (inputs ?? []) as ResearchInput[]
  const reqs = (requirements ?? []) as Requirement[]
  const personaList = (personas ?? []) as Persona[]

  // Build requirementId → synthesis timestamp map (for isSynthesized / isModified in inputs tab)
  const lastSynthAt = new Map<string, string>()
  for (const req of reqs) {
    for (const srcId of req.source_input_ids) {
      const existing = lastSynthAt.get(srcId)
      if (!existing || req.created_at > existing) lastSynthAt.set(srcId, req.created_at)
    }
  }

  const activeTab = ['inputs', 'journey', 'personas'].includes(tab ?? '') ? tab : 'inputs'

  const TAB_HELP: Record<string, string> = {
    inputs: 'Add and/or upload any data or insights that helps inform the product.',
    journey: 'A Stage × Persona matrix mapping your user requirements across the contextual journey of how users interact with the product — from before they open the app to after they put it down. Generate a journey to have AI infer the right stages for your project.',
    personas: 'Synthesized personas based on the inputs provided. Anthropic LLMs will parse through your inputs and develop one or more personas based on those inputs. You can manually edit/add-to/remove them. In the Flow-View, you will be able to generate user-flow based on Persona-specific user requirements and see different flows based on the selected persona.',
  }

  return (
    <>
      <AppHeader
        crumbs={[{ label: p.name }]}
        right={
          <Button
            asChild
            size="sm"
            className="bg-[#F0E100] text-[#1D1D1F] hover:bg-[#d4c900] rounded-full px-5 font-semibold"
          >
            <Link href={`/projects/${id}/canvas`}>Flow Canvas</Link>
          </Button>
        }
      />

      <main className="px-8 py-12">
        {/* Editable project title + description */}
        <EditableHeader
          name={p.name}
          description={p.description}
          onSave={updateProject.bind(null, p.id)}
        />

        {/* Tab switcher */}
        <div className="mb-8 flex items-end justify-between border-b border-[#E5E5EA]">
          <div className="flex items-end">
            {[
              { key: 'inputs', label: 'Inputs', count: ins.length },
              { key: 'journey', label: 'User Journeys', count: reqs.length },
              { key: 'personas', label: 'Personas', count: personaList.length },
            ].map(({ key, label, count }) => (
              <Link
                key={key}
                href={`/projects/${id}?tab=${key}`}
                className={`flex h-11 items-center gap-1.5 px-5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === key
                    ? 'border-[#1D1D1F] text-[#1D1D1F]'
                    : 'border-transparent text-[#86868B] hover:text-[#1D1D1F] hover:border-[#C7C7CC]'
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
          <div className="space-y-6">
            {/* Add input form — always at the top */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-[#1D1D1F]">Add Research Input</p>
              <p className="mb-5 text-sm text-[#86868B] leading-relaxed">
                Paste notes, a transcript, or describe a screenshot.
              </p>
              <form action={addResearchInput} className="space-y-4">
                <input type="hidden" name="project_id" value={id} />

                <div className="space-y-1.5">
                  <Label htmlFor="type" className="text-sm font-semibold text-[#1D1D1F]">
                    Type <span className="text-[#C97D60]">*</span>
                  </Label>
                  <select
                    id="type"
                    name="type"
                    required
                    className="block w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#1D1D1F]"
                  >
                    <option value="">Select a type...</option>
                    {Object.entries(INPUT_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="source_label" className="text-sm font-semibold text-[#1D1D1F]">
                    Title / Source Label
                  </Label>
                  <Input
                    id="source_label"
                    name="source_label"
                    type="text"
                    placeholder="e.g. Interview with Sarah"
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="content" className="text-sm font-semibold text-[#1D1D1F]">
                    Content <span className="text-[#C97D60]">*</span>
                  </Label>
                  <Textarea
                    id="content"
                    name="content"
                    rows={4}
                    required
                    placeholder="Paste notes, transcript excerpt, or describe the screenshot..."
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="attachment" className="text-sm font-semibold text-[#1D1D1F]">
                    Attachment{' '}
                    <span className="font-normal text-[#86868B]">(optional)</span>
                  </Label>
                  <input
                    id="attachment"
                    name="attachment"
                    type="file"
                    accept="image/*,.pdf"
                    className="block w-full text-sm text-foreground file:mr-3 file:rounded-full file:border-0 file:bg-[#1D1D1F] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-[#1D1D1F]/80"
                  />
                </div>

                <Button
                  type="submit"
                  className="bg-[#F0E100] text-[#1D1D1F] hover:bg-[#d4c900] rounded-full px-6 font-semibold"
                >
                  Add Input
                </Button>
              </form>
            </div>

            {/* Existing inputs */}
            {ins.length > 0 && (
              <>
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
              </>
            )}
          </div>
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
              <>
                <div className="mb-4">
                  <ProvenanceLegend />
                </div>
                <ul className="space-y-4">
                  {personaList.map((persona) => (
                    <li key={persona.id}>
                      <PersonaCard persona={persona} projectId={id} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </main>
    </>
  )
}
