'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SynthesiseButton } from '@/app/components/SynthesiseButton'
import { DeleteButton } from '@/app/components/DeleteButton'
import { updateResearchInput } from '@/app/actions'

const INPUT_TYPE_LABELS: Record<string, string> = {
  interview_notes: 'Interview Notes',
  transcript: 'Transcript',
  screenshot: 'Screenshot',
  business_requirements: 'Business Requirements',
  other: 'Other',
}

interface Props {
  inputId: string
  flowId: string
  projectId: string
  type: string
  sourceLabel: string | null
  content: string
  attachmentUrl: string | null
  isSynthesized: boolean
  isModified: boolean
  onDelete: () => Promise<void>
}

export function EditableInputCard({
  inputId,
  flowId,
  projectId,
  type,
  sourceLabel,
  content,
  attachmentUrl,
  isSynthesized,
  isModified,
  onDelete,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [typeVal, setTypeVal] = useState(type)
  const [labelVal, setLabelVal] = useState(sourceLabel ?? '')
  const [contentVal, setContentVal] = useState(content)
  const [isPending, startTransition] = useTransition()
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (editing) {
      setTypeVal(type)
      setLabelVal(sourceLabel ?? '')
      setContentVal(content)
      setTimeout(() => contentRef.current?.focus(), 0)
    }
  }, [editing, type, sourceLabel, content])

  function handleSave() {
    if (!contentVal.trim()) return
    startTransition(async () => {
      await updateResearchInput(inputId, flowId, projectId, {
        type: typeVal,
        source_label: labelVal || null,
        content: contentVal,
      })
      setEditing(false)
      router.refresh()
    })
  }

  function handleCancel() {
    setEditing(false)
  }

  const displayLabel = sourceLabel || INPUT_TYPE_LABELS[type] || type

  if (editing) {
    return (
      <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
        {/* Type select */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">Type</label>
          <select
            value={typeVal}
            onChange={(e) => setTypeVal(e.target.value)}
            className="block w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#1D1D1F]"
          >
            {Object.entries(INPUT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Source label */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">Title / Source Label</label>
          <input
            type="text"
            value={labelVal}
            onChange={(e) => setLabelVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }}
            placeholder="e.g. Interview with Sarah"
            className="block w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#1D1D1F]"
          />
        </div>

        {/* Content */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">Content</label>
          <textarea
            ref={contentRef}
            value={contentVal}
            onChange={(e) => setContentVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }}
            rows={5}
            className="block w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground resize-none focus:border-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#1D1D1F]"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            onClick={handleSave}
            disabled={isPending || !contentVal.trim()}
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
      {/* Header row */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground leading-snug">
          {displayLabel}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <SynthesiseButton
            inputId={inputId}
            flowId={flowId}
            projectId={projectId}
            isSynthesized={isSynthesized}
            isModified={isModified}
          />
          <button
            onClick={() => setEditing(true)}
            className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-black/5 text-[#86868B] hover:text-[#1D1D1F] transition-colors"
            aria-label="Edit input"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <DeleteButton
            action={onDelete}
            confirmMessage="Delete this research input? Associated requirements will not be deleted automatically."
          />
        </div>
      </div>

      {/* Type badge */}
      <Badge
        style={{ backgroundColor: '#1D1D1F', color: '#fff' }}
        className="mb-3 text-xs rounded-full"
      >
        {INPUT_TYPE_LABELS[type] ?? type}
      </Badge>

      <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
        {content}
      </p>
      {attachmentUrl && (
        <img
          src={attachmentUrl}
          alt="Attached screenshot"
          className="mt-3 max-h-48 rounded-xl border object-contain"
        />
      )}
    </div>
  )
}
