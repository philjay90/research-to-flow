'use client'

import { useState } from 'react'
import { rerunMockup } from '@/app/actions'
import { LoadingDots } from './LoadingDots'
import type { MockupStatus } from '@/types'

interface Props {
  projectId: string
  personaId: string
  currentStatus: MockupStatus
}

export function GenerateMockupButton({ projectId, personaId, currentStatus }: Props) {
  const [isPending, setIsPending] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const hasExisting = currentStatus === 'complete' || currentStatus === 'failed'

  async function run() {
    setConfirming(false)
    setIsPending(true)
    await rerunMockup(projectId, personaId)
    window.location.reload()
  }

  function handleClick() {
    if (hasExisting) {
      setConfirming(true)
    } else {
      run()
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-[#FFF8CC] border border-[#F0E100] px-4 py-2.5">
        <p className="text-xs text-[#1D1D1F] max-w-[220px]">
          Re-generating will replace the existing mockup.
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
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending || currentStatus === 'pending' || currentStatus === 'running'}
      className="flex h-9 items-center rounded-full bg-[#F0E100] px-5 text-sm font-semibold text-[#1D1D1F] hover:bg-[#d4c900] disabled:opacity-50 transition-colors min-w-[170px] justify-center"
    >
      {isPending || currentStatus === 'pending' || currentStatus === 'running'
        ? <LoadingDots />
        : hasExisting
          ? '↺ Re-generate Mockup'
          : '✦ Generate Mockup'}
    </button>
  )
}
