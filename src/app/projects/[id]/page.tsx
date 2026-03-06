import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { deleteFlow, updateProject, updateFlow } from '@/app/actions'
import type { Project, Flow, Persona } from '@/types'
import { Button } from '@/components/ui/button'
import { AppHeader } from '@/app/components/AppHeader'
import { DeleteButton } from '@/app/components/DeleteButton'
import { EditableHeader } from '@/app/components/EditableHeader'
import { EditableFlowCard } from '@/app/components/EditableFlowCard'
import { PersonaCard } from '@/app/components/PersonaCard'
import { SynthesizePersonasButton } from '@/app/components/SynthesizePersonasButton'
import { ProvenanceLegend } from '@/app/components/ProvenanceDot'

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab = 'flows' } = await searchParams
  const supabase = await createClient()

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

  const { data: personas } = await supabase
    .from('persona')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: true })

  const p = project as Project
  const flowList = (flows ?? []) as Flow[]
  const personaList = (personas ?? []) as Persona[]

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
  const activeTab = tab === 'personas' ? 'personas' : 'flows'

  return (
    <>
      <AppHeader crumbs={[{ label: p.name }]} />

      <main className="mx-auto max-w-3xl px-8 py-16">
        {/* Editable project title + description */}
        <EditableHeader
          name={p.name}
          description={p.description}
          onSave={updateProject.bind(null, p.id)}
        />

        {/* Tab switcher */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-1 rounded-full bg-[#F5F5F7] p-1">
            <Link
              href={`/projects/${id}?tab=flows`}
              className={`flex h-8 items-center rounded-full px-4 text-sm font-medium transition-colors ${
                activeTab === 'flows'
                  ? 'bg-white text-[#1D1D1F] shadow-sm'
                  : 'text-[#86868B] hover:text-[#1D1D1F]'
              }`}
            >
              Flows
              {flowList.length > 0 && (
                <span className="ml-1.5 text-xs opacity-60">{flowList.length}</span>
              )}
            </Link>
            <Link
              href={`/projects/${id}?tab=personas`}
              className={`flex h-8 items-center rounded-full px-4 text-sm font-medium transition-colors ${
                activeTab === 'personas'
                  ? 'bg-white text-[#1D1D1F] shadow-sm'
                  : 'text-[#86868B] hover:text-[#1D1D1F]'
              }`}
            >
              Personas
              {personaList.length > 0 && (
                <span className="ml-1.5 text-xs opacity-60">{personaList.length}</span>
              )}
            </Link>
          </div>

          {activeTab === 'flows' ? (
            <Button asChild className="bg-[#F0E100] text-[#1D1D1F] hover:bg-[#d4c900] rounded-full px-5 font-semibold">
              <Link href={`/projects/${id}/flows/new`}>+ New Flow</Link>
            </Button>
          ) : (
            <SynthesizePersonasButton projectId={id} />
          )}
        </div>

        {/* FLOWS TAB */}
        {activeTab === 'flows' && (
          <>
            {flowList.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 text-center shadow-sm">
                <p className="text-lg font-medium text-foreground">No flows yet</p>
                <p className="mt-2 text-sm text-foreground">Create a flow to start adding research inputs.</p>
                <Button asChild className="mt-6 bg-[#F0E100] text-[#1D1D1F] hover:bg-[#d4c900] rounded-full px-5 font-semibold">
                  <Link href={`/projects/${id}/flows/new`}>Create Flow</Link>
                </Button>
              </div>
            ) : (
              <ul className="space-y-4">
                {flowList.map((flow) => {
                  const c = countMap.get(flow.id)
                  return (
                    <li key={flow.id}>
                      <EditableFlowCard
                        flowId={flow.id}
                        name={flow.name}
                        description={flow.description}
                        onSave={updateFlow.bind(null, flow.id, id)}
                      >
                        <Link href={`/projects/${id}/flows/${flow.id}`} className="block min-w-0">
                          <p className="font-semibold text-foreground text-base">
                            {flow.name}
                          </p>
                          {flow.description && (
                            <p className="mt-1 text-sm text-foreground leading-relaxed">{flow.description}</p>
                          )}
                          <div className="mt-3 flex items-center gap-3 text-xs">
                            <span className="rounded-full bg-[#F5F5F7] px-2.5 py-0.5 font-medium text-foreground">
                              {c?.inputCount ?? 0} {(c?.inputCount ?? 0) === 1 ? 'input' : 'inputs'}
                            </span>
                            <span className="rounded-full bg-[#F5F5F7] px-2.5 py-0.5 font-medium text-foreground">
                              {c?.reqCount ?? 0} {(c?.reqCount ?? 0) === 1 ? 'requirement' : 'requirements'}
                            </span>
                            <span className="text-foreground/50">
                              {new Date(flow.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </Link>
                        <div className="flex shrink-0 items-center gap-2 mt-4">
                          <Button
                            asChild size="sm" variant="outline"
                            className="rounded-full text-xs border-[#1D1D1F] text-[#1D1D1F] hover:bg-[#1D1D1F] hover:text-white transition-colors"
                          >
                            <Link href={`/projects/${id}/flows/${flow.id}/canvas`}>Canvas →</Link>
                          </Button>
                          <DeleteButton
                            action={deleteFlow.bind(null, flow.id, id)}
                            confirmMessage={`Delete "${flow.name}"? This will permanently remove all inputs, requirements, and the canvas for this flow. This cannot be undone.`}
                          />
                        </div>
                      </EditableFlowCard>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}

        {/* PERSONAS TAB */}
        {activeTab === 'personas' && (
          <>
            {personaList.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 text-center shadow-sm">
                <p className="text-lg font-medium text-foreground">No personas yet</p>
                <p className="mt-2 text-sm text-foreground max-w-sm">
                  Add research inputs to your flows, then click{' '}
                  <span className="font-medium">✦ Synthesize Personas</span> to generate personas from your data.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <ProvenanceLegend />
                </div>
                <ul className="space-y-4">
                  {personaList.map((persona) => (
                    <li key={persona.id}>
                      <PersonaCard persona={persona} projectId={id} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </main>
    </>
  )
}
