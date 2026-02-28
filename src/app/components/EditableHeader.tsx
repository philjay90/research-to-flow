'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'

interface Props {
  name: string
  description: string | null
  nameClassName?: string
  /** Bound server action: (name, description) => Promise<void> */
  onSave: (name: string, description: string | null) => Promise<void>
}

export function EditableHeader({
  name,
  description,
  nameClassName = 'text-3xl font-bold tracking-tight',
  onSave,
}: Props) {
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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') handleCancel()
  }

  if (editing) {
    return (
      <div className="mb-10 space-y-3">
        <input
          ref={nameRef}
          value={nameVal}
          onChange={(e) => setNameVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); handleKeyDown(e) }}
          className={`${nameClassName} text-foreground block w-full bg-transparent border-b-2 border-[#1D1D1F] outline-none pb-1 placeholder:text-foreground/30`}
          placeholder="Name…"
        />
        <textarea
          value={descVal}
          onChange={(e) => setDescVal(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="Description (optional)"
          className="block w-full text-base text-foreground border border-[#d2d2d7] rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-[#1D1D1F] placeholder:text-foreground/30"
        />
        <div className="flex gap-2 pt-1">
          <Button
            onClick={handleSave}
            disabled={isPending || !nameVal.trim()}
            className="bg-[#F0E100] text-[#1D1D1F] hover:bg-[#d4c900] rounded-full px-5 font-semibold h-8 text-sm"
          >
            {isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button
            onClick={handleCancel}
            variant="ghost"
            className="rounded-full text-foreground h-8 text-sm"
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="group mb-10 flex items-start gap-2">
      <div className="flex-1 min-w-0">
        <h1 className={`${nameClassName} text-foreground`}>{name}</h1>
        {description && (
          <p className="mt-3 text-base text-foreground leading-relaxed">{description}</p>
        )}
        {!description && (
          <button
            onClick={() => setEditing(true)}
            className="mt-2 text-xs text-foreground/40 hover:text-foreground/70 transition-colors"
          >
            + Add description
          </button>
        )}
      </div>
      <button
        onClick={() => setEditing(true)}
        className="mt-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-black/5"
        aria-label="Edit name and description"
      >
        <Pencil className="h-4 w-4 text-foreground/40" />
      </button>
    </div>
  )
}
