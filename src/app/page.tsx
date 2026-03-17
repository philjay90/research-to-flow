import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Project } from '@/types'
import { Button } from '@/components/ui/button'
import { AppHeader } from '@/app/components/AppHeader'
import { HelpTooltip } from '@/app/components/HelpTooltip'
import { ProjectCard } from '@/app/components/ProjectCard'

export default async function HomePage() {
  const supabase = await createClient()
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
      <main className="px-8 py-16">
        <div className="mb-10 flex items-end justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Projects</h1>
            <HelpTooltip
              text="A project can be part or a complete product. Within a project you will be able to create multiple decision flows based on raw inputs that generate user stories and/or personas. Click the (+) button to add a project."
              position="bottom"
              className="mb-0.5"
            />
          </div>
          <Link href="/projects/new" className="bg-[#F0E100] hover:bg-[#d4c900] rounded-full h-10 w-10 text-xl font-bold text-[#1D1D1F] flex items-center justify-center transition-colors leading-none">+</Link>
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
                <ProjectCard
                  id={project.id}
                  name={project.name}
                  description={project.description}
                  createdAt={project.created_at}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  )
}
