'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface DeleteButtonProps {
  action: () => Promise<void>
  confirmMessage: string
  label?: string
  className?: string
}

export function DeleteButton({
  action,
  confirmMessage,
  label = 'Delete',
  className,
}: DeleteButtonProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleClick() {
    if (!window.confirm(confirmMessage)) return
    startTransition(async () => {
      await action()
      router.refresh()
    })
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      className={className ?? 'h-7 text-xs text-[#7286A0] hover:text-red-500 hover:bg-red-50'}
    >
      {isPending ? '…' : label}
    </Button>
  )
}
