'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Loader2 } from 'lucide-react'
import { deletePersona, updatePersona } from '@/app/actions'
import type { Persona } from '@/types'

interface Props {
  personas: Persona[]
  projectId: string
}

function FlowCard({ persona, projectId }: { persona: Persona; projectId: string }) {
  const [editing, setEditing] = useState(false)
  const [nameVal, setNameVal] = useState(persona.name)
  const [roleVal, setRoleVal] = useState(persona.role_title ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [isSaving, startSave] = useTransition()
  const [isDeleting, startDelete] = useTransition()
  const nameRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (editing) {
      setNameVal(persona.name)
      setRoleVal(persona.role_title ?? '')
      setConfirmingDelete(false)
      nameRef.current?.focus()
      nameRef.current?.select()
    }
  }, [editing, persona.name, persona.role_title])

  function handleSave() {
    if (!nameVal.trim()) return
    startSave(async () => {
      await updatePersona(persona.id, projectId, { name: nameVal.trim(), role_title: roleVal.trim() }, ['name', 'role_title'])
      setEditing(false)
      router.refresh()
    })
  }

  function handleDelete() {
    startDelete(async () => {
      await deletePersona(persona.id, projectId)
      router.refresh()
    })
  }

  if (editing) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm flex flex-col gap-3">
        <input
          ref={nameRef}
          value={nameVal}
          onChange={(e) => setNameVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') setEditing(false)
          }}
          placeholder="Flow name…"
          className="text-lg font-semibold text-[#1D1D1F] block w-full bg-transparent border-b-2 border-[#1D1D1F] outline-none pb-1 placeholder:text-[#1D1D1F]/30"
        />
        <input
          value={roleVal}
          onChange={(e) => setRoleVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') setEditing(false)
          }}
          placeholder="User group (optional)"
          className="text-sm text-[#1D1D1F] block w-full border border-[#E5E5EA] rounded-xl px-3 py-2 outline-none focus:border-[#1D1D1F] placeholder:text-[#1D1D1F]/30"
        />
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={isSaving || !nameVal.trim()}
            className="flex h-8 items-center rounded-full bg-[#F0E100] px-4 text-sm font-semibold text-[#1D1D1F] hover:bg-[#d4c900] disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="flex h-8 items-center rounded-full px-3 text-sm font-medium text-[#86868B] hover:text-[#1D1D1F] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
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

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="h-7 w-7 flex items-center justify-center rounded-full text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/5 transition-colors"
            aria-label="Edit flow"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>

          {confirmingDelete ? (
            <div className="flex items-center gap-2 ml-1 rounded-xl bg-red-50 px-3 py-1.5">
              <span className="text-xs text-red-600 whitespace-nowrap">Delete flow?</span>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex h-6 items-center rounded-full bg-red-600 px-2.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes'}
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="text-xs text-[#86868B] hover:text-[#1D1D1F] transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="h-7 w-7 flex items-center justify-center rounded-full text-[#86868B] hover:text-red-500 hover:bg-red-50 transition-colors"
              aria-label="Delete flow"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
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
  )
}

export function FlowsTabClient({ personas, projectId }: Props) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {personas.map((persona) => (
        <li key={persona.id}>
          <FlowCard persona={persona} projectId={projectId} />
        </li>
      ))}
    </ul>
  )
}
