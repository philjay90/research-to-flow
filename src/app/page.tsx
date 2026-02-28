import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Projects</h1>
            <p className="mt-1 text-sm text-[#7286A0]">Your UX research workspaces</p>
          </div>
          <Button asChild className="bg-[#EE4266] text-white hover:bg-[#d63558]">
            <Link href="/projects/new">New Project</Link>
          </Button>
        </div>

        {!projects || projects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-[#7286A0]">No projects yet.</p>
              <p className="mt-1 text-sm text-[#7286A0]">Create one to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {(projects as Project[]).map((project) => (
              <li key={project.id}>
                <Card className="transition-shadow hover:shadow-md hover:border-[#EE4266]/40">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/projects/${project.id}`} className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#7286A0]">
                          Project
                        </p>
                        <p className="mt-0.5 font-semibold text-foreground">{project.name}</p>
                        {project.description && (
                          <p className="mt-1 text-sm text-[#7286A0]">{project.description}</p>
                        )}
                        <p className="mt-2 text-xs text-[#7286A0]/70">
                          Created {new Date(project.created_at).toLocaleDateString()}
                        </p>
                      </Link>
                      <DeleteButton
                        action={deleteProject.bind(null, project.id)}
                        confirmMessage={`Delete "${project.name}"? This will permanently remove all research inputs, requirements, and the flow. This cannot be undone.`}
                      />
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  )
}
