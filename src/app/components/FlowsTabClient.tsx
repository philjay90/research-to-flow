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
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {personas.map((persona) => (
        <li key={persona.id}>
          <div className="rounded-2xl bg-white p-6 shadow-sm flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[#1D1D1F] text-lg leading-snug truncate">
                  {persona.name}
                </p>
                {persona.role_title && (
                  <p className="mt-0.5 text-sm text-[#86868B] truncate">
                    User Group: {persona.role_title}
                  </p>
                )}
              </div>
              <DeleteButton
                action={deletePersona.bind(null, persona.id, projectId)}
                confirmMessage={`Delete "${persona.name}"? This cannot be undone.`}
              />
            </div>

            {/* Description */}
            {persona.background && (
              <p className="text-sm text-[#1D1D1F] leading-relaxed line-clamp-3">
                {persona.background}
              </p>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end pt-1 border-t border-[#F5F5F7]">
              <Link
                href={`/projects/${projectId}/flows/${persona.id}`}
                className="flex h-8 items-center rounded-full border border-[#1D1D1F] px-4 text-xs font-medium text-[#1D1D1F] hover:bg-[#1D1D1F] hover:text-white transition-colors"
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
