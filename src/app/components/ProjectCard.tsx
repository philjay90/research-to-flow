'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Loader2 } from 'lucide-react'
import { updateProject, deleteProject } from '@/app/actions'

interface Props {
  id: string
  name: string
  description: string | null
  createdAt: string
}

export function ProjectCard({ id, name, description, createdAt }: Props) {
  const [editing, setEditing] = useState(false)
  const [nameVal, setNameVal] = useState(name)
  const [descVal, setDescVal] = useState(description ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [isSaving, startSave] = useTransition()
  const [isDeleting, startDelete] = useTransition()
  const nameRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (editing) {
      setNameVal(name)
      setDescVal(description ?? '')
      setConfirmingDelete(false)
      nameRef.current?.focus()
      nameRef.current?.select()
    }
  }, [editing, name, description])

  function handleSave() {
    if (!nameVal.trim()) return
    startSave(async () => {
      await updateProject(id, nameVal.trim(), descVal.trim() || null)
      setEditing(false)
      router.refresh()
    })
  }

  function handleDelete() {
    startDelete(async () => {
      await deleteProject(id)
      router.refresh()
    })
  }

  if (editing) {
    return (
      <div className="rounded-2xl bg-white shadow-sm p-6 space-y-3">
        <input
          ref={nameRef}
          value={nameVal}
          onChange={(e) => setNameVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') setEditing(false)
          }}
          className="text-base font-semibold text-foreground block w-full bg-transparent border-b-2 border-[#1D1D1F] outline-none pb-1 placeholder:text-foreground/30"
          placeholder="Project name…"
        />
        <textarea
          value={descVal}
          onChange={(e) => setDescVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false) }}
          rows={2}
          placeholder="Description (optional)"
          className="block w-full text-sm text-foreground border border-[#E5E5EA] rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-[#1D1D1F] placeholder:text-foreground/30"
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
    <div className="group rounded-2xl bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-4 p-6">
        <Link href={`/projects/${id}`} className="min-w-0 flex-1">
          <p className="font-semibold text-foreground text-base">{name}</p>
          {description && (
            <p className="mt-1 text-sm text-foreground leading-relaxed">{description}</p>
          )}
          <p className="mt-2 text-xs text-foreground/50">
            Created {new Date(createdAt).toLocaleDateString()}
          </p>
        </Link>

        <div className="flex items-center gap-1 shrink-0">
          {/* Edit button */}
          <button
            onClick={() => setEditing(true)}
            className="h-7 w-7 flex items-center justify-center rounded-full text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/5 transition-colors"
            aria-label="Edit project"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>

          {/* Delete with inline confirmation */}
          {confirmingDelete ? (
            <div className="flex items-center gap-2 ml-1 rounded-xl bg-red-50 px-3 py-1.5">
              <span className="text-xs text-red-600 whitespace-nowrap">Delete project?</span>
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
              aria-label="Delete project"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
