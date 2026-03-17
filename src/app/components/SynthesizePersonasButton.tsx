'use client'

import { useState } from 'react'
import { synthesizePersonas } from '@/app/actions'
import { LoadingDots } from './LoadingDots'

interface SynthesizePersonasButtonProps {
  projectId: string
}

export function SynthesizePersonasButton({ projectId }: SynthesizePersonasButtonProps) {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setIsPending(true)
    setError(null)
    const result = await synthesizePersonas(projectId)
    if (result?.error) {
      setError(result.error)
    }
    setIsPending(false)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="flex h-9 items-center rounded-full bg-[#F0E100] px-5 text-sm font-semibold text-[#1D1D1F] hover:bg-[#d4c900] disabled:opacity-50 transition-colors min-w-[160px] justify-center"
      >
        {isPending ? <LoadingDots /> : '✦ Synthesize Flows'}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
