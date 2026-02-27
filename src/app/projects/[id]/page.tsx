import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { addResearchInput, synthesiseInput } from '@/app/actions'
import type { Project, ResearchInput, Requirement } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

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

// Returns inline style for status badges using our palette
function statusStyle(status: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    active: { backgroundColor: '#EE4266', color: '#fff' },
    draft: { backgroundColor: '#7286A0', color: '#fff' },
    stale: { backgroundColor: '#CBA328', color: '#19323C' },
    unanchored: { backgroundColor: '#fde8e8', color: '#c0392b' },
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

  if (projectError || !project) {
    notFound()
  }

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

  return (
    <div>
      {/* Project header */}
      <div className="mb-8">
        <Link href="/" className="text-sm text-[#EE4266] hover:underline">
          ← All Projects
        </Link>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{(project as Project).name}</h1>
            {project.description && (
              <p className="mt-1 text-[#7286A0]">{project.description}</p>
            )}
          </div>
          <Button asChild className="shrink-0 bg-[#19323C] text-white hover:bg-[#19323C]/90">
            <Link href={`/projects/${id}/flow`}>View Flow →</Link>
          </Button>
        </div>
      </div>

      {/* Research inputs */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Research Inputs</h2>

        {!inputs || inputs.length === 0 ? (
          <p className="text-sm text-[#7286A0]">No inputs yet. Add one below.</p>
        ) : (
          <ul className="space-y-3">
            {(inputs as ResearchInput[]).map((input) => (
              <li key={input.id}>
                <Card>
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          style={{ backgroundColor: '#19323C', color: '#fff' }}
                          className="text-xs font-medium"
                        >
                          {INPUT_TYPE_LABELS[input.type] ?? input.type}
                        </Badge>
                        {input.source_label && (
                          <span className="text-xs text-[#7286A0]">{input.source_label}</span>
                        )}
                      </div>
                      <form action={synthesiseInput}>
                        <input type="hidden" name="input_id" value={input.id} />
                        <input type="hidden" name="project_id" value={id} />
                        <Button
                          type="submit"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs border-[#EE4266] text-[#EE4266] hover:bg-[#EE4266]/10"
                        >
                          Synthesise
                        </Button>
                      </form>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-foreground">{input.content}</p>
                    {input.attachment_url && (
                      <img
                        src={input.attachment_url}
                        alt="Attached screenshot"
                        className="mt-3 max-h-64 rounded-md border object-contain"
                      />
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Requirements */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Requirements</h2>

        {!requirements || requirements.length === 0 ? (
          <p className="text-sm text-[#7286A0]">
            No requirements yet. Click &ldquo;Synthesise&rdquo; on a research input to generate them.
          </p>
        ) : (
          <ul className="space-y-4">
            {(requirements as Requirement[]).map((req) => (
              <li key={req.id}>
                <Card>
                  <CardContent className="p-5">
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

                    <p className="mb-2 text-sm font-semibold text-foreground">{req.business_opportunity}</p>
                    <p className="mb-3 text-sm italic text-[#7286A0]">{req.user_story}</p>

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

      <Separator className="my-8" />

      {/* Add research input form */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Add Research Input</h2>

        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm text-[#7286A0]">Paste notes, a transcript, or describe a screenshot to add it to this project.</p>
          </CardHeader>
          <CardContent>
            <form action={addResearchInput} className="space-y-5">
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
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="source_label">Source Label</Label>
                <Input
                  id="source_label"
                  name="source_label"
                  type="text"
                  placeholder="e.g. Interview with Sarah, Session recording #3"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="content">
                  Content <span className="text-[#EE4266]">*</span>
                </Label>
                <Textarea
                  id="content"
                  name="content"
                  rows={5}
                  required
                  placeholder="Paste notes, transcript excerpt, or describe the screenshot..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="attachment">
                  Attachment{' '}
                  <span className="text-xs font-normal text-[#7286A0]">(optional — image or PDF)</span>
                </Label>
                <input
                  id="attachment"
                  name="attachment"
                  type="file"
                  accept="image/*,.pdf"
                  className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-[#19323C] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-[#19323C]/90"
                />
              </div>

              <Button
                type="submit"
                className="bg-[#EE4266] text-white hover:bg-[#d63558]"
              >
                Add Input
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
