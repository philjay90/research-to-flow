import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/types'
import { Button } from '@/components/ui/button'
import { AppHeader } from '@/app/components/AppHeader'
import { DeleteButton } from '@/app/components/DeleteButton'
import { deleteProject } from '@/app/actions'

export default async function HomePage() {
  const { data: projects, error } = await supabase
    .from('project')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return <p className="p-6 text-red-500">Failed to load projects.</p>
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-8 py-16">
        <div className="mb-10 flex items-end justify-between">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Projects</h1>
          <Button asChild className="bg-[#F0E100] text-[#1D1D1F] hover:bg-[#d4c900] rounded-full px-5 font-semibold">
            <Link href="/projects/new">+ New Project</Link>
          </Button>
        </div>

        {!projects || projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 text-center shadow-sm">
            <p className="text-lg font-medium text-foreground">No projects yet</p>
            <p className="mt-2 text-sm text-foreground">Create your first project to get started.</p>
            <Button asChild className="mt-6 bg-[#F0E100] text-[#1D1D1F] hover:bg-[#d4c900] rounded-full px-5 font-semibold">
              <Link href="/projects/new">Create Project</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-4">
            {(projects as Project[]).map((project) => (
              <li key={project.id}>
                <div className="group rounded-2xl bg-white shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex items-center gap-4 p-6">
                    <Link href={`/projects/${project.id}`} className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground text-base">
                        {project.name}
                      </p>
                      {project.description && (
                        <p className="mt-1 text-sm text-foreground leading-relaxed">{project.description}</p>
                      )}
                      <p className="mt-2 text-xs text-foreground/50">
                        Created {new Date(project.created_at).toLocaleDateString()}
                      </p>
                    </Link>
                    <DeleteButton
                      action={deleteProject.bind(null, project.id)}
                      confirmMessage={`Delete "${project.name}"? This will permanently remove all research inputs, requirements, and flows. This cannot be undone.`}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  )
}
