import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  deleteResearchInput,
  deleteAllInputs,
} from '@/app/actions'
import type { Project, ResearchInput, Requirement, Persona } from '@/types'
import { Button } from '@/components/ui/button'
import { AppHeader } from '@/app/components/AppHeader'
import { DeleteAllButton } from '@/app/components/DeleteAllButton'
import { EditableInputCard } from '@/app/components/EditableInputCard'
import { SynthesizePersonasButton } from '@/app/components/SynthesizePersonasButton'
import { HelpTooltip } from '@/app/components/HelpTooltip'
import { AddInputButton } from '@/app/components/AddInputButton'
import { FlowsTabClient } from '@/app/components/FlowsTabClient'

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

  const activeTab = ['inputs', 'flows'].includes(tab ?? '') ? tab : 'inputs'

  const TAB_HELP: Record<string, string> = {
    inputs: 'Add and/or upload any data or insights that helps inform the product.',
    flows: 'Each Flow bundles a User Group, their User Journey, and a Happy Path canvas. Synthesize to generate flows from your research inputs.',
  }

  // Group inputs by type for the column layout (only types that actually have inputs)
  const INPUT_TYPE_ORDER = ['interview_notes', 'transcript', 'screenshot', 'business_requirements', 'other'] as const
  const INPUT_TYPE_LABELS: Record<string, string> = {
    interview_notes:      'Interview Notes',
    transcript:           'Transcripts',
    screenshot:           'Screenshots',
    business_requirements:'Business Requirements',
    other:                'Other',
  }
  const inputsByType = new Map<string, ResearchInput[]>()
  for (const input of ins) {
    const group = inputsByType.get(input.type) ?? []
    group.push(input)
    inputsByType.set(input.type, group)
  }
  const activeInputTypes = INPUT_TYPE_ORDER.filter((t) => inputsByType.has(t))

  return (
    <>
      <AppHeader crumbs={[{ label: p.name }]} />

      <main className="px-8 py-12">
        {/* Tab switcher */}
        <div className="flex items-end justify-between border-b border-[#E5E5EA] mb-8">
          <div className="flex items-end">
            {[
              { key: 'inputs', label: 'Inputs',  count: ins.length },
              { key: 'flows',  label: 'Flows',   count: personaList.length },
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
            {activeTab === 'flows' && (
              <SynthesizePersonasButton projectId={id} />
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
              {/* Column layout — one column per type that has at least one input */}
              <div className="flex gap-5 items-start overflow-x-auto pb-2">
                {activeInputTypes.map((type) => (
                  <div key={type} className="flex-1 min-w-[260px] space-y-3">
                    {/* Column header */}
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                        {INPUT_TYPE_LABELS[type]}
                      </p>
                      <span className="text-[11px] text-[#86868B] opacity-60">
                        {inputsByType.get(type)!.length}
                      </span>
                    </div>
                    {/* Cards */}
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
                              onDelete={deleteResearchInput.bind(null, input.id, id)}
                            />
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
              <DeleteAllButton
                action={deleteAllInputs.bind(null, id)}
                label="Delete all inputs"
                confirmMessage="Delete ALL inputs for this project? This cannot be undone."
              />
            </div>
          )
        )}

        {/* ── FLOWS TAB ── */}
        {activeTab === 'flows' && (
          personaList.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 text-center shadow-sm">
              <p className="text-lg font-medium text-[#1D1D1F]">No flows yet</p>
              <p className="mt-2 text-sm text-[#86868B] max-w-sm">
                Add research inputs, then click{' '}
                <span className="font-medium">✦ Synthesize Flows</span> above to generate flows from your inputs.
              </p>
              <Button
                asChild
                className="mt-6 bg-[#F0E100] text-[#1D1D1F] hover:bg-[#d4c900] rounded-full px-5 font-semibold"
              >
                <Link href={`/projects/${id}?tab=inputs`}>Go to Inputs →</Link>
              </Button>
            </div>
          ) : (
            <FlowsTabClient personas={personaList} projectId={id} />
          )
        )}
      </main>
    </>
  )
}
