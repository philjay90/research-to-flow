import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { addResearchInput, deleteRequirement, deleteResearchInput, updateFlow, deleteAllInputs, deleteAllRequirements } from '@/app/actions'
import type { Project, Flow, ResearchInput, Requirement } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AppHeader } from '@/app/components/AppHeader'
import { EditableHeader } from '@/app/components/EditableHeader'
import { DeleteAllButton } from '@/app/components/DeleteAllButton'
import { EditableInputCard } from '@/app/components/EditableInputCard'
import { EditableRequirementCard } from '@/app/components/EditableRequirementCard'

const INPUT_TYPE_LABELS: Record<string, string> = {
  interview_notes: 'Interview Notes',
  transcript: 'Transcript',
  screenshot: 'Screenshot',
  business_requirements: 'Business Requirements',
  other: 'Other',
}

export default async function FlowDetailPage({
  params,
}: {
  params: Promise<{ id: string; flowId: string }>
}) {
  const { id, flowId } = await params

  const [
    { data: project, error: projectError },
    { data: flow, error: flowError },
  ] = await Promise.all([
    supabase.from('project').select('*').eq('id', id).single(),
    supabase.from('flow').select('*').eq('id', flowId).single(),
  ])

  if (projectError || !project || flowError || !flow) notFound()

  const [{ data: inputs }, { data: requirements }] = await Promise.all([
    supabase
      .from('research_input')
      .select('*')
      .eq('flow_id', flowId)
      .order('created_at', { ascending: true }),
    supabase
      .from('requirement')
      .select('*')
      .eq('flow_id', flowId)
      .order('created_at', { ascending: true }),
  ])

  const p = project as Project
  const f = flow as Flow
  const reqs = (requirements ?? []) as Requirement[]
  const ins  = (inputs ?? []) as ResearchInput[]

  // Build a map of inputId → display label for source attribution on requirement cards
  const inputLabelMap = new Map<string, string>(
    ins.map((input) => [
      input.id,
      input.source_label || INPUT_TYPE_LABELS[input.type] || input.type,
    ])
  )

  // For each input: find the most recent requirement created_at from that input
  const lastSynthAt = new Map<string, string>()
  for (const req of reqs) {
    for (const srcId of req.source_input_ids) {
      const existing = lastSynthAt.get(srcId)
      if (!existing || req.created_at > existing) lastSynthAt.set(srcId, req.created_at)
    }
  }

  return (
    <>
      <AppHeader
        crumbs={[
          { label: p.name, href: `/projects/${id}` },
          { label: f.name },
        ]}
        right={
          <Button asChild size="sm" className="bg-[#F0E100] text-[#1D1D1F] hover:bg-[#d4c900] rounded-full px-5 font-semibold">
            <Link href={`/projects/${id}/flows/${flowId}/canvas`}>View Canvas →</Link>
          </Button>
        }
      />

      <main className="mx-auto max-w-6xl px-8 py-12">
        {/* Editable flow title + description */}
        <EditableHeader
          name={f.name}
          description={f.description}
          onSave={updateFlow.bind(null, f.id, id)}
        />

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">

          {/* ── Left: Research Inputs ── */}
          <section>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Inputs</h2>
              {ins.length > 0 && (
                <span className="rounded-full bg-[#F5F5F7] px-3 py-1 text-xs font-medium text-foreground">
                  {ins.length} {ins.length === 1 ? 'input' : 'inputs'}
                </span>
              )}
            </div>

            {ins.length === 0 ? (
              <p className="text-sm text-foreground">No inputs yet. Add one below.</p>
            ) : (
              <ul className="space-y-3">
                {ins.map((input) => {
                  const synthAt = lastSynthAt.get(input.id)
                  const isSynthesized = !!synthAt
                  const isModified = isSynthesized && input.updated_at > synthAt!
                  return (
                    <li key={input.id}>
                      <EditableInputCard
                        inputId={input.id}
                        flowId={flowId}
                        projectId={id}
                        type={input.type}
                        sourceLabel={input.source_label}
                        content={input.content}
                        attachmentUrl={input.attachment_url}
                        isSynthesized={isSynthesized}
                        isModified={isModified}
                        onDelete={deleteResearchInput.bind(null, input.id, flowId, id)}
                      />
                    </li>
                  )
                })}
              </ul>
            )}

            {/* Delete all inputs */}
            {ins.length > 0 && (
              <DeleteAllButton
                action={deleteAllInputs.bind(null, flowId, id)}
                label="Delete all inputs"
                confirmMessage="Delete ALL inputs in this flow? This cannot be undone."
              />
            )}

            {/* Add research input form */}
            <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-foreground">Add Research Input</p>
              <p className="mb-5 text-sm text-foreground leading-relaxed">
                Paste notes, a transcript, or describe a screenshot.
              </p>
              <form action={addResearchInput} className="space-y-4">
                <input type="hidden" name="project_id" value={id} />
                <input type="hidden" name="flow_id" value={flowId} />

                <div className="space-y-1.5">
                  <Label htmlFor="type" className="text-sm font-semibold text-foreground">
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
                  <Label htmlFor="source_label" className="text-sm font-semibold text-foreground">
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
                  <Label htmlFor="content" className="text-sm font-semibold text-foreground">
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
                  <Label htmlFor="attachment" className="text-sm font-semibold text-foreground">
                    Attachment{' '}
                    <span className="font-normal text-foreground/50">(optional)</span>
                  </Label>
                  <input
                    id="attachment"
                    name="attachment"
                    type="file"
                    accept="image/*,.pdf"
                    className="block w-full text-sm text-foreground file:mr-3 file:rounded-full file:border-0 file:bg-[#1D1D1F] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-[#1D1D1F]/80"
                  />
                </div>

                <Button type="submit" className="bg-[#F0E100] text-[#1D1D1F] hover:bg-[#d4c900] rounded-full px-6 font-semibold">
                  Add Input
                </Button>
              </form>
            </div>
          </section>

          {/* ── Right: Requirements ── */}
          <section>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Requirements</h2>
              {reqs.length > 0 && (
                <span className="rounded-full bg-[#F5F5F7] px-3 py-1 text-xs font-medium text-foreground">
                  {reqs.length} {reqs.length === 1 ? 'requirement' : 'requirements'}
                </span>
              )}
            </div>

            {reqs.length === 0 ? (
              <p className="text-sm text-foreground">
                No requirements yet. Click &ldquo;Synthesise&rdquo; on a research input to generate them.
              </p>
            ) : (
              <>
              {reqs.some((r) => r.status === 'edited') && (
                <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[#C97D60] bg-[#FAF0EB] px-4 py-3">
                  <span className="mt-0.5 text-[#C97D60] text-sm">⚠</span>
                  <p className="text-sm text-[#C97D60]">
                    One or more requirements have been manually edited. Consider{' '}
                    <Link href={`/projects/${id}/flows/${flowId}/canvas`} className="font-semibold underline underline-offset-2">
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
                        flowId={flowId}
                        projectId={id}
                        userStory={req.user_story}
                        businessOpportunity={req.business_opportunity}
                        acceptanceCriteria={req.acceptance_criteria}
                        dfvTag={req.dfv_tag}
                        status={req.status}
                        sourceLabels={sourceLabels}
                        onDelete={deleteRequirement.bind(null, req.id, flowId, id)}
                      />
                    </li>
                  )
                })}
              </ul>
              <DeleteAllButton
                action={deleteAllRequirements.bind(null, flowId, id)}
                label="Delete all requirements"
                confirmMessage="Delete ALL requirements in this flow? This cannot be undone."
              />
              </>
            )}
          </section>
        </div>
      </main>
    </>
  )
}
