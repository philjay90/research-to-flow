'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { synthesiseInput } from '@/app/actions'

interface Props {
  inputId: string
  flowId: string
  projectId: string
  /** At least one requirement was generated from this input */
  isSynthesized: boolean
  /** Input was updated after its requirements were last generated */
  isModified: boolean
}

export function SynthesiseButton({ inputId, flowId, projectId, isSynthesized, isModified }: Props) {
  const [isPending, startTransition] = useTransition()
  const [showDialog, setShowDialog] = useState(false)
  const router = useRouter()

  function run(mode: 'append' | 'replace') {
    startTransition(async () => {
      await synthesiseInput(inputId, flowId, projectId, mode)
      router.refresh()
    })
  }

  function handleClick() {
    if (isModified) {
      setShowDialog(true)
    } else {
      run('append')
    }
  }

  // Already synthesized and unchanged — greyed out
  if (isSynthesized && !isModified) {
    return (
      <Button variant="outline" size="sm" disabled
        className="h-7 cursor-default text-xs opacity-40">
        Synthesised ✓
      </Button>
    )
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={isPending}
        className={`h-7 text-xs ${
          isModified
            ? 'border-[#CBA328] text-[#CBA328] hover:bg-[#CBA328]/10'
            : 'border-[#EE4266] text-[#EE4266] hover:bg-[#EE4266]/10'
        }`}
      >
        {isPending ? '…' : isModified ? 'Re-synthesise' : 'Synthesise'}
      </Button>

      {/* Re-synthesise dialog */}
      {showDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowDialog(false)}
        >
          <div
            className="w-80 rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 font-semibold text-foreground">Re-synthesise this input?</h3>
            <p className="mb-5 text-sm text-[#7286A0]">
              This input already has requirements generated from it. What would you like to do with the existing ones?
            </p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => { setShowDialog(false); run('replace') }}
                className="w-full bg-[#EE4266] text-white hover:bg-[#d63558]"
                size="sm"
              >
                Replace — delete old &amp; generate fresh
              </Button>
              <Button
                onClick={() => { setShowDialog(false); run('append') }}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Append — keep old &amp; add new
              </Button>
              <Button
                onClick={() => setShowDialog(false)}
                variant="ghost"
                size="sm"
                className="w-full text-[#7286A0]"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
