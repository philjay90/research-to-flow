import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { createFlow } from '@/app/actions'
import type { Project } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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

      <main className="mx-auto max-w-lg px-6 py-10">
        <h1 className="mb-6 text-2xl font-bold text-foreground">New Flow</h1>

        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm text-[#7286A0]">
              Give this flow a name. Each flow has its own research inputs, requirements, and canvas.
            </p>
          </CardHeader>
          <CardContent>
            <form action={createFlow} className="space-y-4">
              <input type="hidden" name="project_id" value={id} />

              <div className="space-y-1.5">
                <Label htmlFor="name">
                  Flow Name <span className="text-[#EE4266]">*</span>
                </Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Onboarding Flow, Checkout Journey"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">
                  Description{' '}
                  <span className="text-xs font-normal text-[#7286A0]">(optional)</span>
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={3}
                  placeholder="What is this flow exploring?"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <Button type="submit" className="bg-[#EE4266] text-white hover:bg-[#d63558]">
                  Create Flow
                </Button>
                <Button asChild variant="ghost" className="text-[#7286A0]">
                  <a href={`/projects/${id}`}>Cancel</a>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  )
}
