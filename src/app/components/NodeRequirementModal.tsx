'use client'

import { useState, useEffect } from 'react'
import { updateRequirement } from '@/app/actions'
import type { Requirement, DFVTag } from '@/types'

const DFV_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'desirability', label: 'Desirability' },
  { value: 'feasibility',  label: 'Feasibility' },
  { value: 'viability',    label: 'Viability' },
]

const DFV_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  desirability: { bg: '#EFF6FF', text: '#3B82F6', label: 'Desirability' },
  feasibility:  { bg: '#F0FDF4', text: '#22C55E', label: 'Feasibility' },
  viability:    { bg: '#FFF7ED', text: '#F97316', label: 'Viability' },
}

interface NodeRequirementModalProps {
  requirement: Requirement
  projectId: string
  onClose: () => void
  /** Called after a successful save so the parent can refresh data */
  onSaved: () => void
}

export function NodeRequirementModal({
  requirement,
  projectId,
  onClose,
  onSaved,
}: NodeRequirementModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [draftStory,       setDraftStory]       = useState(requirement.user_story)
  const [draftOpportunity, setDraftOpportunity] = useState(requirement.business_opportunity)
  const [draftCriteria,    setDraftCriteria]    = useState<string[]>(requirement.acceptance_criteria)
  const [draftDfv,         setDraftDfv]         = useState<string>(requirement.dfv_tag ?? '')

  // Sync drafts if requirement prop changes (e.g. after external update)
  useEffect(() => {
    if (!isEditing) {
      setDraftStory(requirement.user_story)
      setDraftOpportunity(requirement.business_opportunity)
      setDraftCriteria(requirement.acceptance_criteria)
      setDraftDfv(requirement.dfv_tag ?? '')
    }
  }, [requirement, isEditing])

  // Escape to cancel edit or close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditing) cancelEdit()
        else onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isEditing, onClose])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function cancelEdit() {
    setDraftStory(requirement.user_story)
    setDraftOpportunity(requirement.business_opportunity)
    setDraftCriteria(requirement.acceptance_criteria)
    setDraftDfv(requirement.dfv_tag ?? '')
    setIsEditing(false)
  }

  async function handleSave() {
    setIsSaving(true)
    await updateRequirement(requirement.id, projectId, {
      user_story: draftStory,
      business_opportunity: draftOpportunity,
      acceptance_criteria: draftCriteria.filter((c) => c.trim()),
      dfv_tag: (draftDfv as DFVTag) || null,
    })
    setIsSaving(false)
    setIsEditing(false)
    onSaved()
    onClose()
  }

  function addCriterion() {
    setDraftCriteria((prev) => [...prev, ''])
  }

  function updateCriterion(idx: number, val: string) {
    setDraftCriteria((prev) => prev.map((c, i) => (i === idx ? val : c)))
  }

  function removeCriterion(idx: number) {
    setDraftCriteria((prev) => prev.filter((_, i) => i !== idx))
  }

  const dfv = requirement.dfv_tag ? DFV_COLORS[requirement.dfv_tag] : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={isEditing ? undefined : onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      <div
        className="relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-base font-semibold text-[#1D1D1F]">
              {isEditing ? 'Edit Requirement' : 'Requirement'}
            </h2>
            <div className="flex items-center gap-2 shrink-0">
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs font-medium text-[#86868B] hover:text-[#1D1D1F] border border-[#E5E5EA] rounded-full px-3 py-1 transition-colors"
                >
                  Edit
                </button>
              )}
              {isEditing && (
                <button
                  onClick={cancelEdit}
                  className="text-xs font-medium text-[#86868B] hover:text-[#1D1D1F] border border-[#E5E5EA] rounded-full px-3 py-1 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={onClose}
                className="text-xl leading-none text-[#86868B] hover:text-[#1D1D1F] transition-colors"
              >
                ×
              </button>
            </div>
          </div>

          {/* User Story */}
          <section>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
              User Story
            </p>
            {isEditing ? (
              <textarea
                value={draftStory}
                onChange={(e) => setDraftStory(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-[#E5E5EA] px-3 py-2 text-sm text-[#1D1D1F] focus:border-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#1D1D1F] resize-none leading-relaxed"
              />
            ) : (
              <p className="text-sm text-[#1D1D1F] leading-relaxed">{requirement.user_story}</p>
            )}
          </section>

          {/* Business Opportunity */}
          <section>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
              Business Opportunity
            </p>
            {isEditing ? (
              <textarea
                value={draftOpportunity}
                onChange={(e) => setDraftOpportunity(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-[#E5E5EA] px-3 py-2 text-sm text-[#1D1D1F] focus:border-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#1D1D1F] resize-none leading-relaxed"
              />
            ) : (
              <p className="text-sm text-[#1D1D1F] leading-relaxed">{requirement.business_opportunity}</p>
            )}
          </section>

          {/* Acceptance Criteria */}
          <section>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
              Acceptance Criteria
            </p>
            {isEditing ? (
              <div className="space-y-2">
                {draftCriteria.map((c, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-2.5 text-[#86868B] text-xs shrink-0">–</span>
                    <input
                      value={c}
                      onChange={(e) => updateCriterion(i, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCriterion() } }}
                      placeholder="Criterion..."
                      className="flex-1 rounded-lg border border-[#E5E5EA] px-3 py-1.5 text-sm text-[#1D1D1F] focus:border-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#1D1D1F]"
                    />
                    <button
                      onClick={() => removeCriterion(i)}
                      className="mt-1.5 text-[#86868B] hover:text-red-500 text-lg leading-none transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={addCriterion}
                  className="mt-1 text-xs text-[#86868B] hover:text-[#1D1D1F] transition-colors"
                >
                  + Add criterion
                </button>
              </div>
            ) : requirement.acceptance_criteria.length > 0 ? (
              <ul className="space-y-1.5">
                {requirement.acceptance_criteria.map((c, i) => (
                  <li key={i} className="flex gap-2 text-sm text-[#1D1D1F]">
                    <span className="text-[#86868B] shrink-0 mt-0.5">–</span>
                    <span className="leading-relaxed">{c}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#86868B] italic">No criteria added.</p>
            )}
          </section>

          {/* DFV tag */}
          {isEditing ? (
            <section>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                DFV Tag
              </p>
              <select
                value={draftDfv}
                onChange={(e) => setDraftDfv(e.target.value)}
                className="rounded-xl border border-[#E5E5EA] px-3 py-2 text-sm text-[#1D1D1F] focus:border-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#1D1D1F] bg-white"
              >
                {DFV_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </section>
          ) : (
            dfv && (
              <div className="flex flex-wrap gap-1.5 pt-4 border-t border-[#F5F5F7]">
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
                  style={{ backgroundColor: dfv.bg, color: dfv.text }}
                >
                  {dfv.label}
                </span>
              </div>
            )
          )}

          {/* Save footer */}
          {isEditing && (
            <div className="pt-2 border-t border-[#F5F5F7] flex items-center justify-between gap-3">
              <p className="text-[11px] text-[#86868B]">
                Saving will mark this flow as needing re-generation.
              </p>
              <button
                onClick={handleSave}
                disabled={isSaving || !draftStory.trim()}
                className="flex h-9 shrink-0 items-center rounded-full bg-[#1D1D1F] px-5 text-sm font-semibold text-white hover:bg-[#3D3D3F] disabled:opacity-50 transition-colors"
              >
                {isSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
