'use client'

import { useState, useEffect } from 'react'
import { synthesizeFlow } from '@/app/actions'
import { LoadingDots } from './LoadingDots'

interface Props {
  projectId: string
  personaId: string
}

export function RegeneratePersonaButton({ projectId, personaId }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [overwrite, setOverwrite] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  async function handleRegenerate() {
    setIsPending(true)
    setError(null)
    const result = await synthesizeFlow(projectId, personaId, overwrite)
    if (result?.error) {
      setError(result.error)
      setIsPending(false)
    } else {
      setIsOpen(false)
      window.location.reload()
    }
  }

  return (
    <>
      <button
        onClick={() => { setIsOpen(true); setOverwrite(false); setError(null) }}
        className="flex h-9 items-center rounded-full bg-[#F0E100] px-5 text-sm font-semibold text-[#1D1D1F] hover:bg-[#d4c900] disabled:opacity-50 transition-colors min-w-[160px] justify-center"
      >
        ↺ Re-generate
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => { if (!isPending) setIsOpen(false) }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

          <div
            className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="p-6 space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-[#1D1D1F]">Re-generate Persona</h2>
                <button
                  onClick={() => { if (!isPending) setIsOpen(false) }}
                  disabled={isPending}
                  className="text-xl leading-none text-[#86868B] hover:text-[#1D1D1F] transition-colors disabled:opacity-40"
                >
                  ×
                </button>
              </div>

              <p className="text-sm text-[#86868B] leading-relaxed">
                The persona will be re-synthesised from this flow&apos;s inputs. How should manually edited fields be handled?
              </p>

              {/* Options */}
              <div className="space-y-2">
                {[
                  {
                    value: false,
                    label: 'Keep manual edits',
                    description: 'Fields you edited by hand will not be overwritten.',
                  },
                  {
                    value: true,
                    label: 'Overwrite all fields',
                    description: 'Every field, including manually edited ones, will be replaced.',
                  },
                ].map((option) => (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => setOverwrite(option.value)}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                      overwrite === option.value
                        ? 'border-[#1D1D1F] bg-[#F5F5F7]'
                        : 'border-[#E5E5EA] hover:border-[#C7C7CC]'
                    }`}
                  >
                    <p className="text-sm font-medium text-[#1D1D1F]">{option.label}</p>
                    <p className="mt-0.5 text-xs text-[#86868B]">{option.description}</p>
                  </button>
                ))}
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isPending}
                  className="h-9 rounded-full border border-[#E5E5EA] px-5 text-sm font-medium text-[#86868B] hover:border-[#1D1D1F] hover:text-[#1D1D1F] transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={isPending}
                  className="flex h-9 items-center rounded-full bg-[#F0E100] px-5 text-sm font-semibold text-[#1D1D1F] hover:bg-[#d4c900] disabled:opacity-60 transition-colors min-w-[120px] justify-center"
                >
                  {isPending ? <LoadingDots /> : 'Re-generate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
