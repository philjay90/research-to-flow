import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { deleteFlow } from '@/app/actions'
import type { Project, Flow } from '@/types'
import { Button } from '@/components/ui/button'
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
        supabase.from('research_input').select('id', { count: 'exact', head: true }).eq('flow_id', f.id),
        supabase.from('requirement').select('id', { count: 'exact', head: true }).eq('flow_id', f.id),
      ])
      return { flowId: f.id, inputCount: inputCount ?? 0, reqCount: reqCount ?? 0 }
    })
  )

  const countMap = new Map(counts.map((c) => [c.flowId, c]))

  return (
    <>
      <AppHeader crumbs={[{ label: p.name }]} />

      <main className="mx-auto max-w-3xl px-8 py-16">
        {p.description && (
          <p className="mb-4 text-[#7286A0] leading-relaxed">{p.description}</p>
        )}

        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="mb-1 text-sm font-medium text-[#7286A0]">Named flows within this project</p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Flows</h1>
          </div>
          <Button asChild className="bg-[#EE4266] text-white hover:bg-[#d63558] rounded-full px-5">
            <Link href={`/projects/${id}/flows/new`}>+ New Flow</Link>
          </Button>
        </div>

        {flowList.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 text-center shadow-sm">
            <p className="text-lg font-medium text-foreground">No flows yet</p>
            <p className="mt-2 text-sm text-[#7286A0]">Create a flow to start adding research inputs.</p>
            <Button asChild className="mt-6 bg-[#EE4266] text-white hover:bg-[#d63558] rounded-full px-5">
              <Link href={`/projects/${id}/flows/new`}>Create Flow</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-4">
            {flowList.map((flow) => {
              const c = countMap.get(flow.id)
              return (
                <li key={flow.id}>
                  <div className="group rounded-2xl bg-white shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex items-center gap-4 p-6">
                      <Link href={`/projects/${id}/flows/${flow.id}`} className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground text-base group-hover:text-[#EE4266] transition-colors">
                          {flow.name}
                        </p>
                        {flow.description && (
                          <p className="mt-1 text-sm text-[#7286A0] leading-relaxed">{flow.description}</p>
                        )}
                        <div className="mt-3 flex items-center gap-3 text-xs text-[#7286A0]/70">
                          <span className="rounded-full bg-[#f3f7f0] px-2.5 py-0.5 font-medium text-[#7286A0]">
                            {c?.inputCount ?? 0} {(c?.inputCount ?? 0) === 1 ? 'input' : 'inputs'}
                          </span>
                          <span className="rounded-full bg-[#f3f7f0] px-2.5 py-0.5 font-medium text-[#7286A0]">
                            {c?.reqCount ?? 0} {(c?.reqCount ?? 0) === 1 ? 'requirement' : 'requirements'}
                          </span>
                          <span className="text-[#7286A0]/50">
                            {new Date(flow.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </Link>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          asChild size="sm" variant="outline"
                          className="rounded-full text-xs border-[#19323C] text-[#19323C] hover:bg-[#19323C] hover:text-white transition-colors"
                        >
                          <Link href={`/projects/${id}/flows/${flow.id}/canvas`}>Canvas →</Link>
                        </Button>
                        <DeleteButton
                          action={deleteFlow.bind(null, flow.id, id)}
                          confirmMessage={`Delete "${flow.name}"? This will permanently remove all inputs, requirements, and the canvas for this flow. This cannot be undone.`}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </>
  )
}
