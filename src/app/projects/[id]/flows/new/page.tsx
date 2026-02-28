import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { createFlow } from '@/app/actions'
import type { Project } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AppHeader } from '@/app/components/AppHeader'

export default async function NewFlowPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { data: project, error } = await supabase
    .from('project')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !project) notFound()

  const p = project as Project

  return (
    <>
      <AppHeader
        crumbs={[
          { label: p.name, href: `/projects/${id}` },
          { label: 'New Flow' },
        ]}
      />

      <main className="mx-auto max-w-lg px-8 py-16">
        <div className="mb-8">
          <p className="mb-1 text-sm font-medium text-[#86868B]">Add a flow</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">New Flow</h1>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <p className="mb-6 text-sm text-[#86868B] leading-relaxed">
            Each flow has its own research inputs, synthesised requirements, and canvas.
          </p>
          <form action={createFlow} className="space-y-6">
            <input type="hidden" name="project_id" value={id} />

            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold text-foreground">
                Flow Name <span className="text-[#C97D60]">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                type="text"
                required
                autoFocus
                placeholder="e.g. Onboarding Flow, Checkout Journey"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-semibold text-foreground">
                Description{' '}
                <span className="font-normal text-[#86868B]">(optional)</span>
              </Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                placeholder="What is this flow exploring?"
                className="rounded-xl"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" className="bg-[#F0E100] text-[#1D1D1F] hover:bg-[#d4c900] rounded-full px-6 font-semibold">
                Create Flow
              </Button>
              <Button asChild variant="ghost" className="text-[#86868B] rounded-full">
                <a href={`/projects/${id}`}>Cancel</a>
              </Button>
            </div>
          </form>
        </div>
      </main>
    </>
  )
}
