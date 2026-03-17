'use client'

import { useState, useEffect, useCallback } from 'react'
import { rerunUxResearch } from '@/app/actions'
import { LoadingDots } from './LoadingDots'
import type { UxResearchBrief, ResearchStatus } from '@/types'

interface Props {
  projectId: string
  initialBrief: UxResearchBrief | null
  initialStatus: ResearchStatus
}

const STATUS_LABELS: Record<ResearchStatus, string> = {
  idle: 'Not run',
  pending: 'Queued…',
  running: 'Researching…',
  complete: 'Complete',
  failed: 'Failed',
}

const STATUS_COLORS: Record<ResearchStatus, string> = {
  idle: 'bg-[#E5E5EA] text-[#86868B]',
  pending: 'bg-[#F0E100] text-[#1D1D1F]',
  running: 'bg-[#F0E100] text-[#1D1D1F]',
  complete: 'bg-[#D1FAE5] text-[#065F46]',
  failed: 'bg-[#FEE2E2] text-[#991B1B]',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">{title}</h3>
      {children}
    </div>
  )
}

function Tag({ text }: { text: string }) {
  return (
    <span className="inline-block rounded-full bg-[#F5F5F7] px-3 py-1 text-xs text-[#1D1D1F]">
      {text}
    </span>
  )
}

function ArchetypeCard({ archetype }: { archetype: UxResearchBrief['user_archetypes'][number] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-[#E5E5EA] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#F5F5F7] transition-colors"
      >
        <p className="text-sm font-medium text-[#1D1D1F]">{archetype.name}</p>
        <span className="text-[#86868B] text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-[#E5E5EA]">
          <p className="text-sm text-[#1D1D1F] leading-relaxed pt-3">{archetype.description}</p>
          <div>
            <p className="text-xs font-semibold text-[#86868B] mb-1.5">Goals</p>
            <div className="flex flex-wrap gap-1.5">
              {archetype.primary_goals.map((g) => <Tag key={g} text={g} />)}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#86868B] mb-1.5">Pain Points</p>
            <div className="flex flex-wrap gap-1.5">
              {archetype.typical_pain_points.map((p) => <Tag key={p} text={p} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CompetitorCard({ competitor }: { competitor: UxResearchBrief['competitive_landscape'][number] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-[#E5E5EA] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#F5F5F7] transition-colors"
      >
        <p className="text-sm font-medium text-[#1D1D1F]">{competitor.player}</p>
        <span className="text-[#86868B] text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-[#E5E5EA]">
          <p className="text-sm text-[#1D1D1F] leading-relaxed pt-3">{competitor.positioning}</p>
          <div>
            <p className="text-xs font-semibold text-[#86868B] mb-1.5">UX Patterns</p>
            <div className="flex flex-wrap gap-1.5">
              {competitor.notable_ux_patterns.map((p) => <Tag key={p} text={p} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function ResearchPanel({ projectId, initialBrief, initialStatus }: Props) {
  const [status, setStatus] = useState<ResearchStatus>(initialStatus)
  const [brief, setBrief] = useState<UxResearchBrief | null>(initialBrief)
  const [isRerunning, setIsRerunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Poll while pending or running
  const poll = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/research-status`)
    if (!res.ok) return
    const data = await res.json()
    setStatus(data.research_status)
    if (data.ux_research_brief) setBrief(data.ux_research_brief)
  }, [projectId])

  useEffect(() => {
    if (status !== 'pending' && status !== 'running') return
    const id = setInterval(poll, 3000)
    return () => clearInterval(id)
  }, [status, poll])

  async function handleRerun() {
    setIsRerunning(true)
    setError(null)
    setBrief(null)
    setStatus('pending')
    const result = await rerunUxResearch(projectId)
    if (result.error) {
      setError(result.error)
      setStatus('failed')
    }
    setIsRerunning(false)
  }

  const isActive = status === 'pending' || status === 'running'

  return (
    <div className="space-y-8">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[status]}`}>
            {isActive ? <span className="flex items-center gap-1.5"><LoadingDots />{STATUS_LABELS[status]}</span> : STATUS_LABELS[status]}
          </span>
          {brief?.generated_at && (
            <span className="text-xs text-[#86868B]">
              Generated {new Date(brief.generated_at).toLocaleDateString()}
            </span>
          )}
        </div>
        <button
          onClick={handleRerun}
          disabled={isRerunning || isActive}
          className="flex h-9 items-center rounded-full bg-[#F0E100] px-5 text-sm font-semibold text-[#1D1D1F] hover:bg-[#d4c900] disabled:opacity-50 transition-colors"
        >
          {isRerunning ? <LoadingDots /> : '↺ Re-run Research'}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {/* Pending / running state */}
      {isActive && !brief && (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 text-center shadow-sm">
          <p className="text-lg font-medium text-[#1D1D1F]">Research in progress…</p>
          <p className="mt-2 text-sm text-[#86868B] max-w-sm">
            Claude is researching UX patterns and competitive context for this product. This usually takes 15–30 seconds.
          </p>
        </div>
      )}

      {/* Failed state */}
      {status === 'failed' && !brief && (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 text-center shadow-sm">
          <p className="text-lg font-medium text-[#1D1D1F]">Research failed</p>
          <p className="mt-2 text-sm text-[#86868B]">Click ↺ Re-run Research to try again.</p>
        </div>
      )}

      {/* Brief content */}
      {brief && (
        <div className="space-y-8">
          {/* App Category */}
          <Section title="App Category">
            <p className="text-sm font-medium text-[#1D1D1F]">{brief.app_category}</p>
          </Section>

          {/* User Archetypes */}
          {brief.user_archetypes?.length > 0 && (
            <Section title="User Archetypes">
              <div className="space-y-2">
                {brief.user_archetypes.map((a) => (
                  <ArchetypeCard key={a.name} archetype={a} />
                ))}
              </div>
            </Section>
          )}

          {/* Competitive Landscape */}
          {brief.competitive_landscape?.length > 0 && (
            <Section title="Competitive Landscape">
              <div className="space-y-2">
                {brief.competitive_landscape.map((c) => (
                  <CompetitorCard key={c.player} competitor={c} />
                ))}
              </div>
            </Section>
          )}

          {/* Journey Stage Conventions */}
          {brief.journey_stage_conventions?.length > 0 && (
            <Section title="Journey Stage Conventions">
              <div className="flex flex-wrap items-center gap-2">
                {brief.journey_stage_conventions.map((stage, i) => (
                  <span key={stage} className="flex items-center gap-2">
                    <Tag text={stage} />
                    {i < brief.journey_stage_conventions.length - 1 && (
                      <span className="text-[#86868B] text-xs">→</span>
                    )}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Common Pain Points */}
          {brief.common_pain_points?.length > 0 && (
            <Section title="Common Pain Points">
              <div className="flex flex-wrap gap-1.5">
                {brief.common_pain_points.map((p) => <Tag key={p} text={p} />)}
              </div>
            </Section>
          )}

          {/* UX Pattern Notes */}
          {brief.ux_pattern_notes && (
            <Section title="UX Pattern Notes">
              <p className="text-sm text-[#1D1D1F] leading-relaxed whitespace-pre-wrap">
                {brief.ux_pattern_notes}
              </p>
            </Section>
          )}
        </div>
      )}
    </div>
  )
}
