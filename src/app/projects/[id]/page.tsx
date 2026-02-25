import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { addResearchInput } from '@/app/actions'
import type { Project, ResearchInput } from '@/types'

const INPUT_TYPE_LABELS: Record<string, string> = {
  interview_notes: 'Interview Notes',
  transcript: 'Transcript',
  screenshot: 'Screenshot',
  business_requirements: 'Business Requirements',
  other: 'Other',
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

  const { data: inputs } = await supabase
    .from('research_input')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: true })

  return (
    <div>
      <div className="mb-8">
        <a href="/" className="text-sm text-indigo-600 hover:underline">
          ← All Projects
        </a>
        <h1 className="mt-2 text-2xl font-bold">{(project as Project).name}</h1>
        {project.description && (
          <p className="mt-1 text-gray-600">{project.description}</p>
        )}
      </div>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold">Research Inputs</h2>

        {!inputs || inputs.length === 0 ? (
          <p className="text-sm text-gray-500">No inputs yet. Add one below.</p>
        ) : (
          <ul className="space-y-3">
            {(inputs as ResearchInput[]).map((input) => (
              <li key={input.id} className="rounded-lg border bg-white p-4">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    {INPUT_TYPE_LABELS[input.type] ?? input.type}
                  </span>
                  {input.source_label && (
                    <span className="text-xs text-gray-500">{input.source_label}</span>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm text-gray-800">{input.content}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

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
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
