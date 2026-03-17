'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  name: string
  description: string | null
  onSave: (name: string, description: string | null) => Promise<void>
  showRefreshResearch?: boolean
  onRefreshResearch?: () => Promise<{ error?: string }>
}

export function ProjectEditableHeader({
  name,
  description,
  onSave,
  showRefreshResearch = false,
  onRefreshResearch,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [nameVal, setNameVal] = useState(name)
  const [descVal, setDescVal] = useState(description ?? '')
  const [adjustResearch, setAdjustResearch] = useState(false)
  const [isPending, startTransition] = useTransition()
  const nameRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (editing) {
      setNameVal(name)
      setDescVal(description ?? '')
      setAdjustResearch(false)
      nameRef.current?.focus()
      nameRef.current?.select()
    }
  }, [editing, name, description])

  function handleSave() {
    if (!nameVal.trim()) return
    startTransition(async () => {
      await onSave(nameVal.trim(), descVal.trim() || null)
      if (adjustResearch && onRefreshResearch) {
        await onRefreshResearch()
      }
      setEditing(false)
      router.refresh()
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') setEditing(false)
  }

  if (editing) {
    return (
      <div className="mb-8 space-y-3">
        <input
          ref={nameRef}
          value={nameVal}
          onChange={(e) => setNameVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); handleKeyDown(e) }}
          className="text-xl font-semibold text-[#1D1D1F] block w-full bg-transparent border-b-2 border-[#1D1D1F] outline-none pb-1 placeholder:text-[#1D1D1F]/30"
          placeholder="Project name…"
        />
        <textarea
          value={descVal}
          onChange={(e) => setDescVal(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="Description (optional)"
          className="block w-full text-sm text-[#1D1D1F] border border-[#E5E5EA] rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-[#1D1D1F] placeholder:text-[#1D1D1F]/30"
        />
        {showRefreshResearch && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={adjustResearch}
              onChange={(e) => setAdjustResearch(e.target.checked)}
              className="h-4 w-4 rounded border-[#d2d2d7] accent-[#1D1D1F]"
            />
            <span className="text-sm text-[#1D1D1F]">Adjust research to updated project details</span>
          </label>
        )}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={isPending || !nameVal.trim()}
            className="flex h-9 items-center rounded-full bg-[#F0E100] px-5 text-sm font-semibold text-[#1D1D1F] hover:bg-[#d4c900] disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="flex h-9 items-center rounded-full px-4 text-sm font-medium text-[#86868B] hover:text-[#1D1D1F] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group mb-8 flex items-start gap-2">
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-semibold text-[#1D1D1F]">{name}</h1>
        {description ? (
          <p className="mt-1 text-sm text-[#86868B] leading-relaxed">{description}</p>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="mt-1 text-xs text-[#86868B]/60 hover:text-[#86868B] transition-colors"
          >
            + Add description
          </button>
        )}
      </div>
      <button
        onClick={() => setEditing(true)}
        className="mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-black/5"
        aria-label="Edit project name and description"
      >
        <svg className="h-4 w-4 text-[#86868B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
        </svg>
      </button>
    </div>
  )
}
