import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { addResearchInput, synthesiseInput } from '@/app/actions'
import type { Project, ResearchInput, Requirement } from '@/types'

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

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  stale: 'bg-orange-100 text-orange-800',
  unanchored: 'bg-red-100 text-red-800',
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
        <a href="/" className="text-sm text-indigo-600 hover:underline">
          ← All Projects
        </a>
        <h1 className="mt-2 text-2xl font-bold">{(project as Project).name}</h1>
        {project.description && (
          <p className="mt-1 text-gray-600">{project.description}</p>
        )}
      </div>

      {/* Research inputs */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold">Research Inputs</h2>

        {!inputs || inputs.length === 0 ? (
          <p className="text-sm text-gray-500">No inputs yet. Add one below.</p>
        ) : (
          <ul className="space-y-3">
            {(inputs as ResearchInput[]).map((input) => (
              <li key={input.id} className="rounded-lg border bg-white p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                      {INPUT_TYPE_LABELS[input.type] ?? input.type}
                    </span>
                    {input.source_label && (
                      <span className="text-xs text-gray-500">{input.source_label}</span>
                    )}
                  </div>
                  <form action={synthesiseInput}>
                    <input type="hidden" name="input_id" value={input.id} />
                    <input type="hidden" name="project_id" value={id} />
                    <button
                      type="submit"
                      className="rounded-md bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                    >
                      Synthesise
                    </button>
                  </form>
                </div>
                <p className="whitespace-pre-wrap text-sm text-gray-800">{input.content}</p>
                {input.attachment_url && (
                  <img
                    src={input.attachment_url}
                    alt="Attached screenshot"
                    className="mt-3 max-h-64 rounded-md border object-contain"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Requirements */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold">Requirements</h2>

        {!requirements || requirements.length === 0 ? (
          <p className="text-sm text-gray-500">
            No requirements yet. Click &ldquo;Synthesise&rdquo; on a research input to generate them.
          </p>
        ) : (
          <ul className="space-y-4">
            {(requirements as Requirement[]).map((req) => (
              <li key={req.id} className="rounded-lg border bg-white p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[req.status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {req.status}
                  </span>
                  {req.dfv_tag && (
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                      {DFV_LABELS[req.dfv_tag] ?? req.dfv_tag}
                    </span>
                  )}
                </div>

                <p className="mb-2 text-sm font-medium text-gray-900">{req.business_opportunity}</p>
                <p className="mb-3 text-sm italic text-gray-600">{req.user_story}</p>

                <ul className="space-y-1">
                  {req.acceptance_criteria.map((criterion, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="mt-0.5 text-gray-400">—</span>
                      <span>{criterion}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Add research input form */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Add Research Input</h2>

        <form action={addResearchInput} className="space-y-4 rounded-lg border bg-white p-6">
          <input type="hidden" name="project_id" value={id} />

          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700">
              Type <span className="text-red-500">*</span>
            </label>
            <select
              id="type"
              name="type"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select a type...</option>
              {Object.entries(INPUT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="source_label" className="block text-sm font-medium text-gray-700">
              Source Label
            </label>
            <input
              id="source_label"
              name="source_label"
              type="text"
              placeholder="e.g. Interview with Sarah, Session recording #3"
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700">
              Content <span className="text-red-500">*</span>
            </label>
            <textarea
              id="content"
              name="content"
              rows={5}
              required
              placeholder="Paste notes, transcript excerpt, or describe the screenshot..."
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="attachment" className="block text-sm font-medium text-gray-700">
              Attachment <span className="text-xs font-normal text-gray-400">(optional — image or PDF)</span>
            </label>
            <input
              id="attachment"
              name="attachment"
              type="file"
              accept="image/*,.pdf"
              className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>

          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Add Input
          </button>
        </form>
      </section>
    </div>
  )
}
