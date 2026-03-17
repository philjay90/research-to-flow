'use client'

import Link from 'next/link'
import { deletePersona } from '@/app/actions'
import type { Persona } from '@/types'
import { DeleteButton } from '@/app/components/DeleteButton'

interface Props {
  personas: Persona[]
  projectId: string
}

export function FlowsTabClient({ personas, projectId }: Props) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {personas.map((persona) => (
        <li key={persona.id}>
          <div className="rounded-2xl bg-white p-5 shadow-sm flex flex-col gap-3">
            {/* Header row */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1 flex items-center gap-2">
                {/* Avatar */}
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: '#1D1D1F' }}
                >
                  {persona.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[#1D1D1F] text-base truncate">{persona.name}</p>
                  {persona.role_title && (
                    <p className="text-sm text-[#86868B] truncate">{persona.role_title}</p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <DeleteButton
                  action={deletePersona.bind(null, persona.id, projectId)}
                  confirmMessage={`Delete "${persona.name}"? This cannot be undone.`}
                />
              </div>
            </div>

            {/* Pain points preview */}
            {persona.pain_points && (
              <p className="text-sm text-[#1D1D1F] leading-relaxed line-clamp-2 ml-11">
                {persona.pain_points}
              </p>
            )}

            {/* Footer: source count + open button */}
            <div className="ml-11 flex items-center justify-between">
              <span className="rounded-full bg-[#F5F5F7] px-2.5 py-0.5 text-xs font-medium text-[#1D1D1F]">
                {persona.source_input_ids?.length ?? 0}{' '}
                {(persona.source_input_ids?.length ?? 0) === 1 ? 'input' : 'inputs'}
              </span>
              <Link
                href={`/projects/${projectId}/flows/${persona.id}`}
                className="flex h-7 items-center rounded-full border border-[#1D1D1F] px-3 text-xs font-medium text-[#1D1D1F] hover:bg-[#1D1D1F] hover:text-white transition-colors"
              >
                Open →
              </Link>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
