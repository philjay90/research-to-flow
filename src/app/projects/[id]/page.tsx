import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { deleteFlow } from '@/app/actions'
import type { Project, Flow } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AppHeader } from '@/app/components/AppHeader'
import { DeleteButton } from '@/app/components/DeleteButton'

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

  const { data: flows } = await supabase
    .from('flow')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: true })

  const p = project as Project
  const flowList = (flows ?? []) as Flow[]

  // Fetch input + requirement counts per flow
  const counts = await Promise.all(
    flowList.map(async (f) => {
      const [{ count: inputCount }, { count: reqCount }] = await Promise.all([
        supabase
          .from('research_input')
          .select('id', { count: 'exact', head: true })
          .eq('flow_id', f.id),
        supabase
          .from('requirement')
          .select('id', { count: 'exact', head: true })
          .eq('flow_id', f.id),
      ])
      return { flowId: f.id, inputCount: inputCount ?? 0, reqCount: reqCount ?? 0 }
    })
  )

  const countMap = new Map(counts.map((c) => [c.flowId, c]))

  return (
    <>
      <AppHeader crumbs={[{ label: p.name }]} />

      <main className="mx-auto max-w-3xl px-6 py-10">
        {p.description && (
          <p className="mb-6 text-[#7286A0]">{p.description}</p>
        )}

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Flows</h1>
            <p className="mt-1 text-sm text-[#7286A0]">Named flows within this project</p>
          </div>
          <Button asChild className="bg-[#EE4266] text-white hover:bg-[#d63558]">
            <Link href={`/projects/${id}/flows/new`}>New Flow</Link>
          </Button>
        </div>

        {flowList.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-[#7286A0]">No flows yet.</p>
              <p className="mt-1 text-sm text-[#7286A0]">Create one to start adding research inputs.</p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {flowList.map((flow) => {
              const c = countMap.get(flow.id)
              return (
                <li key={flow.id}>
                  <Card className="transition-shadow hover:shadow-md hover:border-[#EE4266]/40">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <Link href={`/projects/${id}/flows/${flow.id}`} className="min-w-0 flex-1">
                          <p className="text-xs font-semibold uppercase tracking-wider text-[#7286A0]">
                            Flow
                          </p>
                          <p className="mt-0.5 font-semibold text-foreground">{flow.name}</p>
                          {flow.description && (
                            <p className="mt-1 text-sm text-[#7286A0]">{flow.description}</p>
                          )}
                          <div className="mt-2 flex items-center gap-4 text-xs text-[#7286A0]/70">
                            <span>{c?.inputCount ?? 0} input{(c?.inputCount ?? 0) !== 1 ? 's' : ''}</span>
                            <span>·</span>
                            <span>{c?.reqCount ?? 0} requirement{(c?.reqCount ?? 0) !== 1 ? 's' : ''}</span>
                            <span>·</span>
                            <span>Created {new Date(flow.created_at).toLocaleDateString()}</span>
                          </div>
                        </Link>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button asChild size="sm" variant="outline"
                            className="h-7 text-xs border-[#19323C] text-[#19323C] hover:bg-[#19323C]/10">
                            <Link href={`/projects/${id}/flows/${flow.id}/canvas`}>Canvas →</Link>
                          </Button>
                          <DeleteButton
                            action={deleteFlow.bind(null, flow.id, id)}
                            confirmMessage={`Delete "${flow.name}"? This will permanently remove all inputs, requirements, and the canvas for this flow. This cannot be undone.`}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </>
  )
}
