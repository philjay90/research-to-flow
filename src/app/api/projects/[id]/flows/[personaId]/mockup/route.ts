import { NextResponse } from 'next/server'
import { runUxDesignAgent } from '@/lib/agents/ux-design-agent'

// Vercel Pro: allow up to 60s (well above the single Haiku call + Supabase overhead)
export const maxDuration = 60

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; personaId: string }> }
) {
  const { id: projectId, personaId } = await params

  // Auth is handled by middleware (src/middleware.ts) which redirects
  // unauthenticated requests to /login before they reach this handler.
  // We intentionally skip a second getUser() call here because the middleware
  // already refreshed the session and writing new cookies to the response;
  // calling createClient() + getUser() again would read the stale request
  // cookies and incorrectly return null.

  // Run synchronously inside this long-lived route
  const result = await runUxDesignAgent({ projectId, personaId })

  if (result.error) {
    // Agent already set mockup_status='failed' in DB; return the error for the UI to display
    return NextResponse.json({ success: false, error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
