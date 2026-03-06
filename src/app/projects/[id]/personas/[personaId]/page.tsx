import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Persona, Requirement, PersonaRequirement } from '@/types'
import { AppHeader } from '@/app/components/AppHeader'
import { ProvenanceLegend } from '@/app/components/ProvenanceDot'
import { PersonaDetailClient } from './PersonaDetailClient'

export default async function PersonaDetailPage({
  params,
}: {
  params: Promise<{ id: string; personaId: string }>
}) {
  const { id, personaId } = await params
  const supabase = await createClient()

  const [
    { data: project, error: projectError },
    { data: persona, error: personaError },
  ] = await Promise.all([
    supabase.from('project').select('*').eq('id', id).single(),
    supabase.from('persona').select('*').eq('id', personaId).single(),
  ])

  if (projectError || !project || personaError || !persona) notFound()

  // Fetch persona_requirement links for this persona
  const { data: links } = await supabase
    .from('persona_requirement')
    .select('requirement_id, link_source')
    .eq('persona_id', personaId)

  const linkedIds = new Set((links ?? []).map((l: Pick<PersonaRequirement, 'requirement_id'>) => l.requirement_id))
  const linkSourceMap = new Map(
    (links ?? []).map((l: Pick<PersonaRequirement, 'requirement_id' | 'link_source'>) => [l.requirement_id, l.link_source])
  )

  // Fetch all requirements for this project
  const { data: allRequirements } = await supabase
    .from('requirement')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: true })

  const reqs = (allRequirements ?? []) as Requirement[]
  const p = persona as Persona

  const linkedRequirements = reqs
    .filter((r) => linkedIds.has(r.id))
    .map((r) => ({ ...r, link_source: linkSourceMap.get(r.id) as 'llm' | 'manual' }))

  return (
    <>
      <AppHeader
        crumbs={[
          { label: project.name, href: `/projects/${id}` },
          { label: 'Personas', href: `/projects/${id}?tab=personas` },
          { label: p.name },
        ]}
      />

      <main className="mx-auto max-w-2xl px-8 py-12">
        {/* Page header */}
        <div className="mb-8">
          <div className="mb-1 flex items-center gap-2">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
              style={{ backgroundColor: '#1D1D1F' }}
            >
              {p.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">{p.name}</h1>
              {p.role_title && (
                <p className="text-sm text-[#86868B]">{p.role_title}</p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <ProvenanceLegend />
          </div>
        </div>

        <PersonaDetailClient
          persona={p}
          projectId={id}
          linkedRequirements={linkedRequirements}
          allRequirements={reqs}
        />
      </main>
    </>
  )
}
