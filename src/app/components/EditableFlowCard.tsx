'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'

interface Props {
  flowId: string
  name: string
  description: string | null
  /** Bound server action: (name, description) => Promise<void> */
  onSave: (name: string, description: string | null) => Promise<void>
  children: React.ReactNode
}

export function EditableFlowCard({ flowId: _flowId, name, description, onSave, children }: Props) {
  const [editing, setEditing] = useState(false)
  const [nameVal, setNameVal] = useState(name)
  const [descVal, setDescVal] = useState(description ?? '')
  const [isPending, startTransition] = useTransition()
  const nameRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (editing) {
      setNameVal(name)
      setDescVal(description ?? '')
      nameRef.current?.focus()
      nameRef.current?.select()
    }
  }, [editing, name, description])

  function handleSave() {
    if (!nameVal.trim()) return
    startTransition(async () => {
      await onSave(nameVal.trim(), descVal.trim() || null)
      setEditing(false)
      router.refresh()
    })
  }

  function handleCancel() {
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="rounded-2xl bg-white shadow-sm p-6 space-y-3">
        <input
          ref={nameRef}
          value={nameVal}
          onChange={(e) => setNameVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel() }}
          className="text-base font-semibold text-foreground block w-full bg-transparent border-b-2 border-[#1D1D1F] outline-none pb-1 placeholder:text-foreground/30"
          placeholder="Flow name…"
        />
        <textarea
          value={descVal}
          onChange={(e) => setDescVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }}
          rows={2}
          placeholder="Description (optional)"
          className="block w-full text-sm text-foreground border border-[#d2d2d7] rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-[#1D1D1F] placeholder:text-foreground/30"
        />
        <div className="flex gap-2 pt-1">
          <Button
            onClick={handleSave}
            disabled={isPending || !nameVal.trim()}
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
    <div className="group rounded-2xl bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-4 p-6">
        <div className="min-w-0 flex-1">
          {children}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setEditing(true)}
            className="h-7 w-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-black/5"
            aria-label="Edit flow name and description"
          >
            <Pencil className="h-3.5 w-3.5 text-foreground/40" />
          </button>
        </div>
      </div>
    </div>
  )
}
