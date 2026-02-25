import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/types'

export default async function HomePage() {
  const { data: projects, error } = await supabase
    .from('project')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return <p className="text-red-500">Failed to load projects.</p>
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Link
          href="/projects/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          New Project
        </Link>
      </div>

      {!projects || projects.length === 0 ? (
        <p className="text-gray-500">No projects yet. Create one to get started.</p>
      ) : (
        <ul className="space-y-3">
          {(projects as Project[]).map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="block rounded-lg border bg-white p-4 hover:border-indigo-300 hover:shadow-sm"
              >
                <p className="font-semibold">{project.name}</p>
                {project.description && (
                  <p className="mt-1 text-sm text-gray-500">{project.description}</p>
                )}
                <p className="mt-2 text-xs text-gray-400">
                  Created {new Date(project.created_at).toLocaleDateString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
