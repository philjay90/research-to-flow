'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { addResearchInput } from '@/app/actions'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { LoadingDots } from '@/app/components/LoadingDots'

const INPUT_TYPE_LABELS: Record<string, string> = {
  interview_notes: 'Notes',
  transcript: 'Transcript',
  screenshot: 'Screenshot',
  business_requirements: 'Business Requirements',
  other: 'Other',
}

export function AddInputButton({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) setIsOpen(false)
    }
    if (isOpen) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, isPending])

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  function handleClose() {
    if (isPending) return
    setIsOpen(false)
    formRef.current?.reset()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formRef.current) return
    const formData = new FormData(formRef.current)
    startTransition(async () => {
      await addResearchInput(formData)
      setIsOpen(false)
      formRef.current?.reset()
      router.refresh()
    })
  }

  return (
    <>
      {/* Trigger button — matches the style of the other tab-bar action buttons */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex h-9 items-center gap-1.5 rounded-full bg-[#F0E100] px-5 text-sm font-semibold text-[#1D1D1F] hover:bg-[#d4c900] transition-colors"
      >
        + Add Input
      </button>

      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

          <div
            className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="p-6 space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-[#1D1D1F]">Add Research Input</h2>
                <button
                  onClick={handleClose}
                  disabled={isPending}
                  className="text-xl leading-none text-[#86868B] hover:text-[#1D1D1F] transition-colors disabled:opacity-40"
                >
                  ×
                </button>
              </div>

              <p className="text-sm text-[#86868B] leading-relaxed">
                Paste notes, a transcript, or describe a screenshot.
              </p>

              <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
                <input type="hidden" name="project_id" value={projectId} />

                <div className="space-y-1.5">
                  <Label htmlFor="ai-type" className="text-sm font-semibold text-[#1D1D1F]">
                    Type <span className="text-[#C97D60]">*</span>
                  </Label>
                  <select
                    id="ai-type"
                    name="type"
                    required
                    className="block w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#1D1D1F]"
                  >
                    <option value="">Select a type...</option>
                    {Object.entries(INPUT_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ai-source_label" className="text-sm font-semibold text-[#1D1D1F]">
                    Title / Source Label
                  </Label>
                  <Input
                    id="ai-source_label"
                    name="source_label"
                    type="text"
                    placeholder="e.g. Interview with Sarah"
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ai-content" className="text-sm font-semibold text-[#1D1D1F]">
                    Content <span className="text-[#C97D60]">*</span>
                  </Label>
                  <Textarea
                    id="ai-content"
                    name="content"
                    rows={5}
                    required
                    placeholder="Paste notes, transcript excerpt, or describe the screenshot..."
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ai-attachment" className="text-sm font-semibold text-[#1D1D1F]">
                    Attachment{' '}
                    <span className="font-normal text-[#86868B]">(optional)</span>
                  </Label>
                  <input
                    id="ai-attachment"
                    name="attachment"
                    type="file"
                    accept="image/*,.pdf"
                    className="block w-full text-sm text-foreground file:mr-3 file:rounded-full file:border-0 file:bg-[#1D1D1F] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-[#1D1D1F]/80"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isPending}
                    className="h-9 rounded-full border border-[#E5E5EA] px-5 text-sm font-medium text-[#86868B] hover:border-[#1D1D1F] hover:text-[#1D1D1F] transition-colors disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex h-9 items-center rounded-full bg-[#F0E100] px-5 text-sm font-semibold text-[#1D1D1F] hover:bg-[#d4c900] disabled:opacity-60 transition-colors"
                  >
                    {isPending ? <LoadingDots /> : 'Add Input'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
