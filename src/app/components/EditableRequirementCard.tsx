'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DeleteButton } from '@/app/components/DeleteButton'
import { updateRequirement } from '@/app/actions'

const DFV_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'desirability', label: 'Desirability' },
  { value: 'feasibility', label: 'Feasibility' },
  { value: 'viability', label: 'Viability' },
]

const DFV_LABELS: Record<string, string> = {
  desirability: 'Desirability',
  feasibility: 'Feasibility',
  viability: 'Viability',
}

function statusStyle(status: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    active:     { backgroundColor: '#F0E100', color: '#1D1D1F' },
    draft:      { backgroundColor: '#F5F5F7', color: '#1D1D1F' },
    stale:      { backgroundColor: '#C97D60', color: '#ffffff' },
    unanchored: { backgroundColor: '#FAF0EB', color: '#C97D60' },
    edited:     { backgroundColor: '#1D1D1F', color: '#F0E100' },
  }
  return map[status] ?? { backgroundColor: '#F5F5F7', color: '#1D1D1F' }
}

interface Props {
  requirementId: string
  flowId: string
  projectId: string
  userStory: string
  businessOpportunity: string
  acceptanceCriteria: string[]
  dfvTag: string | null
  status: string
  sourceLabels: string[]
  onDelete: () => Promise<void>
}

export function EditableRequirementCard({
  requirementId,
  flowId,
  projectId,
  userStory,
  businessOpportunity,
  acceptanceCriteria,
  dfvTag,
  status,
  sourceLabels,
  onDelete,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [storyVal, setStoryVal] = useState(userStory)
  const [oppVal, setOppVal] = useState(businessOpportunity)
  const [criteriaVal, setCriteriaVal] = useState<string[]>(acceptanceCriteria)
  const [dfvVal, setDfvVal] = useState(dfvTag ?? '')
  const [isPending, startTransition] = useTransition()
  const storyRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (editing) {
      setStoryVal(userStory)
      setOppVal(businessOpportunity)
      setCriteriaVal(acceptanceCriteria.length > 0 ? acceptanceCriteria : [''])
      setDfvVal(dfvTag ?? '')
      setTimeout(() => storyRef.current?.focus(), 0)
    }
  }, [editing, userStory, businessOpportunity, acceptanceCriteria, dfvTag])

  function handleSave() {
    if (!storyVal.trim()) return
    startTransition(async () => {
      await updateRequirement(requirementId, flowId, projectId, {
        user_story: storyVal,
        business_opportunity: oppVal,
        acceptance_criteria: criteriaVal.filter((c) => c.trim()),
        dfv_tag: dfvVal || null,
      })
      setEditing(false)
      router.refresh()
    })
  }

  function handleCancel() {
    setEditing(false)
  }

  function addCriterion() {
    setCriteriaVal((prev) => [...prev, ''])
  }

  function removeCriterion(index: number) {
    setCriteriaVal((prev) => prev.filter((_, i) => i !== index))
  }

  function updateCriterion(index: number, value: string) {
    setCriteriaVal((prev) => prev.map((c, i) => (i === index ? value : c)))
  }

  if (editing) {
    return (
      <div className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
        {/* User story */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">User Story</label>
          <textarea
            ref={storyRef}
            value={storyVal}
            onChange={(e) => setStoryVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }}
            rows={3}
            placeholder="As a [user], I want to [action] so that [outcome]"
            className="block w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground italic resize-none focus:border-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#1D1D1F]"
          />
        </div>

        {/* DFV tag */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">DFV Tag</label>
          <select
            value={dfvVal}
            onChange={(e) => setDfvVal(e.target.value)}
            className="block w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#1D1D1F]"
          >
            {DFV_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Business opportunity */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">Business Opportunity</label>
          <textarea
            value={oppVal}
            onChange={(e) => setOppVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }}
            rows={2}
            className="block w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground resize-none focus:border-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#1D1D1F]"
          />
        </div>

        {/* Acceptance criteria */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Acceptance Criteria</label>
          <div className="space-y-2">
            {criteriaVal.map((criterion, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-2 text-xs text-foreground/40 shrink-0">✓</span>
                <input
                  type="text"
                  value={criterion}
                  onChange={(e) => updateCriterion(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') handleCancel()
                    if (e.key === 'Enter') { e.preventDefault(); addCriterion() }
                  }}
                  placeholder="Acceptance criterion…"
                  className="flex-1 rounded-xl border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:border-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#1D1D1F]"
                />
                {criteriaVal.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCriterion(i)}
                    className="mt-1.5 p-1 rounded-full text-foreground/40 hover:text-red-500 hover:bg-red-50 transition-colors"
                    aria-label="Remove criterion"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addCriterion}
            className="mt-1 flex items-center gap-1 text-xs text-foreground/40 hover:text-foreground/70 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add criterion
          </button>
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            onClick={handleSave}
            disabled={isPending || !storyVal.trim()}
            className="bg-[#F0E100] text-[#1D1D1F] hover:bg-[#d4c900] rounded-full px-4 font-semibold h-7 text-xs"
          >
            {isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button
            onClick={handleCancel}
            variant="ghost"
            className="rounded-full text-foreground h-7 text-xs"
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      {/* Source attribution */}
      {sourceLabels.length > 0 && (
        <p className="mb-3 text-xs text-foreground/60">
          From: {sourceLabels.join(', ')}
        </p>
      )}

      {/* User story + action buttons */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="text-sm italic text-foreground leading-snug flex-1">
          {userStory}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setEditing(true)}
            className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-black/5 text-[#86868B] hover:text-[#1D1D1F] transition-colors"
            aria-label="Edit requirement"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <DeleteButton
            action={onDelete}
            confirmMessage="Delete this requirement? If you have a generated canvas, it may no longer reflect all requirements — consider regenerating after deleting."
          />
        </div>
      </div>

      {/* Badges */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge style={statusStyle(status)} className="text-xs font-medium rounded-full">
          {status}
        </Badge>
        {dfvTag && (
          <Badge
            style={{ backgroundColor: '#C97D60', color: '#ffffff' }}
            className="text-xs font-medium rounded-full"
          >
            {DFV_LABELS[dfvTag] ?? dfvTag}
          </Badge>
        )}
      </div>

      <p className="mb-3 text-sm font-medium text-foreground">
        {businessOpportunity}
      </p>

      <ul className="space-y-1">
        {acceptanceCriteria.map((criterion, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-foreground">
            <span className="mt-0.5 text-foreground/40">✓</span>
            <span>{criterion}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
