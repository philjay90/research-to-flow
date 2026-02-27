import Link from 'next/link'
import { createProject } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-foreground">New Project</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-[#7286A0]">
            Start by giving your project a name and context
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createProject} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="name">
                Project Name <span className="text-[#EE4266]">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                type="text"
                required
                placeholder="e.g. Checkout Redesign"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                placeholder="Optional context about this project..."
              />
            </div>

            <div className="flex gap-3 pt-1">
              <Button
                type="submit"
                className="bg-[#EE4266] text-white hover:bg-[#d63558]"
              >
                Create Project
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
