'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createEmptyPersona } from '@/app/actions'
import { LoadingDots } from './LoadingDots'

interface Props {
  projectId: string
}

export function AddFlowButton({ projectId }: Props) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  async function handleClick() {
    setIsPending(true)
    const result = await createEmptyPersona(projectId)
    if (result?.id) {
      router.push(`/projects/${projectId}/flows/${result.id}?tab=inputs`)
    } else {
      setIsPending(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="flex h-9 items-center gap-1.5 rounded-full bg-[#F0E100] px-5 text-sm font-semibold text-[#1D1D1F] hover:bg-[#d4c900] disabled:opacity-50 transition-colors min-w-[120px] justify-center"
    >
      {isPending ? <LoadingDots /> : '+ Add Flow'}
    </button>
  )
}
