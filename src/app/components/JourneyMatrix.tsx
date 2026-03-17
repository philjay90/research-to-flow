'use client'

import { useTransition, useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Requirement, Persona } from '@/types'
import { updateRequirementStage, linkPersonaRequirement, unlinkPersonaRequirement } from '@/app/actions'
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
  personas,
  initialLinkedPersonaIds,
  projectId,
}: {
  requirement: Requirement
  stages: string[]
  personas: Persona[]
  initialLinkedPersonaIds: Set<string>
  projectId: string
}) {
  const router = useRouter()
  const [stageTransition, startStageTransition] = useTransition()
  const [showPersonaPicker, setShowPersonaPicker] = useState(false)
  // Optimistic local state so checkboxes snap immediately
  const [linkedIds, setLinkedIds] = useState(() => new Set(initialLinkedPersonaIds))
  const pickerRef = useRef<HTMLDivElement>(null)
  const dfv = requirement.dfv_tag ? DFV_COLORS[requirement.dfv_tag] : null

  // Sync if parent prop changes (e.g. after page refresh)
  useEffect(() => {
    setLinkedIds(new Set(initialLinkedPersonaIds))
  }, [initialLinkedPersonaIds])

  // Close picker on outside click
  useEffect(() => {
    if (!showPersonaPicker) return
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPersonaPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showPersonaPicker])

  function handleStageChange(stage: string) {
    startStageTransition(async () => {
      await updateRequirementStage(requirement.id, stage || null, projectId)
    })
  }

  async function handlePersonaToggle(personaId: string) {
    const isLinked = linkedIds.has(personaId)
    // Optimistic update
    setLinkedIds((prev) => {
      const next = new Set(prev)
      if (isLinked) next.delete(personaId)
      else next.add(personaId)
      return next
    })
    if (isLinked) {
      await unlinkPersonaRequirement(personaId, requirement.id, projectId)
    } else {
      await linkPersonaRequirement(personaId, requirement.id, projectId)
    }
    router.refresh()
  }

  const linkedCount = linkedIds.size

  return (
    <div
      className="rounded-xl border border-[#E5E5EA] bg-white p-3 space-y-2 text-sm"
      style={{ opacity: stageTransition ? 0.5 : 1 }}
    >
      <p className="text-[#1D1D1F] leading-snug line-clamp-3 text-xs">
        {requirement.user_story}
      </p>

      {/* DFV badge */}
      {dfv && (
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: dfv.bg, color: dfv.text }}
        >
          {dfv.label}
        </span>
      )}

      {/* Controls row */}
      <div className="flex items-center gap-2 flex-wrap pt-0.5">
        {/* Persona picker */}
        {personas.length > 0 && (
          <div className="relative" ref={pickerRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowPersonaPicker((v) => !v) }}
              className="flex items-center gap-1 text-[10px] text-[#86868B] hover:text-[#1D1D1F] transition-colors"
            >
              <span>👤</span>
              <span>{linkedCount > 0 ? `${linkedCount} persona${linkedCount > 1 ? 's' : ''}` : 'No persona'}</span>
              <span className="text-[8px]">▾</span>
            </button>

            {showPersonaPicker && (
              <div
                className="absolute bottom-full mb-1 left-0 z-50 min-w-[180px] rounded-xl border border-[#E5E5EA] bg-white shadow-lg py-1"
                onClick={(e) => e.stopPropagation()}
              >
                {personas.map((persona) => {
                  const isLinked = linkedIds.has(persona.id)
                  return (
                    <label
                      key={persona.id}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs text-[#1D1D1F] hover:bg-[#F5F5F7] cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={isLinked}
                        onChange={() => handlePersonaToggle(persona.id)}
                        className="rounded accent-[#1D1D1F] w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="truncate">{persona.name}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Stage dropdown */}
        <select
          value={requirement.journey_stage ?? ''}
          onChange={(e) => handleStageChange(e.target.value)}
          disabled={stageTransition}
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

  function getReqs(personaId: string | null, stage: string): Requirement[] {
    return requirements.filter((r) => {
      const stageMatch =
        stage === 'Unassigned' ? !r.journey_stage : r.journey_stage === stage
      if (personaId === null) {
        const linked = reqPersonaIds.get(r.id)
        return stageMatch && (!linked || linked.size === 0)
      }
      return stageMatch && !!reqPersonaIds.get(r.id)?.has(personaId)
    })
  }

  const rows: { id: string | null; label: string }[] = [
    ...personas.map((p) => ({ id: p.id, label: p.name })),
    { id: null, label: 'Unlinked' },
  ]

  return (
    <div className="space-y-4">
      {/* Stats */}
      <p className="text-xs text-[#86868B]">
        {stages.length} stages · {requirements.length} requirements · {personas.length} personas
      </p>

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
                  <td className="sticky left-0 z-10 bg-inherit border-b border-r border-[#E5E5EA] px-4 py-3 align-top">
                    <span className={`text-xs font-semibold ${isUnlinked ? 'text-[#86868B] italic' : 'text-[#1D1D1F]'}`}>
                      {isUnlinked ? 'Unlinked' : row.label}
                    </span>
                  </td>
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
                              personas={personas}
                              initialLinkedPersonaIds={reqPersonaIds.get(req.id) ?? new Set()}
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
