'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Loader2, Copy, Check, RefreshCw } from 'lucide-react'
import { rerunMockup, dismissMockupDiff } from '@/app/actions'
import { LoadingDots } from './LoadingDots'
import type { MockupStatus } from '@/types'

interface Props {
  projectId: string
  personaId: string
  initialStatus: MockupStatus
  initialPendingDiff: boolean
  initialScreens: Record<string, unknown>[] | null
  initialPrototypeHtml: string | null
  initialFigmaJson: Record<string, unknown> | null
}

type MockupSubTab = 'preview' | 'screens' | 'figma'

export function MockupPanel({
  projectId,
  personaId,
  initialStatus,
  initialPendingDiff,
  initialScreens,
  initialPrototypeHtml,
  initialFigmaJson,
}: Props) {
  const [status, setStatus] = useState<MockupStatus>(initialStatus)
  const [pendingDiff, setPendingDiff] = useState(initialPendingDiff)
  const [screens, setScreens] = useState(initialScreens)
  const [prototypeHtml, setPrototypeHtml] = useState(initialPrototypeHtml)
  const [figmaJson, setFigmaJson] = useState(initialFigmaJson)
  const [subTab, setSubTab] = useState<MockupSubTab>('preview')
  const [copied, setCopied] = useState(false)
  const [isActing, setIsActing] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const startedAt = useState(() => Date.now())[0]

  // Trigger the long-lived API route whenever we see 'pending'
  // (the server action only sets the DB status; the actual agent runs here)
  const agentTriggeredRef = useRef(false)
  useEffect(() => {
    if (status !== 'pending' || agentTriggeredRef.current) return
    agentTriggeredRef.current = true
    fetch(`/api/projects/${projectId}/flows/${personaId}/mockup`, { method: 'POST' })
      .catch(console.error)
  }, [status, projectId, personaId])

  // Poll for status while pending/running
  const poll = useCallback(async () => {
    const res = await fetch(
      `/api/projects/${projectId}/flows/${personaId}/mockup-status`,
      { cache: 'no-store' }
    )
    if (!res.ok) return
    const data = await res.json()
    setStatus(data.mockup_status)
    setPendingDiff(data.mockup_pending_diff)
  }, [projectId, personaId])

  useEffect(() => {
    if (status !== 'pending' && status !== 'running') return
    const id = setInterval(poll, 3000)
    return () => clearInterval(id)
  }, [status, poll])

  // Elapsed timer while generating
  useEffect(() => {
    if (status !== 'pending' && status !== 'running') return
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => clearInterval(id)
  }, [status, startedAt])

  // When status becomes complete, reload the page to get the new data
  const prevStatus = useState(initialStatus)[0]
  useEffect(() => {
    if (prevStatus !== status && status === 'complete') {
      window.location.reload()
    }
  }, [status, prevStatus])

  async function handleRerun() {
    agentTriggeredRef.current = false  // Reset so the trigger effect fires again
    setIsActing(true)
    await rerunMockup(projectId, personaId)
    setStatus('pending')
    setPendingDiff(false)
    setIsActing(false)
  }

  async function handleDismissDiff() {
    setIsActing(true)
    await dismissMockupDiff(personaId)
    setPendingDiff(false)
    setIsActing(false)
  }

  function handleCopyFigma() {
    if (!figmaJson) return
    navigator.clipboard.writeText(JSON.stringify(figmaJson, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── States ─────────────────────────────────────────────────────────────────

  if (status === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 text-center shadow-sm">
        <p className="text-lg font-medium text-[#1D1D1F]">No mockup yet</p>
        <p className="mt-2 text-sm text-[#86868B] max-w-sm">
          Generate the canvas first — the mockup will be created automatically.
        </p>
      </div>
    )
  }

  if (status === 'pending' || status === 'running') {
    const mins = Math.floor(elapsed / 60)
    const secs = elapsed % 60
    const elapsedStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`

    const STEPS = ['Analysing design direction', 'Generating screen specs']
    const estimatedStep = Math.min(Math.floor(elapsed / 25), 1)

    // If still running after 90s, the server process was likely killed — offer retry
    const isStuck = elapsed > 90

    if (isStuck) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 text-center shadow-sm">
          <p className="text-lg font-medium text-[#1D1D1F]">Generation timed out</p>
          <p className="mt-2 text-sm text-[#86868B] max-w-sm">
            The server took too long to respond. This is usually a transient issue.
          </p>
          <button
            onClick={handleRerun}
            disabled={isActing}
            className="mt-6 flex h-9 items-center gap-2 rounded-full bg-[#F0E100] px-5 text-sm font-semibold text-[#1D1D1F] hover:bg-[#d4c900] disabled:opacity-50 transition-colors"
          >
            {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Try again
          </button>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-16 text-center shadow-sm">
        <Loader2 className="h-6 w-6 animate-spin text-[#86868B] mb-4" />
        <p className="text-sm font-semibold text-[#1D1D1F] mb-1">
          {status === 'pending' ? 'Queued — starting soon…' : 'Generating mockup'}
        </p>
        <p className="text-xs text-[#86868B] mb-6">
          {elapsed > 0 ? `Running for ${elapsedStr}` : 'This usually takes under a minute'}
        </p>

        {status === 'running' && (
          <ol className="space-y-2 text-left mb-6">
            {STEPS.map((step, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                {i < estimatedStep ? (
                  <span className="text-green-500 font-bold">✓</span>
                ) : i === estimatedStep ? (
                  <Loader2 className="h-3 w-3 animate-spin text-[#86868B] shrink-0" />
                ) : (
                  <span className="h-3 w-3 rounded-full border border-[#D2D2D7] shrink-0 inline-block" />
                )}
                <span className={i <= estimatedStep ? 'text-[#1D1D1F]' : 'text-[#86868B]'}>
                  {step}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 text-center shadow-sm">
        <p className="text-lg font-medium text-[#1D1D1F]">Mockup generation failed</p>
        <p className="mt-2 text-sm text-[#86868B]">Something went wrong. You can try again.</p>
        <button
          onClick={handleRerun}
          disabled={isActing}
          className="mt-6 flex h-9 items-center gap-2 rounded-full bg-[#F0E100] px-5 text-sm font-semibold text-[#1D1D1F] hover:bg-[#d4c900] disabled:opacity-50 transition-colors"
        >
          {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Retry
        </button>
      </div>
    )
  }

  // status === 'complete'
  return (
    <div className="space-y-4">
      {/* Diff banner */}
      {pendingDiff && (
        <div className="flex items-center gap-3 rounded-xl bg-[#FFF8CC] border border-[#F0E100] px-4 py-3">
          <p className="flex-1 text-sm text-[#1D1D1F]">
            The canvas was re-generated since this mockup was created. Update the mockup to reflect the new flow?
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRerun}
              disabled={isActing}
              className="flex h-8 items-center rounded-full bg-[#1D1D1F] px-4 text-xs font-semibold text-white hover:bg-black disabled:opacity-50 transition-colors"
            >
              {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Update Mockup'}
            </button>
            <button
              onClick={handleDismissDiff}
              disabled={isActing}
              className="text-xs text-[#86868B] hover:text-[#1D1D1F] transition-colors disabled:opacity-50"
            >
              Keep Current
            </button>
          </div>
        </div>
      )}

      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 border-b border-[#E5E5EA]">
        {(['preview', 'screens', 'figma'] as MockupSubTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`flex h-9 items-center px-4 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
              subTab === t
                ? 'border-[#1D1D1F] text-[#1D1D1F]'
                : 'border-transparent text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >
            {t === 'figma' ? 'Figma JSON' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}

        <div className="ml-auto pb-1">
          <button
            onClick={handleRerun}
            disabled={isActing || pendingDiff}
            className="flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/5 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Regenerate
          </button>
        </div>
      </div>

      {/* Preview */}
      {subTab === 'preview' && prototypeHtml && (
        <div className="rounded-2xl overflow-hidden border border-[#E5E5EA]" style={{ height: 'calc(100vh - 320px)' }}>
          <iframe
            srcDoc={prototypeHtml}
            className="w-full h-full"
            sandbox="allow-scripts"
            title="UI Prototype"
          />
        </div>
      )}
      {subTab === 'preview' && !prototypeHtml && (
        <div className="flex items-center justify-center rounded-2xl bg-white py-20 text-sm text-[#86868B] shadow-sm">
          No prototype available.
        </div>
      )}

      {/* Screens */}
      {subTab === 'screens' && screens && screens.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {screens.map((screen, i) => (
            <div key={i} className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
              <p className="text-sm font-semibold text-[#1D1D1F]">
                {String(screen.title ?? `Screen ${i + 1}`)}
              </p>
              {!!screen.layout && (
                <p className="text-xs text-[#86868B]">{String(screen.layout)}</p>
              )}
              {Array.isArray(screen.components) && screen.components.length > 0 && (
                <ul className="space-y-1">
                  {(screen.components as Record<string, unknown>[]).map((c, j) => (
                    <li key={j} className="flex items-start gap-1.5 text-xs text-[#1D1D1F]">
                      <span className="mt-0.5 text-[#86868B] shrink-0">·</span>
                      <span>
                        <span className="font-medium">{String(c.label ?? c.type ?? '')}</span>
                        {c.action ? ` — ${String(c.action)}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {!!screen.notes && (
                <p className="text-xs text-[#86868B] italic">{String(screen.notes)}</p>
              )}
            </div>
          ))}
        </div>
      )}
      {subTab === 'screens' && (!screens || screens.length === 0) && (
        <div className="flex items-center justify-center rounded-2xl bg-white py-20 text-sm text-[#86868B] shadow-sm">
          No screen specs available.
        </div>
      )}

      {/* Figma JSON */}
      {subTab === 'figma' && (
        <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5EA]">
            <p className="text-xs font-semibold text-[#86868B] uppercase tracking-wide">Figma JSON</p>
            <button
              onClick={handleCopyFigma}
              className="flex items-center gap-1.5 rounded-full px-3 h-7 text-xs text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/5 transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="overflow-auto p-4 text-xs text-[#1D1D1F] leading-relaxed" style={{ maxHeight: '60vh' }}>
            {figmaJson ? JSON.stringify(figmaJson, null, 2) : 'No Figma JSON available.'}
          </pre>
        </div>
      )}
    </div>
  )
}
