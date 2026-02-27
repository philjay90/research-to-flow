import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

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
              <Link href={`/projects/${project.id}`}>
                <Card className="cursor-pointer transition-shadow hover:shadow-md hover:border-[#EE4266]/40">
                  <CardContent className="p-4">
                    <p className="font-semibold text-foreground">{project.name}</p>
                    {project.description && (
                      <p className="mt-1 text-sm text-[#7286A0]">{project.description}</p>
                    )}
                    <p className="mt-2 text-xs text-[#7286A0]/70">
                      Created {new Date(project.created_at).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
