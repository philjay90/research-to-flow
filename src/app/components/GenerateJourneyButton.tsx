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
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
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
