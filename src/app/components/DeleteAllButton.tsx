'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

interface Props {
  action: () => Promise<void>
  label: string
  confirmMessage: string
}

export function DeleteAllButton({ action, label, confirmMessage }: Props) {
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
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="mt-4 flex items-center gap-1.5 text-xs text-foreground/40 hover:text-red-500 transition-colors disabled:opacity-50"
    >
      {isPending ? (
        <><Loader2 className="h-3 w-3 animate-spin" /> Deleting…</>
      ) : label}
    </button>
  )
}
