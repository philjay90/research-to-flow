'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createProject } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AppHeader } from '@/app/components/AppHeader'
import { SubmitButton } from '@/app/components/SubmitButton'

export default function NewProjectPage() {
  const [agentEnabled, setAgentEnabled] = useState(false)

  return (
    <>
      <AppHeader crumbs={[{ label: 'New Project' }]} />
      <main className="mx-auto max-w-lg px-8 py-16">
        <div className="mb-8">
          <p className="mb-1 text-sm font-medium text-foreground">Get started</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">New Project</h1>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <p className="mb-6 text-sm text-foreground leading-relaxed">
            Start by giving your project a name and some context. You can create multiple flows within a project.
          </p>
          <form action={createProject} className="space-y-6">
            {/* Pass checkbox state as a hidden field so the server action can read it */}
            <input type="hidden" name="ux_research_enabled" value={String(agentEnabled)} />

            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold text-foreground">
                Project Name <span className="text-[#C97D60]">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                type="text"
                required
                autoFocus
                placeholder="e.g. Checkout Redesign"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-semibold text-foreground">
                Description{' '}
                <span className="font-normal text-foreground/50">(optional)</span>
              </Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                placeholder="Optional context about this project..."
                className="rounded-xl"
              />
            </div>

            {/* UX Research Agent toggle */}
            <button
              type="button"
              onClick={() => setAgentEnabled((v) => !v)}
              className={`w-full text-left rounded-xl border px-4 py-4 transition-colors ${
                agentEnabled ? 'border-[#1D1D1F] bg-[#F5F5F7]' : 'border-[#E5E5EA] hover:border-[#C7C7CC]'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#1D1D1F]">Enable UX Research Agent</p>
                  <p className="mt-1 text-xs text-[#86868B] leading-relaxed">
                    Claude will research UX patterns, user archetypes, and competitive context for this product type. Runs in the background after project creation.
                  </p>
                </div>
                {/* Toggle pill */}
                <div
                  className={`relative shrink-0 h-6 w-10 rounded-full transition-colors ${
                    agentEnabled ? 'bg-[#1D1D1F]' : 'bg-[#D2D2D7]'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      agentEnabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </div>
            </button>

            <div className="flex gap-3 pt-2">
              <SubmitButton className="inline-flex items-center justify-center bg-[#F0E100] text-[#1D1D1F] hover:bg-[#d4c900] rounded-full px-6 py-2 text-sm font-semibold transition-colors min-w-[120px]">
                Create Project
              </SubmitButton>
              <Button variant="ghost" asChild className="text-foreground rounded-full">
                <Link href="/">Cancel</Link>
              </Button>
            </div>
          </form>
        </div>
      </main>
    </>
  )
}
