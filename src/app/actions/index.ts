'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { anthropic } from '@/lib/anthropic'

export async function createProject(formData: FormData) {
  const name = formData.get('name') as string
  const description = formData.get('description') as string

  if (!name?.trim()) return

  const { data, error } = await supabase
    .from('project')
    .insert({ name: name.trim(), description: description?.trim() || null })
    .select('id')
    .single()

  if (error || !data) {
    console.error('Failed to create project:', error)
    return
  }

  redirect(`/projects/${data.id}`)
}

export async function addResearchInput(formData: FormData) {
  const projectId = formData.get('project_id') as string
  const type = formData.get('type') as string
  const content = formData.get('content') as string
  const sourceLabel = formData.get('source_label') as string
  const attachment = formData.get('attachment') as File | null

  if (!projectId || !type || !content?.trim()) return

  let attachmentUrl: string | null = null

  if (attachment && attachment.size > 0) {
    const ext = attachment.name.split('.').pop()
    const fileName = `${crypto.randomUUID()}.${ext}`
    const buffer = Buffer.from(await attachment.arrayBuffer())

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('research-attachments')
      .upload(fileName, buffer, { contentType: attachment.type })

    if (uploadError) {
      console.error('Failed to upload attachment:', uploadError)
    } else if (uploadData) {
      const { data: urlData } = supabase.storage
        .from('research-attachments')
        .getPublicUrl(fileName)
      attachmentUrl = urlData.publicUrl
    }
  }

  const { error } = await supabase.from('research_input').insert({
    project_id: projectId,
    type,
    content: content.trim(),
    source_label: sourceLabel?.trim() || null,
    attachment_url: attachmentUrl,
  })

  if (error) {
    console.error('Failed to add research input:', error)
    return
  }

  revalidatePath(`/projects/${projectId}`)
}

export async function synthesiseInput(formData: FormData) {
  const inputId = formData.get('input_id') as string
  const projectId = formData.get('project_id') as string

  if (!inputId || !projectId) return

  const { data: input, error: inputError } = await supabase
    .from('research_input')
    .select('*')
    .eq('id', inputId)
    .single()

  if (inputError || !input) {
    console.error('Failed to fetch research input:', inputError)
    return
  }

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are a product analyst synthesising raw UX research into structured requirements.

Analyse the following research input and identify every distinct requirement it contains. A single input may contain one requirement or several — extract as many as the content supports, but do not invent requirements that aren't implied by the research.

For each requirement, output a JSON object with these fields:
- business_opportunity: string — what problem or opportunity this addresses for the business or user (1-2 sentences)
- user_story: string — "As a [user], I want to [action] so that [outcome]"
- acceptance_criteria: string[] — 2-5 conditions that must be true for this requirement to be considered complete
- dfv_tag: "desirability" | "feasibility" | "viability" | null — the primary DFV lens this requirement is driven by; null if unclear

Return ONLY a JSON array of requirement objects. No explanation, no markdown, no code fences. Just the raw JSON array.

Research input type: ${input.type}
${input.source_label ? `Source: ${input.source_label}` : ''}

Content:
${input.content}`,
      },
    ],
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

  let requirements: Array<{
    business_opportunity: string
    user_story: string
    acceptance_criteria: string[]
    dfv_tag: string | null
  }>

  try {
    requirements = JSON.parse(responseText)
    if (!Array.isArray(requirements)) throw new Error('Response is not an array')
  } catch (e) {
    console.error('Failed to parse Claude response:', responseText, e)
    return
  }

  const rows = requirements.map((req) => ({
    project_id: projectId,
    source_input_ids: [inputId],
    business_opportunity: req.business_opportunity,
    user_story: req.user_story,
    acceptance_criteria: req.acceptance_criteria,
    dfv_tag: req.dfv_tag ?? null,
    status: 'draft',
  }))

  const { error: insertError } = await supabase.from('requirement').insert(rows)

  if (insertError) {
    console.error('Failed to insert requirements:', insertError)
    return
  }

  revalidatePath(`/projects/${projectId}`)
}
