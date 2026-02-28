import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { addResearchInput, deleteRequirement, deleteResearchInput } from '@/app/actions'
import type { Project, Flow, ResearchInput, Requirement } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AppHeader } from '@/app/components/AppHeader'
import { DeleteButton } from '@/app/components/DeleteButton'
import { SynthesiseButton } from '@/app/components/SynthesiseButton'

const INPUT_TYPE_LABELS: Record<string, string> = {
  interview_notes: 'Interview Notes',
  transcript: 'Transcript',
  screenshot: 'Screenshot',
  business_requirements: 'Business Requirements',
  other: 'Other',
}

const DFV_LABELS: Record<string, string> = {
  desirability: 'Desirability',
  feasibility: 'Feasibility',
  viability: 'Viability',
}

function statusStyle(status: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    active:     { backgroundColor: '#EE4266', color: '#fff' },
    draft:      { backgroundColor: '#7286A0', color: '#fff' },
    stale:      { backgroundColor: '#CBA328', color: '#19323C' },
    unanchored: { backgroundColor: '#fde8e8', color: '#c0392b' },
  }
  return map[status] ?? { backgroundColor: '#e8edf2', color: '#19323C' }
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
          <Button asChild size="sm" className="bg-[#EE4266] text-white hover:bg-[#d63558] rounded-full px-5">
            <Link href={`/projects/${id}/flows/${flowId}/canvas`}>View Canvas →</Link>
          </Button>
        }
      />

      <main className="mx-auto max-w-6xl px-8 py-12">
        {f.description && (
          <p className="mb-8 text-[#7286A0] leading-relaxed">{f.description}</p>
        )}

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">

          {/* ── Left: Research Inputs ── */}
          <section>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Inputs</h2>
              {ins.length > 0 && (
                <span className="rounded-full bg-[#f3f7f0] px-3 py-1 text-xs font-medium text-[#7286A0]">
                  {ins.length} {ins.length === 1 ? 'input' : 'inputs'}
                </span>
              )}
            </div>

            {ins.length === 0 ? (
              <p className="text-sm text-[#7286A0]">No inputs yet. Add one below.</p>
            ) : (
              <ul className="space-y-3">
                {ins.map((input) => {
                  const synthAt = lastSynthAt.get(input.id)
                  const isSynthesized = !!synthAt
                  const isModified = isSynthesized && input.updated_at > synthAt!
                  return (
                    <li key={input.id}>
                      <div className="rounded-2xl bg-white p-5 shadow-sm">
                        {/* Header row */}
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground leading-snug">
                            {input.source_label || INPUT_TYPE_LABELS[input.type] || input.type}
                          </p>
                          <div className="flex shrink-0 items-center gap-1">
                            <SynthesiseButton
                              inputId={input.id}
                              flowId={flowId}
                              projectId={id}
                              isSynthesized={isSynthesized}
                              isModified={isModified}
                            />
                            <DeleteButton
                              action={deleteResearchInput.bind(null, input.id, flowId, id)}
                              confirmMessage="Delete this research input? Associated requirements will not be deleted automatically."
                            />
                          </div>
                        </div>

                        {/* Type badge */}
                        <Badge
                          style={{ backgroundColor: '#19323C', color: '#fff' }}
                          className="mb-3 text-xs rounded-full"
                        >
                          {INPUT_TYPE_LABELS[input.type] ?? input.type}
                        </Badge>

                        <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
                          {input.content}
                        </p>
                        {input.attachment_url && (
                          <img
                            src={input.attachment_url}
                            alt="Attached screenshot"
                            className="mt-3 max-h-48 rounded-xl border object-contain"
                          />
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            {/* Add research input form */}
            <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
              <p className="mb-5 text-sm font-semibold text-foreground">Add Research Input</p>
              <p className="mb-5 text-sm text-[#7286A0] leading-relaxed">
                Paste notes, a transcript, or describe a screenshot.
              </p>
              <form action={addResearchInput} className="space-y-4">
                <input type="hidden" name="project_id" value={id} />
                <input type="hidden" name="flow_id" value={flowId} />

                <div className="space-y-1.5">
                  <Label htmlFor="type" className="text-sm font-semibold text-foreground">
                    Type <span className="text-[#EE4266]">*</span>
                  </Label>
                  <select
                    id="type"
                    name="type"
                    required
                    className="block w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-[#EE4266] focus:outline-none focus:ring-1 focus:ring-[#EE4266]"
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
                    Content <span className="text-[#EE4266]">*</span>
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
                    <span className="font-normal text-[#7286A0]">(optional)</span>
                  </Label>
                  <input
                    id="attachment"
                    name="attachment"
                    type="file"
                    accept="image/*,.pdf"
                    className="block w-full text-sm text-foreground file:mr-3 file:rounded-full file:border-0 file:bg-[#19323C] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-[#19323C]/90"
                  />
                </div>

                <Button type="submit" className="bg-[#EE4266] text-white hover:bg-[#d63558] rounded-full px-6">
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
                <span className="rounded-full bg-[#f3f7f0] px-3 py-1 text-xs font-medium text-[#7286A0]">
                  {reqs.length} {reqs.length === 1 ? 'requirement' : 'requirements'}
                </span>
              )}
            </div>

            {reqs.length === 0 ? (
              <p className="text-sm text-[#7286A0]">
                No requirements yet. Click &ldquo;Synthesise&rdquo; on a research input to generate them.
              </p>
            ) : (
              <ul className="space-y-4">
                {reqs.map((req) => {
                  // Resolve source input labels for this requirement
                  const sourceLabels = req.source_input_ids
                    .map((sid) => inputLabelMap.get(sid))
                    .filter((l): l is string => !!l)

                  return (
                    <li key={req.id}>
                      <div className="rounded-2xl bg-white p-5 shadow-sm">
                        {/* Source attribution */}
                        {sourceLabels.length > 0 && (
                          <p className="mb-3 text-xs text-[#7286A0]">
                            From: {sourceLabels.join(', ')}
                          </p>
                        )}

                        {/* User story + delete */}
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <p className="text-sm italic text-foreground leading-snug flex-1">
                            {req.user_story}
                          </p>
                          <DeleteButton
                            action={deleteRequirement.bind(null, req.id, flowId, id)}
                            confirmMessage="Delete this requirement? If you have a generated canvas, it may no longer reflect all requirements — consider regenerating after deleting."
                          />
                        </div>

                        {/* Badges */}
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <Badge style={statusStyle(req.status)} className="text-xs font-medium rounded-full">
                            {req.status}
                          </Badge>
                          {req.dfv_tag && (
                            <Badge
                              style={{ backgroundColor: '#CBA328', color: '#19323C' }}
                              className="text-xs font-medium rounded-full"
                            >
                              {DFV_LABELS[req.dfv_tag] ?? req.dfv_tag}
                            </Badge>
                          )}
                        </div>

                        <p className="mb-3 text-sm font-medium text-foreground">
                          {req.business_opportunity}
                        </p>

                        <ul className="space-y-1">
                          {req.acceptance_criteria.map((criterion, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                              <span className="mt-0.5 text-[#7286A0]">✓</span>
                              <span>{criterion}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </main>
    </>
  )
}
