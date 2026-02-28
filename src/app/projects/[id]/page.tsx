import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { addResearchInput, deleteRequirement, deleteResearchInput } from '@/app/actions'
import type { Project, ResearchInput, Requirement } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
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
    active:      { backgroundColor: '#EE4266', color: '#fff' },
    draft:       { backgroundColor: '#7286A0', color: '#fff' },
    stale:       { backgroundColor: '#CBA328', color: '#19323C' },
    unanchored:  { backgroundColor: '#fde8e8', color: '#c0392b' },
  }
  return map[status] ?? { backgroundColor: '#e8edf2', color: '#19323C' }
}

export default async function ProjectPage({
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

  const [{ data: inputs }, { data: requirements }] = await Promise.all([
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
  ])

  const p = project as Project
  const reqs = (requirements ?? []) as Requirement[]
  const ins  = (inputs  ?? []) as ResearchInput[]

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
        crumbs={[{ label: p.name }]}
        right={
          <Button asChild size="sm" className="bg-[#EE4266] text-white hover:bg-[#d63558]">
            <Link href={`/projects/${id}/flow`}>View Flow →</Link>
          </Button>
        }
      />

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Project description */}
        {p.description && (
          <p className="mb-6 text-[#7286A0]">{p.description}</p>
        )}

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">

          {/* ── Left: Research Inputs ── */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-foreground">Research Inputs</h2>

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
                    <Card>
                      <CardContent className="p-4">
                        {/* Card title row */}
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wider text-[#7286A0]">
                              Title
                            </p>
                            <p className="mt-0.5 text-sm font-medium text-foreground">
                              {input.source_label || INPUT_TYPE_LABELS[input.type] || input.type}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <SynthesiseButton
                              inputId={input.id}
                              projectId={id}
                              isSynthesized={isSynthesized}
                              isModified={isModified}
                            />
                            <DeleteButton
                              action={deleteResearchInput.bind(null, input.id, id)}
                              confirmMessage={`Delete this research input? Associated requirements will not be deleted automatically.`}
                            />
                          </div>
                        </div>

                        {/* Type badge */}
                        <Badge
                          style={{ backgroundColor: '#19323C', color: '#fff' }}
                          className="mb-2 text-xs"
                        >
                          {INPUT_TYPE_LABELS[input.type] ?? input.type}
                        </Badge>

                        <p className="whitespace-pre-wrap text-sm text-foreground">{input.content}</p>
                        {input.attachment_url && (
                          <img
                            src={input.attachment_url}
                            alt="Attached screenshot"
                            className="mt-3 max-h-48 rounded-md border object-contain"
                          />
                        )}
                      </CardContent>
                    </Card>
                  </li>
                  )
                })}
              </ul>
            )}

            <Separator className="my-6" />

            {/* Add research input form */}
            <h3 className="mb-4 text-base font-semibold text-foreground">Add Research Input</h3>
            <Card>
              <CardHeader className="pb-2">
                <p className="text-sm text-[#7286A0]">
                  Paste notes, a transcript, or describe a screenshot.
                </p>
              </CardHeader>
              <CardContent>
                <form action={addResearchInput} className="space-y-4">
                  <input type="hidden" name="project_id" value={id} />

                  <div className="space-y-1.5">
                    <Label htmlFor="type">
                      Type <span className="text-[#EE4266]">*</span>
                    </Label>
                    <select
                      id="type"
                      name="type"
                      required
                      className="block w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-[#EE4266] focus:outline-none focus:ring-1 focus:ring-[#EE4266]"
                    >
                      <option value="">Select a type...</option>
                      {Object.entries(INPUT_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="source_label">Title / Source Label</Label>
                    <Input
                      id="source_label"
                      name="source_label"
                      type="text"
                      placeholder="e.g. Interview with Sarah"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="content">
                      Content <span className="text-[#EE4266]">*</span>
                    </Label>
                    <Textarea
                      id="content"
                      name="content"
                      rows={4}
                      required
                      placeholder="Paste notes, transcript excerpt, or describe the screenshot..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="attachment">
                      Attachment{' '}
                      <span className="text-xs font-normal text-[#7286A0]">(optional)</span>
                    </Label>
                    <input
                      id="attachment"
                      name="attachment"
                      type="file"
                      accept="image/*,.pdf"
                      className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-[#19323C] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-[#19323C]/90"
                    />
                  </div>

                  <Button type="submit" className="bg-[#EE4266] text-white hover:bg-[#d63558]">
                    Add Input
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>

          {/* ── Right: Requirements ── */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-foreground">Requirements</h2>

            {!requirements || requirements.length === 0 ? (
              <p className="text-sm text-[#7286A0]">
                No requirements yet. Click &ldquo;Synthesise&rdquo; on a research input to generate them.
              </p>
            ) : (
              <ul className="space-y-4">
                {reqs.map((req) => (
                  <li key={req.id}>
                    <Card>
                      <CardContent className="p-5">
                        {/* Card title row */}
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold uppercase tracking-wider text-[#7286A0]">
                              User Story
                            </p>
                            <p className="mt-0.5 text-sm italic text-foreground leading-snug">
                              {req.user_story}
                            </p>
                          </div>
                          <DeleteButton
                            action={deleteRequirement.bind(null, req.id, id)}
                            confirmMessage={`Delete this requirement? If you have a generated flow, it may no longer reflect all requirements — consider regenerating the flow after deleting.`}
                          />
                        </div>

                        {/* Badges */}
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <Badge style={statusStyle(req.status)} className="text-xs font-medium">
                            {req.status}
                          </Badge>
                          {req.dfv_tag && (
                            <Badge
                              style={{ backgroundColor: '#CBA328', color: '#19323C' }}
                              className="text-xs font-medium"
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
                              <span className="mt-0.5 text-[#7286A0]">—</span>
                              <span>{criterion}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </>
  )
}
