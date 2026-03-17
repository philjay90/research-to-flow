'use client'

import { useState } from 'react'
import { inferJourney } from '@/app/actions'
import { LoadingDots } from './LoadingDots'

interface GenerateJourneyButtonProps {
  projectId: string
  hasStages: boolean
}

export function GenerateJourneyButton({ projectId, hasStages }: GenerateJourneyButtonProps) {
  const [isPending, setIsPending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setConfirming(false)
    setIsPending(true)
    setError(null)
    const result = await inferJourney(projectId)
    if (result?.error) {
      setError(result.error)
      setIsPending(false)
    } else {
      window.location.reload()
    }
  }

  function handleClick() {
    if (hasStages) {
      setConfirming(true)
    } else {
      run()
    }
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-3 rounded-xl bg-[#FFF8CC] border border-[#F0E100] px-4 py-2.5">
          <p className="text-xs text-[#1D1D1F] max-w-[240px]">
            Re-generating will recalculate all journey stages. Any manual card placements will be reset.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={run}
              className="flex h-8 items-center rounded-full bg-[#1D1D1F] px-4 text-xs font-semibold text-white hover:bg-black transition-colors"
            >
              Re-generate
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="flex h-8 items-center rounded-full px-3 text-xs font-medium text-[#86868B] hover:text-[#1D1D1F] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="flex h-9 items-center rounded-full bg-[#F0E100] px-5 text-sm font-semibold text-[#1D1D1F] hover:bg-[#d4c900] disabled:opacity-50 transition-colors min-w-[180px] justify-center"
      >
        {isPending ? <LoadingDots /> : hasStages ? '↺ Re-generate Journey' : '✦ Generate Journey'}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
