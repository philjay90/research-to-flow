'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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

  if (!projectId || !type || !content?.trim()) return

  const { error } = await supabase.from('research_input').insert({
    project_id: projectId,
    type,
    content: content.trim(),
    source_label: sourceLabel?.trim() || null,
  })

  if (error) {
    console.error('Failed to add research input:', error)
    return
  }

  revalidatePath(`/projects/${projectId}`)
}
