'use client'

import { useState } from 'react'
import type { Persona, Requirement } from '@/types'
import { PersonaCard } from './PersonaCard'
import { PersonaModal } from './PersonaModal'
import { ProvenanceLegend } from './ProvenanceDot'

interface PersonasTabClientProps {
  personas: Persona[]
  projectId: string
  allRequirements: Requirement[]
  personaReqLinks: { persona_id: string; requirement_id: string; link_source?: 'llm' | 'manual' }[]
}

export function PersonasTabClient({
  personas,
  projectId,
  allRequirements,
  personaReqLinks,
}: PersonasTabClientProps) {
  const [openPersonaId, setOpenPersonaId] = useState<string | null>(null)
  const openPersona = personas.find((p) => p.id === openPersonaId) ?? null

  return (
    <>
      <div className="mb-4">
        <ProvenanceLegend />
      </div>

      <ul className="space-y-4">
        {personas.map((persona) => (
          <li key={persona.id}>
            <PersonaCard
              persona={persona}
              projectId={projectId}
              onOpen={() => setOpenPersonaId(persona.id)}
            />
          </li>
        ))}
      </ul>

      {openPersona && (
        <PersonaModal
          persona={openPersona}
          projectId={projectId}
          allRequirements={allRequirements}
          personaReqLinks={personaReqLinks}
          onClose={() => setOpenPersonaId(null)}
        />
      )}
    </>
  )
}
