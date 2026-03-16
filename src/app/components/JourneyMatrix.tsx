'use client'

import { useTransition } from 'react'
import type { Requirement, Persona } from '@/types'
import { updateRequirementStage } from '@/app/actions'
import { GenerateJourneyButton } from './GenerateJourneyButton'

const DFV_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  desirability: { bg: '#EFF6FF', text: '#3B82F6', label: 'Desirability' },
  feasibility: { bg: '#F0FDF4', text: '#22C55E', label: 'Feasibility' },
  viability: { bg: '#FFF7ED', text: '#F97316', label: 'Viability' },
}

interface JourneyMatrixProps {
  projectId: string
  stages: string[] | null
  requirements: Requirement[]
  personas: Persona[]
  personaReqLinks: { persona_id: string; requirement_id: string }[]
}

function RequirementMiniCard({
  requirement,
  stages,
  projectId,
}: {
  requirement: Requirement
  stages: string[]
  projectId: string
}) {
  const [isPending, startTransition] = useTransition()
  const dfv = requirement.dfv_tag ? DFV_COLORS[requirement.dfv_tag] : null

  function handleStageChange(stage: string) {
    startTransition(async () => {
      await updateRequirementStage(requirement.id, stage || null, projectId)
    })
  }

  return (
    <div
      className="rounded-xl border border-[#E5E5EA] bg-white p-3 space-y-2 text-sm"
      style={{ opacity: isPending ? 0.5 : 1 }}
    >
      <p className="text-[#1D1D1F] leading-snug line-clamp-3 text-xs">
        {requirement.user_story}
      </p>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {dfv && (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: dfv.bg, color: dfv.text }}
          >
            {dfv.label}
          </span>
        )}
        <select
          value={requirement.journey_stage ?? ''}
          onChange={(e) => handleStageChange(e.target.value)}
          disabled={isPending}
          className="ml-auto text-[10px] text-[#86868B] bg-transparent border-none cursor-pointer focus:outline-none hover:text-[#1D1D1F] transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <option value="">Unassigned</option>
          {stages.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export function JourneyMatrix({
  projectId,
  stages,
  requirements,
  personas,
  personaReqLinks,
}: JourneyMatrixProps) {
  // Build lookup: requirementId → set of personaIds
  const reqPersonaIds = new Map<string, Set<string>>()
  for (const link of personaReqLinks) {
    const set = reqPersonaIds.get(link.requirement_id) ?? new Set()
    set.add(link.persona_id)
    reqPersonaIds.set(link.requirement_id, set)
  }

  // Empty state — no stages generated yet
  if (!stages || stages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-[#86868B] text-sm text-center max-w-sm">
          Generate a journey to map your requirements across the task-context stages for this project.
        </p>
        <GenerateJourneyButton projectId={projectId} hasStages={false} />
      </div>
    )
  }

  const allColumns = [...stages, 'Unassigned']

  // Helper: get requirements for a given persona + stage
  function getReqs(personaId: string | null, stage: string): Requirement[] {
    return requirements.filter((r) => {
      const stageMatch =
        stage === 'Unassigned' ? !r.journey_stage : r.journey_stage === stage
      if (personaId === null) {
        // "Unlinked" row — reqs not linked to any persona
        const linkedPersonas = reqPersonaIds.get(r.id)
        return stageMatch && (!linkedPersonas || linkedPersonas.size === 0)
      }
      const linkedPersonas = reqPersonaIds.get(r.id)
      return stageMatch && !!linkedPersonas?.has(personaId)
    })
  }

  const rows: { id: string | null; label: string }[] = [
    ...personas.map((p) => ({ id: p.id, label: p.name })),
    { id: null, label: 'Unlinked' },
  ]

  return (
    <div className="space-y-4">
      {/* Header with re-generate button */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#86868B]">
          {stages.length} stages · {requirements.length} requirements · {personas.length} personas
        </p>
        <GenerateJourneyButton projectId={projectId} hasStages={true} />
      </div>

      {/* Scrollable matrix */}
      <div className="overflow-x-auto rounded-2xl border border-[#E5E5EA]">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-[#F5F5F7]">
              <th className="sticky left-0 z-10 bg-[#F5F5F7] min-w-[140px] w-[140px] px-4 py-3 text-left text-xs font-semibold text-[#86868B] uppercase tracking-wide border-b border-r border-[#E5E5EA]">
                Persona
              </th>
              {allColumns.map((col) => (
                <th
                  key={col}
                  className="min-w-[220px] w-[220px] px-4 py-3 text-left text-xs font-semibold text-[#86868B] uppercase tracking-wide border-b border-r border-[#E5E5EA] last:border-r-0"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => {
              const isUnlinked = row.id === null
              return (
                <tr
                  key={row.id ?? 'unlinked'}
                  className={isUnlinked ? 'bg-[#FAFAFA]' : 'bg-white'}
                >
                  {/* Persona label cell */}
                  <td className="sticky left-0 z-10 bg-inherit border-b border-r border-[#E5E5EA] px-4 py-3 align-top">
                    <span
                      className={`text-xs font-semibold ${isUnlinked ? 'text-[#86868B] italic' : 'text-[#1D1D1F]'}`}
                    >
                      {isUnlinked ? 'Unlinked' : row.label}
                    </span>
                  </td>
                  {/* Requirement cells per stage */}
                  {allColumns.map((col) => {
                    const cellReqs = getReqs(row.id, col)
                    return (
                      <td
                        key={col}
                        className={`border-b border-r border-[#E5E5EA] last:border-r-0 px-3 py-3 align-top ${rowIdx === rows.length - 1 ? 'border-b-0' : ''}`}
                      >
                        <div className="space-y-2 min-h-[48px]">
                          {cellReqs.map((req) => (
                            <RequirementMiniCard
                              key={req.id}
                              requirement={req}
                              stages={stages}
                              projectId={projectId}
                            />
                          ))}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
