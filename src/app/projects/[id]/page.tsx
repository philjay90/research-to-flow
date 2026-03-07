import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  addResearchInput,
  deleteRequirement,
  deleteResearchInput,
  updateProject,
  deleteAllInputs,
  deleteAllRequirements,
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
import { EditableRequirementCard } from '@/app/components/EditableRequirementCard'
import { PersonaCard } from '@/app/components/PersonaCard'
import { SynthesizePersonasButton } from '@/app/components/SynthesizePersonasButton'
import { ProvenanceLegend } from '@/app/components/ProvenanceDot'
import { HelpTooltip } from '@/app/components/HelpTooltip'

const INPUT_TYPE_LABELS: Record<string, string> = {
  interview_notes: 'Interview Notes',
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

  // Build inputId → display label map for requirement source attribution
  const inputLabelMap = new Map<string, string>(
    ins.map((input) => [
      input.id,
      input.source_label || INPUT_TYPE_LABELS[input.type] || input.type,
    ])
  )

  // Build requirementId → synthesis timestamp map (for isSynthesized / isModified)
  const lastSynthAt = new Map<string, string>()
  for (const req of reqs) {
    for (const srcId of req.source_input_ids) {
      const existing = lastSynthAt.get(srcId)
      if (!existing || req.created_at > existing) lastSynthAt.set(srcId, req.created_at)
    }
  }

  // Build requirementId → persona names
  const personaNameMap = new Map<string, string>(personaList.map((pe) => [pe.id, pe.name]))
  const reqPersonaNames = new Map<string, string[]>()
  for (const link of (personaReqLinks ?? [])) {
    const name = personaNameMap.get(link.persona_id)
    if (name) {
      const existing = reqPersonaNames.get(link.requirement_id) ?? []
      reqPersonaNames.set(link.requirement_id, [...existing, name])
    }
  }

  const activeTab = ['inputs', 'requirements', 'personas'].includes(tab ?? '') ? tab : 'inputs'

  const TAB_HELP: Record<string, string> = {
    inputs: 'Add and/or upload any data or insights that helps inform the product.',
    requirements: 'Synthesized User Stories and Acceptance Criteria based on raw inputs. These are generated using Anthropic LLMs. You can manually edit/add-to/remove them. These will directly impact the user-flow generated.',
    personas: 'Synthesized personas based on the inputs provided. Anthropic LLMs will parse through your inputs and develop one or more personas based on those inputs. You can manually edit/add-to/remove them.',
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
            <Link href={`/projects/${id}/canvas`}>Canvas →</Link>
          </Button>
        }
      />

      <main className="mx-auto max-w-3xl px-8 py-12">
        {/* Editable project title + description */}
        <EditableHeader
          name={p.name}
          description={p.description}
          onSave={updateProject.bind(null, p.id)}
        />

        {/* Tab switcher */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-1 rounded-full bg-[#F5F5F7] p-1">
            {[
              { key: 'inputs', label: 'Inputs', count: ins.length },
              { key: 'requirements', label: 'User Requirements', count: reqs.length },
              { key: 'personas', label: 'Personas', count: personaList.length },
            ].map(({ key, label, count }) => (
              <Link
                key={key}
                href={`/projects/${id}?tab=${key}`}
                className={`flex h-8 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors ${
                  activeTab === key
                    ? 'bg-white text-[#1D1D1F] shadow-sm'
                    : 'text-[#86868B] hover:text-[#1D1D1F]'
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

          {activeTab === 'personas' && (
            <SynthesizePersonasButton projectId={id} />
          )}
        </div>

        {/* ── INPUTS TAB ── */}
        {activeTab === 'inputs' && (
          <div className="space-y-6">
            {ins.length === 0 ? (
              <p className="text-sm text-[#86868B]">No inputs yet. Add one below.</p>
            ) : (
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

            {/* Add input form */}
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
          </div>
        )}

        {/* ── USER REQUIREMENTS TAB ── */}
        {activeTab === 'requirements' && (
          <div className="space-y-4">
            {reqs.length === 0 ? (
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
              <>
                {reqs.some((r) => r.status === 'edited') && (
                  <div className="flex items-start gap-3 rounded-2xl border border-[#C97D60] bg-[#FAF0EB] px-4 py-3">
                    <span className="mt-0.5 text-[#C97D60] text-sm">⚠</span>
                    <p className="text-sm text-[#C97D60]">
                      One or more requirements have been manually edited. Consider{' '}
                      <Link
                        href={`/projects/${id}/canvas`}
                        className="font-semibold underline underline-offset-2"
                      >
                        regenerating the canvas
                      </Link>{' '}
                      to reflect your changes.
                    </p>
                  </div>
                )}
                <ul className="space-y-4">
                  {reqs.map((req) => {
                    const sourceLabels = req.source_input_ids
                      .map((sid) => inputLabelMap.get(sid))
                      .filter((l): l is string => !!l)
                    return (
                      <li key={req.id}>
                        <EditableRequirementCard
                          requirementId={req.id}
                          projectId={id}
                          userStory={req.user_story}
                          businessOpportunity={req.business_opportunity}
                          acceptanceCriteria={req.acceptance_criteria}
                          dfvTag={req.dfv_tag}
                          status={req.status}
                          sourceLabels={sourceLabels}
                          personaNames={reqPersonaNames.get(req.id) ?? []}
                          onDelete={deleteRequirement.bind(null, req.id, id)}
                        />
                      </li>
                    )
                  })}
                </ul>
                <DeleteAllButton
                  action={deleteAllRequirements.bind(null, id)}
                  label="Delete all requirements"
                  confirmMessage="Delete ALL requirements for this project? This cannot be undone."
                />
              </>
            )}
          </div>
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
