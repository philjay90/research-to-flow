import Link from 'next/link'
import { createProject } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AppHeader } from '@/app/components/AppHeader'

export default function NewProjectPage() {
  return (
    <>
      <AppHeader crumbs={[{ label: 'New Project' }]} />
      <main className="mx-auto max-w-lg px-8 py-16">
        <div className="mb-8">
          <p className="mb-1 text-sm font-medium text-[#86868B]">Get started</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">New Project</h1>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <p className="mb-6 text-sm text-[#86868B] leading-relaxed">
            Start by giving your project a name and some context. You can create multiple flows within a project.
          </p>
          <form action={createProject} className="space-y-6">
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
                <span className="font-normal text-[#86868B]">(optional)</span>
              </Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                placeholder="Optional context about this project..."
                className="rounded-xl"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" className="bg-[#F0E100] text-[#1D1D1F] hover:bg-[#d4c900] rounded-full px-6 font-semibold">
                Create Project
              </Button>
              <Button variant="ghost" asChild className="text-[#86868B] rounded-full">
                <Link href="/">Cancel</Link>
              </Button>
            </div>
          </form>
        </div>
      </main>
    </>
  )
}
