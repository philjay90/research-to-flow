import Link from 'next/link'
import type { Persona } from '@/types'
import { ProvenanceDot } from './ProvenanceDot'
import { DeleteButton } from './DeleteButton'
import { deletePersona } from '@/app/actions'

interface PersonaCardProps {
  persona: Persona
  projectId: string
}

export function PersonaCard({ persona, projectId }: PersonaCardProps) {
  const provenance = persona.field_provenance ?? {}

  return (
    <div className="rounded-2xl bg-white shadow-sm p-5 flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <Link
          href={`/projects/${projectId}/personas/${persona.id}`}
          className="min-w-0 flex-1 group"
        >
          <div className="flex items-center gap-2">
            <ProvenanceDot source={provenance.name?.source ?? 'llm_inferred'} />
            <p className="font-semibold text-[#1D1D1F] text-base group-hover:underline truncate">
              {persona.name}
            </p>
          </div>
          {persona.role_title && (
            <p className="mt-0.5 ml-[18px] text-sm text-[#86868B]">{persona.role_title}</p>
          )}
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/projects/${projectId}/personas/${persona.id}`}
            className="flex h-7 items-center rounded-full border border-[#1D1D1F] px-3 text-xs font-medium text-[#1D1D1F] hover:bg-[#1D1D1F] hover:text-white transition-colors"
          >
            View →
          </Link>
          <DeleteButton
            action={deletePersona.bind(null, persona.id, projectId)}
            confirmMessage={`Delete "${persona.name}"? This cannot be undone.`}
          />
        </div>
      </div>

      {/* Pain points preview */}
      {persona.pain_points && (
        <p className="text-sm text-[#1D1D1F] leading-relaxed line-clamp-2 ml-[18px]">
          {persona.pain_points}
        </p>
      )}

      {/* Source count */}
      <div className="ml-[18px] flex items-center gap-2 text-xs text-[#86868B]">
        <span className="rounded-full bg-[#F5F5F7] px-2.5 py-0.5 font-medium text-[#1D1D1F]">
          {persona.source_input_ids?.length ?? 0}{' '}
          {(persona.source_input_ids?.length ?? 0) === 1 ? 'input' : 'inputs'}
        </span>
        <span className="text-[#86868B]/50">
          {new Date(persona.created_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  )
}
