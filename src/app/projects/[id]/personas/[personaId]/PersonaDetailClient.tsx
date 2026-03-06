'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import type { Persona, Requirement, PersonaRequirement, PersonaFieldSource } from '@/types'
import { ProvenanceDot } from '@/app/components/ProvenanceDot'
import { LoadingDots } from '@/app/components/LoadingDots'
import { updatePersona, linkPersonaRequirement, unlinkPersonaRequirement } from '@/app/actions'

// ---------------------------------------------------------------------------
// Field definitions
// ---------------------------------------------------------------------------

type PersonaField = 'name' | 'role_title' | 'background' | 'tools' | 'macro_goals' | 'tasks_activities' | 'pain_points'

const FIELD_META: { key: PersonaField; label: string; multiline: boolean }[] = [
  { key: 'name',             label: 'Name',             multiline: false },
  { key: 'role_title',       label: 'Role / Title',     multiline: false },
  { key: 'background',       label: 'Background',       multiline: true  },
  { key: 'tools',            label: 'Tools & Systems',  multiline: true  },
  { key: 'macro_goals',      label: 'Goals',            multiline: true  },
  { key: 'tasks_activities', label: 'Tasks & Activities', multiline: true },
  { key: 'pain_points',      label: 'Pain Points',      multiline: true  },
]

// ---------------------------------------------------------------------------
// Inline editable field
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
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ProvenanceDot source={source} />
          <span className="text-xs font-semibold text-[#86868B] uppercase tracking-wide">{label}</span>
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
              className="block w-full rounded-xl border border-[#D2D2D7] px-3 py-2 text-sm text-[#1D1D1F] resize-none focus:border-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#1D1D1F]"
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
              className="block w-full rounded-xl border border-[#D2D2D7] px-3 py-2 text-sm text-[#1D1D1F] focus:border-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#1D1D1F]"
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
      ) : (
        <p className="text-sm text-[#1D1D1F] leading-relaxed whitespace-pre-wrap">{value}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Requirement link row
// ---------------------------------------------------------------------------

function RequirementLinkRow({
  requirement,
  linked,
  linkSource,
  onToggle,
}: {
  requirement: Requirement
  linked: boolean
  linkSource?: 'llm' | 'manual'
  onToggle: () => Promise<void>
}) {
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => { await onToggle() })
  }

  return (
    <div className="flex items-start gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
      <div className="flex-1 min-w-0">
        <p className="text-sm italic text-[#1D1D1F] leading-snug line-clamp-2">{requirement.user_story}</p>
        {linkSource && (
          <p className="mt-1 text-xs text-[#86868B]">
            Linked by {linkSource === 'llm' ? 'AI' : 'you'}
          </p>
        )}
      </div>
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`shrink-0 flex h-7 items-center rounded-full px-3 text-xs font-medium transition-colors disabled:opacity-50 ${
          linked
            ? 'border border-[#D2D2D7] text-[#86868B] hover:border-red-300 hover:text-red-500 hover:bg-red-50'
            : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#1D1D1F] hover:text-white'
        }`}
      >
        {isPending ? <LoadingDots /> : linked ? 'Unlink' : 'Link'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

interface PersonaDetailClientProps {
  persona: Persona
  projectId: string
  linkedRequirements: (Requirement & { link_source: 'llm' | 'manual' })[]
  allRequirements: Requirement[]
}

export function PersonaDetailClient({
  persona,
  projectId,
  linkedRequirements,
  allRequirements,
}: PersonaDetailClientProps) {
  const router = useRouter()
  const provenance = persona.field_provenance ?? {}
  const linkedIds = new Set(linkedRequirements.map((r) => r.id))
  const unlinkedRequirements = allRequirements.filter((r) => !linkedIds.has(r.id))

  async function handleFieldSave(field: PersonaField, value: string) {
    await updatePersona(personaId, projectId, { [field]: value }, [field])
    router.refresh()
  }

  const personaId = persona.id

  return (
    <div className="space-y-10">
      {/* Persona fields */}
      <section className="space-y-4">
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
        <h2 className="mb-4 text-xl font-semibold tracking-tight text-[#1D1D1F]">
          Linked Requirements
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
                onToggle={async () => {
                  await unlinkPersonaRequirement(personaId, req.id, projectId)
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
                  onToggle={async () => {
                    await linkPersonaRequirement(personaId, req.id, projectId)
                    router.refresh()
                  }}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
