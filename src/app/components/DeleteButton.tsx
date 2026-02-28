'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DeleteButtonProps {
  action: () => Promise<void>
  confirmMessage: string
  className?: string
}

export function DeleteButton({
  action,
  confirmMessage,
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
      size="icon"
      onClick={handleClick}
      disabled={isPending}
      className={className ?? 'h-7 w-7 text-[#7286A0] hover:text-red-500 hover:bg-red-50'}
      aria-label="Delete"
    >
      {isPending
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : <Trash2 className="h-3.5 w-3.5" />
      }
    </Button>
  )
}
