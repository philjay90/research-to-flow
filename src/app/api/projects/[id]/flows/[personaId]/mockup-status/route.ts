import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; personaId: string }> }
) {
  const { personaId } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('persona')
    .select('mockup_status, mockup_pending_diff, mockup_canvas_hash')
    .eq('id', personaId)
    .single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}
