'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import type { Requirement, Persona } from '@/types'
import {
  updateRequirementStage,
  linkPersonaRequirement,
  unlinkPersonaRequirement,
} from '@/app/actions'
import { GenerateJourneyButton } from './GenerateJourneyButton'

const DFV_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  desirability: { bg: '#EFF6FF', text: '#3B82F6', label: 'Desirability' },
  feasibility:  { bg: '#F0FDF4', text: '#22C55E', label: 'Feasibility' },
  viability:    { bg: '#FFF7ED', text: '#F97316', label: 'Viability' },
}

// ---------------------------------------------------------------------------
// Requirement detail modal
// ---------------------------------------------------------------------------

function RequirementDetailModal({
  requirement,
  personas,
  linkedPersonaIds,
  onClose,
}: {
  requirement: Requirement
  personas: Persona[]
  linkedPersonaIds: Set<string>
  onClose: () => void
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const dfv = requirement.dfv_tag ? DFV_COLORS[requirement.dfv_tag] : null
  const linkedPersonaNames = personas.filter((p) => linkedPersonaIds.has(p.id)).map((p) => p.name)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div
        className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-base font-semibold text-[#1D1D1F]">Requirement Detail</h2>
          <button
            onClick={onClose}
            className="shrink-0 text-xl leading-none text-[#86868B] hover:text-[#1D1D1F] transition-colors"
          >
            ×
          </button>
        </div>

        {/* User Story */}
        <section>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
            User Story
          </p>
          <p className="text-sm text-[#1D1D1F] leading-relaxed">{requirement.user_story}</p>
        </section>

        {/* Business Opportunity */}
        <section>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
            Business Opportunity
          </p>
          <p className="text-sm text-[#1D1D1F] leading-relaxed">{requirement.business_opportunity}</p>
        </section>

        {/* Acceptance Criteria */}
        {requirement.acceptance_criteria.length > 0 && (
          <section>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
              Acceptance Criteria
            </p>
            <ul className="space-y-1.5">
              {requirement.acceptance_criteria.map((c, i) => (
                <li key={i} className="flex gap-2 text-sm text-[#1D1D1F]">
                  <span className="text-[#86868B] shrink-0 mt-0.5">–</span>
                  <span className="leading-relaxed">{c}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 pt-4 border-t border-[#F5F5F7]">
          {dfv && (
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{ backgroundColor: dfv.bg, color: dfv.text }}
            >
              {dfv.label}
            </span>
          )}
          {requirement.journey_stage && (
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium bg-[#F5F5F7] text-[#86868B]">
              {requirement.journey_stage}
            </span>
          )}
          {linkedPersonaNames.map((name) => (
            <span
              key={name}
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{ backgroundColor: '#EFF6FF', color: '#3B82F6' }}
            >
              👤 {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Droppable column cell
// ---------------------------------------------------------------------------

function DroppableCell({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[56px] space-y-2 rounded-lg p-1 transition-colors duration-100 ${
        isOver ? 'bg-[#EFF6FF] ring-1 ring-inset ring-[#BFDBFE]' : ''
      }`}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Requirement mini-card (draggable)
// ---------------------------------------------------------------------------

function RequirementMiniCard({
  requirement,
  stages,
  personas,
  initialLinkedPersonaIds,
  projectId,
  onOpenModal,
  onStageChange,
}: {
  requirement: Requirement
  stages: string[]
  personas: Persona[]
  initialLinkedPersonaIds: Set<string>
  projectId: string
  onOpenModal: () => void
  onStageChange: (reqId: string, stage: string | null) => void
}) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `req::${requirement.id}`,
  })
  const [linkedIds, setLinkedIds] = useState(() => new Set(initialLinkedPersonaIds))
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const dfv = requirement.dfv_tag ? DFV_COLORS[requirement.dfv_tag] : null

  useEffect(() => {
    setLinkedIds(new Set(initialLinkedPersonaIds))
  }, [initialLinkedPersonaIds])

  useEffect(() => {
    if (!showPicker) return
    const handle = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node))
        setShowPicker(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [showPicker])

  async function handlePersonaToggle(personaId: string) {
    const isLinked = linkedIds.has(personaId)
    setLinkedIds((prev) => {
      const next = new Set(prev)
      isLinked ? next.delete(personaId) : next.add(personaId)
      return next
    })
    if (isLinked) await unlinkPersonaRequirement(personaId, requirement.id, projectId)
    else await linkPersonaRequirement(personaId, requirement.id, projectId)
    router.refresh()
  }

  const linkedCount = linkedIds.size

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      className="rounded-xl border border-[#E5E5EA] bg-white text-sm overflow-hidden"
      style={{ opacity: isDragging ? 0.25 : 1, touchAction: 'none' }}
    >
      {/* Drag handle + modal trigger */}
      <div
        {...listeners}
        onClick={onOpenModal}
        className="p-3 pb-2 space-y-1.5 cursor-grab active:cursor-grabbing"
      >
        <p className="text-[#1D1D1F] leading-snug line-clamp-3 text-xs pointer-events-none">
          {requirement.user_story}
        </p>
        {dfv && (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium pointer-events-none"
            style={{ backgroundColor: dfv.bg, color: dfv.text }}
          >
            {dfv.label}
          </span>
        )}
      </div>

      {/* Controls — stop propagation so drag and modal don't fire */}
      <div
        className="px-3 pb-2.5 flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Persona multi-select */}
        {personas.length > 0 && (
          <div className="relative" ref={pickerRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowPicker((v) => !v) }}
              className="flex items-center gap-1 text-[10px] text-[#86868B] hover:text-[#1D1D1F] transition-colors"
            >
              <span>👤</span>
              <span>
                {linkedCount > 0 ? `${linkedCount} persona${linkedCount > 1 ? 's' : ''}` : 'No persona'}
              </span>
              <span className="text-[8px]">▾</span>
            </button>

            {showPicker && (
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
          onChange={(e) => onStageChange(requirement.id, e.target.value || null)}
          className="ml-auto text-[10px] text-[#86868B] bg-transparent border-none cursor-pointer focus:outline-none hover:text-[#1D1D1F] transition-colors"
        >
          <option value="">Unassigned</option>
          {stages.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Compact ghost shown at cursor during drag
// ---------------------------------------------------------------------------

function DragCard({ requirement }: { requirement: Requirement }) {
  const dfv = requirement.dfv_tag ? DFV_COLORS[requirement.dfv_tag] : null
  return (
    <div className="rounded-xl border border-[#BFDBFE] bg-white shadow-xl p-3 space-y-1.5 w-[210px] rotate-2 opacity-90 pointer-events-none">
      <p className="text-[#1D1D1F] leading-snug line-clamp-2 text-xs">{requirement.user_story}</p>
      {dfv && (
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: dfv.bg, color: dfv.text }}
        >
          {dfv.label}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// JourneyMatrix
// ---------------------------------------------------------------------------

interface JourneyMatrixProps {
  projectId: string
  stages: string[] | null
  requirements: Requirement[]
  personas: Persona[]
  personaReqLinks: { persona_id: string; requirement_id: string }[]
}

export function JourneyMatrix({
  projectId,
  stages,
  requirements,
  personas,
  personaReqLinks,
}: JourneyMatrixProps) {
  const router = useRouter()
  const [localReqs, setLocalReqs] = useState(requirements)
  const [activeReqId, setActiveReqId] = useState<string | null>(null)
  const [modalReqId, setModalReqId] = useState<string | null>(null)

  // Sync when server data refreshes
  useEffect(() => { setLocalReqs(requirements) }, [requirements])

  const reqPersonaIds = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const link of personaReqLinks) {
      const set = map.get(link.requirement_id) ?? new Set<string>()
      set.add(link.persona_id)
      map.set(link.requirement_id, set)
    }
    return map
  }, [personaReqLinks])

  // 8px distance before drag activates — preserves click behaviour
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function handleDragStart({ active }: DragStartEvent) {
    setActiveReqId((active.id as string).replace('req::', ''))
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveReqId(null)
    if (!over) return
    const reqId = (active.id as string).replace('req::', '')
    const stagePart = (over.id as string).split('::')[0]
    const newStage = stagePart === '__unassigned__' ? null : stagePart
    const current = localReqs.find((r) => r.id === reqId)
    if (current?.journey_stage === newStage) return
    setLocalReqs((prev) => prev.map((r) => (r.id === reqId ? { ...r, journey_stage: newStage } : r)))
    updateRequirementStage(reqId, newStage, projectId).then(() => router.refresh())
  }

  function handleStageChange(reqId: string, newStage: string | null) {
    const current = localReqs.find((r) => r.id === reqId)
    if (current?.journey_stage === newStage) return
    setLocalReqs((prev) => prev.map((r) => (r.id === reqId ? { ...r, journey_stage: newStage } : r)))
    updateRequirementStage(reqId, newStage, projectId).then(() => router.refresh())
  }

  // Empty state
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
    return localReqs.filter((r) => {
      const stageMatch = stage === 'Unassigned' ? !r.journey_stage : r.journey_stage === stage
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

  const activeReq = activeReqId ? localReqs.find((r) => r.id === activeReqId) : null
  const modalReq = modalReqId ? localReqs.find((r) => r.id === modalReqId) : null

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-3">
        <p className="text-xs text-[#86868B]">
          {stages.length} stages · {localReqs.length} requirements · {personas.length} personas
        </p>

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
                      const droppableId = `${col === 'Unassigned' ? '__unassigned__' : col}::${row.id ?? 'unlinked'}`
                      const cellReqs = getReqs(row.id, col)
                      return (
                        <td
                          key={col}
                          className={`border-b border-r border-[#E5E5EA] last:border-r-0 px-3 py-3 align-top ${rowIdx === rows.length - 1 ? 'border-b-0' : ''}`}
                        >
                          <DroppableCell id={droppableId}>
                            {cellReqs.map((req) => (
                              <RequirementMiniCard
                                key={req.id}
                                requirement={req}
                                stages={stages}
                                personas={personas}
                                initialLinkedPersonaIds={reqPersonaIds.get(req.id) ?? new Set()}
                                projectId={projectId}
                                onOpenModal={() => setModalReqId(req.id)}
                                onStageChange={handleStageChange}
                              />
                            ))}
                          </DroppableCell>
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

      {/* Ghost card shown at cursor while dragging */}
      <DragOverlay dropAnimation={null}>
        {activeReq ? <DragCard requirement={activeReq} /> : null}
      </DragOverlay>

      {/* Detail modal */}
      {modalReq && (
        <RequirementDetailModal
          requirement={modalReq}
          personas={personas}
          linkedPersonaIds={reqPersonaIds.get(modalReq.id) ?? new Set()}
          onClose={() => setModalReqId(null)}
        />
      )}
    </DndContext>
  )
}
