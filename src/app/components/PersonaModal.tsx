'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, Pencil } from 'lucide-react'
import type { Persona, Requirement, PersonaFieldSource } from '@/types'
import { ProvenanceDot } from '@/app/components/ProvenanceDot'
import { LoadingDots } from '@/app/components/LoadingDots'
import { HelpTooltip } from '@/app/components/HelpTooltip'
import {
  updatePersona,
  linkPersonaRequirement,
  unlinkPersonaRequirement,
} from '@/app/actions'

// ---------------------------------------------------------------------------
// Field definitions (mirrors PersonaDetailClient)
// ---------------------------------------------------------------------------

type PersonaField =
  | 'name'
  | 'role_title'
  | 'background'
  | 'tools'
  | 'macro_goals'
  | 'tasks_activities'
  | 'pain_points'

const FIELD_META: { key: PersonaField; label: string; multiline: boolean }[] = [
  { key: 'name',             label: 'Name',              multiline: false },
  { key: 'role_title',       label: 'Role / Title',      multiline: false },
  { key: 'background',       label: 'Background',        multiline: true  },
  { key: 'tools',            label: 'Tools & Systems',   multiline: true  },
  { key: 'macro_goals',      label: 'Goals',             multiline: true  },
  { key: 'tasks_activities', label: 'Tasks & Activities',multiline: true  },
  { key: 'pain_points',      label: 'Pain Points',       multiline: true  },
]

// ---------------------------------------------------------------------------
// EditableField
// ---------------------------------------------------------------------------

function EditableField({
  label,
  value,
  source,
  multiline,
  onSave,
}: {
  label: string
  value: string
  source: PersonaFieldSource
  multiline: boolean
  onSave: (val: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [isPending, startTransition] = useTransition()

  // Keep draft in sync when parent re-fetches (router.refresh)
  useEffect(() => { setDraft(value) }, [value])

  function handleEdit() {
    setDraft(value)
    setEditing(true)
  }

  function handleSave() {
    if (!draft.trim()) return
    startTransition(async () => {
      await onSave(draft.trim())
      setEditing(false)
    })
  }

  function handleCancel() {
    setDraft(value)
    setEditing(false)
  }

  return (
    <div className="rounded-2xl bg-[#F5F5F7] p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ProvenanceDot source={source} />
          <span className="text-xs font-semibold text-[#86868B] uppercase tracking-wide">
            {label}
          </span>
        </div>
        {!editing && (
          <button
            onClick={handleEdit}
            className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-black/5 text-[#86868B] hover:text-[#1D1D1F] transition-colors"
            aria-label={`Edit ${label}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          {multiline ? (
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }}
              rows={4}
              className="block w-full rounded-xl border border-[#D2D2D7] bg-white px-3 py-2 text-sm text-[#1D1D1F] resize-none focus:border-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#1D1D1F]"
            />
          ) : (
            <input
              autoFocus
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') handleCancel()
                if (e.key === 'Enter') handleSave()
              }}
              className="block w-full rounded-xl border border-[#D2D2D7] bg-white px-3 py-2 text-sm text-[#1D1D1F] focus:border-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#1D1D1F]"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isPending || !draft.trim()}
              className="flex h-7 items-center rounded-full bg-[#F0E100] px-4 text-xs font-semibold text-[#1D1D1F] hover:bg-[#d4c900] disabled:opacity-50 transition-colors min-w-[52px] justify-center"
            >
              {isPending ? <LoadingDots /> : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              className="flex h-7 items-center rounded-full px-4 text-xs font-medium text-[#86868B] hover:text-[#1D1D1F] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : multiline ? (
        <ul className="space-y-1.5">
          {value
            .split('\n')
            .filter((line) => line.trim())
            .map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[#1D1D1F] leading-relaxed">
                <span className="mt-[1px] flex-shrink-0 text-[#1D1D1F]/40">–</span>
                <span>{line.replace(/^[-•*]\s*/, '')}</span>
              </li>
            ))}
        </ul>
      ) : (
        <p className="text-sm text-[#1D1D1F] leading-relaxed">{value}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// RequirementLinkRow
// ---------------------------------------------------------------------------

function RequirementLinkRow({
  requirement,
  linked,
  linkSource,
  hasAnyPersona,
  onToggle,
}: {
  requirement: Requirement
  linked: boolean
  linkSource?: 'llm' | 'manual'
  hasAnyPersona: boolean
  onToggle: () => Promise<void>
}) {
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => { await onToggle() })
  }

  return (
    <div className="flex items-start gap-3 rounded-xl bg-[#F5F5F7] px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm italic text-[#1D1D1F] leading-snug line-clamp-2">
          {requirement.user_story}
        </p>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          {linkSource && (
            <p className="text-xs text-[#86868B]">
              Linked by {linkSource === 'llm' ? 'AI' : 'you'}
            </p>
          )}
          {!linked && !hasAnyPersona && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: '#EBEBED', color: '#86868B' }}
            >
              No persona assigned
            </span>
          )}
        </div>
      </div>
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`shrink-0 flex h-7 items-center rounded-full px-3 text-xs font-medium transition-colors disabled:opacity-50 ${
          linked
            ? 'border border-[#D2D2D7] text-[#86868B] hover:border-red-300 hover:text-red-500 hover:bg-red-50'
            : 'bg-white border border-[#D2D2D7] text-[#1D1D1F] hover:bg-[#1D1D1F] hover:text-white hover:border-[#1D1D1F]'
        }`}
      >
        {isPending ? <LoadingDots /> : linked ? 'Unlink' : 'Link'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PersonaModal (right-side drawer)
// ---------------------------------------------------------------------------

interface PersonaModalProps {
  persona: Persona
  projectId: string
  allRequirements: Requirement[]
  personaReqLinks: { persona_id: string; requirement_id: string; link_source?: 'llm' | 'manual' }[]
  onClose: () => void
}

export function PersonaModal({
  persona,
  projectId,
  allRequirements,
  personaReqLinks,
  onClose,
}: PersonaModalProps) {
  const router = useRouter()
  const panelRef = useRef<HTMLDivElement>(null)

  const provenance = persona.field_provenance ?? {}

  // Compute linked / unlinked requirements for this persona
  const thisPersonaLinks = personaReqLinks.filter(
    (l) => l.persona_id === persona.id
  )
  const linkedIds = new Set(thisPersonaLinks.map((l) => l.requirement_id))
  const requirementIdsWithAnyPersona = new Set(personaReqLinks.map((l) => l.requirement_id))

  const linkedRequirements = allRequirements
    .filter((r) => linkedIds.has(r.id))
    .map((r) => ({
      ...r,
      link_source: (thisPersonaLinks.find((l) => l.requirement_id === r.id)?.link_source ?? 'manual') as 'llm' | 'manual',
    }))
  const unlinkedRequirements = allRequirements.filter((r) => !linkedIds.has(r.id))

  async function handleFieldSave(field: PersonaField, value: string) {
    await updatePersona(persona.id, projectId, { [field]: value }, [field])
    router.refresh()
  }

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel — slides in from the right */}
      <div
        ref={panelRef}
        className="relative ml-auto flex h-full w-full max-w-[560px] flex-col bg-white shadow-2xl animate-slide-in-right"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E5EA] px-6 py-4">
          <div>
            <p className="font-semibold text-[#1D1D1F] text-lg leading-tight">{persona.name}</p>
            {persona.role_title && (
              <p className="text-sm text-[#86868B] mt-0.5">{persona.role_title}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-black/5 text-[#86868B] hover:text-[#1D1D1F] transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-10">
          {/* Persona fields */}
          <section className="space-y-3">
            {FIELD_META.map(({ key, label, multiline }) => (
              <EditableField
                key={key}
                label={label}
                value={persona[key] ?? ''}
                source={(provenance[key]?.source ?? 'llm_inferred') as PersonaFieldSource}
                multiline={multiline}
                onSave={(val) => handleFieldSave(key, val)}
              />
            ))}
          </section>

          {/* Linked requirements */}
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold tracking-tight text-[#1D1D1F]">
              Linked Requirements
              <HelpTooltip
                text="User requirements associated with this persona. Link or unlink them to adjust which requirements appear in this persona's user flow."
                position="right"
              />
            </h2>

            {linkedRequirements.length === 0 && unlinkedRequirements.length === 0 && (
              <p className="text-sm text-[#86868B]">No requirements in this project yet.</p>
            )}

            {linkedRequirements.length > 0 && (
              <div className="space-y-2 mb-6">
                {linkedRequirements.map((req) => (
                  <RequirementLinkRow
                    key={req.id}
                    requirement={req}
                    linked
                    linkSource={req.link_source}
                    hasAnyPersona={requirementIdsWithAnyPersona.has(req.id)}
                    onToggle={async () => {
                      await unlinkPersonaRequirement(persona.id, req.id, projectId)
                      router.refresh()
                    }}
                  />
                ))}
              </div>
            )}

            {unlinkedRequirements.length > 0 && (
              <>
                <p className="mb-3 text-sm font-medium text-[#86868B]">Other requirements</p>
                <div className="space-y-2">
                  {unlinkedRequirements.map((req) => (
                    <RequirementLinkRow
                      key={req.id}
                      requirement={req}
                      linked={false}
                      hasAnyPersona={requirementIdsWithAnyPersona.has(req.id)}
                      onToggle={async () => {
                        await linkPersonaRequirement(persona.id, req.id, projectId)
                        router.refresh()
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
