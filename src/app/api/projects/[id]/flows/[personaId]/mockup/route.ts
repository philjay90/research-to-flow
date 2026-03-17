import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { runUxDesignAgent } from '@/lib/agents/ux-design-agent'

// Allow up to 5 minutes — the agent makes 3 sequential Claude API calls
export const maxDuration = 300

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; personaId: string }> }
) {
  const { id: projectId, personaId } = await params
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Run synchronously inside this long-lived route
  await runUxDesignAgent({ projectId, personaId })

  return NextResponse.json({ success: true })
}
