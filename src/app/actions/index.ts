'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { anthropic } from '@/lib/anthropic'
import Dagre from '@dagrejs/dagre'

const NODE_W = 220
const NODE_H_STEP = 70
const NODE_H_DECISION = 120

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function getClientAndUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

function applyDagreLayout(
  nodes: Array<{ id: string; type: string }>,
  edges: Array<{ source: string; target: string }>
): Map<string, { x: number; y: number }> {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', ranksep: 120, nodesep: 90, acyclicer: 'greedy', ranker: 'network-simplex' })
  nodes.forEach((n) => {
    g.setNode(n.id, { width: NODE_W, height: n.type === 'decision' ? NODE_H_DECISION : NODE_H_STEP })
  })
  edges.forEach((e) => g.setEdge(e.source, e.target))
  Dagre.layout(g)
  const positions = new Map<string, { x: number; y: number }>()
  nodes.forEach((n) => {
    const pos = g.node(n.id)
    const h = n.type === 'decision' ? NODE_H_DECISION : NODE_H_STEP
    positions.set(n.id, { x: pos.x - NODE_W / 2, y: pos.y - h / 2 })
  })
  return positions
}

// ---------------------------------------------------------------------------
// Auth actions
// ---------------------------------------------------------------------------

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function changePassword(
  _prev: { error: string | null; success: boolean },
  formData: FormData
): Promise<{ error: string | null; success: boolean }> {
  const supabase = await createClient()
  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string

  if (!password || password.length < 6)
    return { error: 'Password must be at least 6 characters.', success: false }
  if (password !== confirm)
    return { error: 'Passwords do not match.', success: false }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message, success: false }
  return { error: null, success: true }
}

export async function deleteAccount(): Promise<{ error: string | null }> {
  const { supabase, user } = await getClientAndUser()
  if (!user) return { error: 'Not authenticated.' }

  // Delete all user data – projects cascade to flows → inputs, requirements, nodes, edges
  const { error: projectsError } = await supabase
    .from('project')
    .delete()
    .eq('user_id', user.id)
  if (projectsError) return { error: projectsError.message }

  // Delete the auth user via admin client (requires service role key)
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)
  if (deleteError) return { error: deleteError.message }

  redirect('/login')
}

// ---------------------------------------------------------------------------
// Project actions
// ---------------------------------------------------------------------------

export async function createProject(formData: FormData) {
  const { supabase, user } = await getClientAndUser()
  if (!user) return

  const name = formData.get('name') as string
  const description = formData.get('description') as string

  if (!name?.trim()) return

  const { data, error } = await supabase
    .from('project')
    .insert({ name: name.trim(), description: description?.trim() || null, user_id: user.id })
    .select('id')
    .single()

  if (error || !data) {
    console.error('Failed to create project:', error)
    return
  }

  redirect(`/projects/${data.id}`)
}

export async function deleteProject(projectId: string) {
  const { supabase } = await getClientAndUser()
  await supabase.from('project').delete().eq('id', projectId)
  redirect('/')
}

export async function updateProject(projectId: string, name: string, description: string | null) {
  if (!name?.trim()) return
  const { supabase } = await getClientAndUser()
  await supabase
    .from('project')
    .update({ name: name.trim(), description: description?.trim() || null })
    .eq('id', projectId)
  revalidatePath(`/projects/${projectId}`)
}

// ---------------------------------------------------------------------------
// Flow actions
// ---------------------------------------------------------------------------

export async function createFlow(formData: FormData) {
  const { supabase, user } = await getClientAndUser()
  if (!user) return

  const projectId = formData.get('project_id') as string
  const name = formData.get('name') as string
  const description = formData.get('description') as string

  if (!projectId || !name?.trim()) return

  const { data, error } = await supabase
    .from('flow')
    .insert({
      project_id: projectId,
      name: name.trim(),
      description: description?.trim() || null,
      user_id: user.id,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('Failed to create flow:', error)
    return
  }

  redirect(`/projects/${projectId}/flows/${data.id}`)
}

export async function deleteFlow(flowId: string, projectId: string) {
  const { supabase } = await getClientAndUser()
  await supabase.from('flow').delete().eq('id', flowId)
  revalidatePath(`/projects/${projectId}`)
}

export async function updateFlow(flowId: string, projectId: string, name: string, description: string | null) {
  if (!name?.trim()) return
  const { supabase } = await getClientAndUser()
  await supabase
    .from('flow')
    .update({ name: name.trim(), description: description?.trim() || null })
    .eq('id', flowId)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/flows/${flowId}`)
}

// ---------------------------------------------------------------------------
// Research input actions
// ---------------------------------------------------------------------------

export async function addResearchInput(formData: FormData) {
  const { supabase, user } = await getClientAndUser()
  if (!user) return

  const projectId = formData.get('project_id') as string
  const flowId = formData.get('flow_id') as string
  const type = formData.get('type') as string
  const content = formData.get('content') as string
  const sourceLabel = formData.get('source_label') as string
  const attachment = formData.get('attachment') as File | null

  if (!projectId || !flowId || !type || !content?.trim()) return

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
    flow_id: flowId,
    type,
    content: content.trim(),
    source_label: sourceLabel?.trim() || null,
    attachment_url: attachmentUrl,
    user_id: user.id,
  })

  if (error) {
    console.error('Failed to add research input:', error)
    return
  }

  revalidatePath(`/projects/${projectId}/flows/${flowId}`)
}

export async function deleteResearchInput(inputId: string, flowId: string, projectId: string) {
  const { supabase } = await getClientAndUser()
  await supabase.from('research_input').delete().eq('id', inputId)
  revalidatePath(`/projects/${projectId}/flows/${flowId}`)
}

export async function updateResearchInput(
  inputId: string,
  flowId: string,
  projectId: string,
  data: { type: string; source_label: string | null; content: string }
) {
  if (!data.content?.trim()) return
  const { supabase } = await getClientAndUser()
  await supabase
    .from('research_input')
    .update({
      type: data.type,
      source_label: data.source_label?.trim() || null,
      content: data.content.trim(),
    })
    .eq('id', inputId)
  revalidatePath(`/projects/${projectId}/flows/${flowId}`)
}

export async function deleteAllInputs(flowId: string, projectId: string) {
  const { supabase } = await getClientAndUser()
  await supabase.from('research_input').delete().eq('flow_id', flowId)
  revalidatePath(`/projects/${projectId}/flows/${flowId}`)
}

// ---------------------------------------------------------------------------
// Requirement actions
// ---------------------------------------------------------------------------

export async function synthesiseInput(
  inputId: string,
  flowId: string,
  projectId: string,
  mode: 'append' | 'replace' = 'append'
) {
  const { supabase, user } = await getClientAndUser()
  if (!user || !inputId || !flowId || !projectId) return

  if (mode === 'replace') {
    const { data: existingReqs } = await supabase
      .from('requirement')
      .select('id, source_input_ids')
      .eq('flow_id', flowId)

    const toDelete = (existingReqs ?? [])
      .filter((r: { source_input_ids: string[] }) => r.source_input_ids.includes(inputId))
      .map((r: { id: string }) => r.id)

    if (toDelete.length > 0) {
      await supabase.from('requirement').delete().in('id', toDelete)
    }
  }

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
    flow_id: flowId,
    source_input_ids: [inputId],
    business_opportunity: req.business_opportunity,
    user_story: req.user_story,
    acceptance_criteria: req.acceptance_criteria,
    dfv_tag: req.dfv_tag ?? null,
    status: 'draft',
    user_id: user.id,
  }))

  const { error: insertError } = await supabase.from('requirement').insert(rows)

  if (insertError) {
    console.error('Failed to insert requirements:', insertError)
    return
  }

  revalidatePath(`/projects/${projectId}/flows/${flowId}`)
}

export async function deleteRequirement(requirementId: string, flowId: string, projectId: string) {
  const { supabase } = await getClientAndUser()
  await supabase.from('requirement').delete().eq('id', requirementId)
  revalidatePath(`/projects/${projectId}/flows/${flowId}`)
}

export async function updateRequirement(
  requirementId: string,
  flowId: string,
  projectId: string,
  data: {
    user_story: string
    business_opportunity: string
    acceptance_criteria: string[]
    dfv_tag: string | null
  }
) {
  if (!data.user_story?.trim()) return
  const { supabase } = await getClientAndUser()
  await supabase
    .from('requirement')
    .update({
      user_story: data.user_story.trim(),
      business_opportunity: data.business_opportunity.trim(),
      acceptance_criteria: data.acceptance_criteria.filter((c) => c.trim()),
      dfv_tag: data.dfv_tag || null,
      status: 'edited',
    })
    .eq('id', requirementId)
  revalidatePath(`/projects/${projectId}/flows/${flowId}`)
}

export async function deleteAllRequirements(flowId: string, projectId: string) {
  const { supabase } = await getClientAndUser()
  await supabase.from('requirement').delete().eq('flow_id', flowId)
  revalidatePath(`/projects/${projectId}/flows/${flowId}`)
}

// ---------------------------------------------------------------------------
// Canvas actions
// ---------------------------------------------------------------------------

export async function generateFlow(flowId: string) {
  const { supabase, user } = await getClientAndUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: requirements } = await supabase
    .from('requirement')
    .select('business_opportunity, user_story, acceptance_criteria, dfv_tag')
    .eq('flow_id', flowId)

  if (!requirements || requirements.length === 0) return { error: 'No requirements to generate from' }

  const { data: flow } = await supabase.from('flow').select('project_id').eq('id', flowId).single()
  if (!flow) return { error: 'Flow not found' }

  const projectId = flow.project_id

  const requirementsSummary = requirements
    .map((r: { business_opportunity: string; user_story: string; acceptance_criteria: string[]; dfv_tag: string | null }, i: number) =>
      `Requirement ${i + 1}:
  Business opportunity: ${r.business_opportunity}
  User story: ${r.user_story}
  Acceptance criteria: ${r.acceptance_criteria.join(' | ')}
  DFV: ${r.dfv_tag ?? 'unclassified'}`
    )
    .join('\n\n')

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are a UX/product designer creating a task-flow diagram from a set of product requirements.

Given the requirements below, design an optimal end-to-end task flow that a user would follow to accomplish their goals. The flow should represent the actual steps a user takes through the product — not the requirements themselves.

Rules:
- Create 5–15 nodes representing distinct user steps or decision points
- Use type "step" for linear actions (e.g. "User enters email address")
- Use type "decision" for branching points (e.g. "Does account exist?")
- Edges define the sequence — include all connections between nodes
- Use temporary string IDs like "n1", "n2", "n3" etc.
- Keep node labels concise — under 10 words each
- Decision node labels must be questions ending in "?"
- The first node should be the entry point, the last should be the end state

Return ONLY a JSON object with this exact shape. No explanation, no markdown, no code fences:
{
  "nodes": [
    { "id": "n1", "type": "step", "label": "..." },
    { "id": "n2", "type": "decision", "label": "...?" }
  ],
  "edges": [
    { "source": "n1", "target": "n2", "label": null },
    { "source": "n2", "target": "n3", "label": "Yes" },
    { "source": "n2", "target": "n4", "label": "No" }
  ]
}

Edge label rules:
- Edges leaving a "decision" node MUST have a label ("Yes", "No", or a short condition)
- Edges leaving a "step" node should have label: null

Requirements:
${requirementsSummary}`,
      },
    ],
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

  let flowData: {
    nodes: Array<{ id: string; type: string; label: string }>
    edges: Array<{ source: string; target: string; label?: string | null }>
  }

  try {
    const cleaned = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    flowData = JSON.parse(cleaned)
    if (!flowData.nodes || !flowData.edges) throw new Error('Invalid shape')
  } catch (e) {
    console.error('Failed to parse Claude flow response:', responseText, e)
    return { error: 'Failed to parse flow from Claude' }
  }

  const positions = applyDagreLayout(flowData.nodes, flowData.edges)

  await supabase.from('flow_edge').delete().eq('flow_id', flowId)
  await supabase.from('flow_node').delete().eq('flow_id', flowId)

  const nodeIdMap = new Map<string, string>()

  for (const node of flowData.nodes) {
    const pos = positions.get(node.id) ?? { x: 0, y: 0 }
    const { data, error } = await supabase
      .from('flow_node')
      .insert({
        project_id: projectId,
        flow_id: flowId,
        requirement_id: null,
        type: node.type,
        label: node.label,
        position_x: pos.x,
        position_y: pos.y,
        user_id: user.id,
      })
      .select('id')
      .single()

    if (!error && data) {
      nodeIdMap.set(node.id, data.id)
    }
  }

  const edgeRows = flowData.edges
    .map((e) => {
      const sourceId = nodeIdMap.get(e.source)
      const targetId = nodeIdMap.get(e.target)
      if (!sourceId || !targetId) return null
      return {
        project_id: projectId,
        flow_id: flowId,
        source_node_id: sourceId,
        target_node_id: targetId,
        label: e.label ?? null,
        user_id: user.id,
      }
    })
    .filter(Boolean)

  if (edgeRows.length > 0) {
    await supabase.from('flow_edge').insert(edgeRows)
  }

  return { success: true }
}

export async function saveNodePosition(nodeId: string, x: number, y: number) {
  const { supabase } = await getClientAndUser()
  await supabase
    .from('flow_node')
    .update({ position_x: x, position_y: y })
    .eq('id', nodeId)
}

export async function saveEdge(flowId: string, sourceNodeId: string, targetNodeId: string) {
  const { supabase, user } = await getClientAndUser()
  if (!user) return null

  const { data: flow } = await supabase.from('flow').select('project_id').eq('id', flowId).single()
  if (!flow) return null

  const { data, error } = await supabase
    .from('flow_edge')
    .insert({
      project_id: flow.project_id,
      flow_id: flowId,
      source_node_id: sourceNodeId,
      target_node_id: targetNodeId,
      user_id: user.id,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to save edge:', error)
    return null
  }
  return data?.id ?? null
}

export async function deleteEdge(edgeId: string) {
  const { supabase } = await getClientAndUser()
  await supabase.from('flow_edge').delete().eq('id', edgeId)
}

// ---------------------------------------------------------------------------
// Persona actions
// ---------------------------------------------------------------------------

const PERSONA_FIELDS = [
  'name', 'role_title', 'background', 'tools',
  'macro_goals', 'tasks_activities', 'pain_points',
] as const
type PersonaField = (typeof PERSONA_FIELDS)[number]

export async function synthesizePersonas(projectId: string): Promise<{ error?: string; success?: boolean }> {
  const { supabase, user } = await getClientAndUser()
  if (!user) return { error: 'Not authenticated' }

  // All research inputs across all flows in this project
  const { data: inputs } = await supabase
    .from('research_input')
    .select('id, type, content, source_label')
    .eq('project_id', projectId)

  if (!inputs || inputs.length === 0) {
    return { error: 'No research inputs found for this project.' }
  }

  // All requirements for this project
  const { data: requirements } = await supabase
    .from('requirement')
    .select('id, user_story, business_opportunity, dfv_tag')
    .eq('project_id', projectId)

  // Existing personas
  const { data: existingPersonas } = await supabase
    .from('persona')
    .select('*')
    .eq('project_id', projectId)

  const inputsSummary = inputs
    .map((inp) =>
      `[Input ID: ${inp.id}]
Type: ${inp.type}${inp.source_label ? `\nSource: ${inp.source_label}` : ''}
Content: ${inp.content}`
    )
    .join('\n\n---\n\n')

  const requirementsSummary =
    requirements && requirements.length > 0
      ? requirements
          .map(
            (r) =>
              `[Requirement ID: ${r.id}]
User story: ${r.user_story}
Business opportunity: ${r.business_opportunity}
DFV: ${r.dfv_tag ?? 'unclassified'}`
          )
          .join('\n\n')
      : 'No requirements yet.'

  const existingPersonasSummary =
    existingPersonas && existingPersonas.length > 0
      ? existingPersonas
          .map(
            (p) =>
              `[Persona ID: ${p.id}]
Name: ${p.name}
Role: ${p.role_title}
Background: ${p.background}
Tools: ${p.tools}
Goals: ${p.macro_goals}
Tasks: ${p.tasks_activities}
Pain points: ${p.pain_points}`
          )
          .join('\n\n')
      : 'No existing personas.'

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 8096,
    messages: [
      {
        role: 'user',
        content: `You are a UX researcher creating or updating user personas from research data.

Analyse the research inputs and requirements below. Identify distinct user types and create or update personas accordingly.

RULES:
- Each persona represents a distinct user type with different goals, behaviours, and pain points
- If an existing persona clearly matches a user type in the data, update it (set existing_persona_id to their ID)
- If the data reveals a new user type not covered by existing personas, create a new one (set existing_persona_id to null)
- Only create as many personas as the data genuinely supports
- For field_provenance, set source to "data" if the value is directly stated in the research, or "llm_inferred" if you are inferring it
- source_input_ids: list the Input IDs that informed this persona
- requirement_ids: list Requirement IDs most relevant to this persona

Return ONLY a JSON array. No explanation, no markdown, no code fences. Each element must have this exact shape:
{
  "existing_persona_id": "uuid-or-null",
  "name": "First name or persona name",
  "role_title": "Job title or role",
  "background": "2-3 sentences about their background and context",
  "tools": "Tools, platforms, and systems they use",
  "macro_goals": "Their overarching goals and motivations",
  "tasks_activities": "Day-to-day tasks and activities",
  "pain_points": "Frustrations, blockers, and challenges",
  "source_input_ids": ["input-id-1"],
  "requirement_ids": ["req-id-1"],
  "field_provenance": {
    "name": { "source": "data", "input_ids": ["input-id"] },
    "role_title": { "source": "llm_inferred", "input_ids": ["input-id"] },
    "background": { "source": "data", "input_ids": ["input-id"] },
    "tools": { "source": "data", "input_ids": ["input-id"] },
    "macro_goals": { "source": "llm_inferred", "input_ids": ["input-id"] },
    "tasks_activities": { "source": "data", "input_ids": ["input-id"] },
    "pain_points": { "source": "data", "input_ids": ["input-id"] }
  }
}

--- RESEARCH INPUTS ---
${inputsSummary}

--- REQUIREMENTS ---
${requirementsSummary}

--- EXISTING PERSONAS ---
${existingPersonasSummary}`,
      },
    ],
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

  type PersonaResult = {
    existing_persona_id: string | null
    name: string
    role_title: string
    background: string
    tools: string
    macro_goals: string
    tasks_activities: string
    pain_points: string
    source_input_ids: string[]
    requirement_ids: string[]
    field_provenance: Record<string, { source: string; input_ids: string[] }>
  }

  let personaResults: PersonaResult[]

  try {
    const cleaned = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    personaResults = JSON.parse(cleaned)
    if (!Array.isArray(personaResults)) throw new Error('Response is not an array')
  } catch (e) {
    console.error('Failed to parse Claude persona response:', responseText, e)
    return { error: 'Failed to parse personas from Claude' }
  }

  for (const p of personaResults) {
    if (p.existing_persona_id) {
      // Update existing — preserve manually-edited fields
      const { data: existing } = await supabase
        .from('persona')
        .select('field_provenance')
        .eq('id', p.existing_persona_id)
        .single()

      if (!existing) continue

      const existingProvenance: Record<string, { source: string; input_ids: string[] }> =
        existing.field_provenance ?? {}

      const updates: Record<string, unknown> = {
        source_input_ids: p.source_input_ids,
        updated_at: new Date().toISOString(),
      }
      const newProvenance = { ...existingProvenance }

      for (const field of PERSONA_FIELDS) {
        if (existingProvenance[field]?.source === 'manual') {
          // Preserve manual field — skip
        } else {
          updates[field] = p[field]
          newProvenance[field] = p.field_provenance[field] ?? { source: 'llm_inferred', input_ids: [] }
        }
      }
      updates.field_provenance = newProvenance

      await supabase.from('persona').update(updates).eq('id', p.existing_persona_id)

      // Replace llm-sourced requirement links (preserve manual links)
      if (p.requirement_ids?.length > 0) {
        await supabase
          .from('persona_requirement')
          .delete()
          .eq('persona_id', p.existing_persona_id)
          .eq('link_source', 'llm')

        const reqLinks = p.requirement_ids.map((reqId) => ({
          persona_id: p.existing_persona_id as string,
          requirement_id: reqId,
          link_source: 'llm',
        }))
        await supabase
          .from('persona_requirement')
          .upsert(reqLinks, { onConflict: 'persona_id,requirement_id' })
      }
    } else {
      // Create new persona
      const provenance: Record<string, { source: string; input_ids: string[] }> = {}
      for (const field of PERSONA_FIELDS) {
        provenance[field] = p.field_provenance[field] ?? { source: 'llm_inferred', input_ids: [] }
      }

      const { data: newPersona, error: insertError } = await supabase
        .from('persona')
        .insert({
          project_id: projectId,
          user_id: user.id,
          name: p.name,
          role_title: p.role_title,
          background: p.background,
          tools: p.tools,
          macro_goals: p.macro_goals,
          tasks_activities: p.tasks_activities,
          pain_points: p.pain_points,
          field_provenance: provenance,
          source_input_ids: p.source_input_ids,
          status: 'active',
        })
        .select('id')
        .single()

      if (insertError || !newPersona) {
        console.error('Failed to insert persona:', insertError)
        continue
      }

      if (p.requirement_ids?.length > 0) {
        const reqLinks = p.requirement_ids.map((reqId) => ({
          persona_id: newPersona.id,
          requirement_id: reqId,
          link_source: 'llm',
        }))
        await supabase.from('persona_requirement').insert(reqLinks)
      }
    }
  }

  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

export async function updatePersona(
  personaId: string,
  projectId: string,
  data: Partial<Record<PersonaField, string>>,
  changedFields: PersonaField[]
) {
  const { supabase } = await getClientAndUser()

  const { data: existing } = await supabase
    .from('persona')
    .select('field_provenance')
    .eq('id', personaId)
    .single()

  const existingProvenance: Record<string, { source: string; input_ids: string[] }> =
    existing?.field_provenance ?? {}

  const newProvenance = { ...existingProvenance }
  for (const field of changedFields) {
    newProvenance[field] = { source: 'manual', input_ids: [] }
  }

  await supabase
    .from('persona')
    .update({ ...data, field_provenance: newProvenance, updated_at: new Date().toISOString() })
    .eq('id', personaId)

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/personas/${personaId}`)
}

export async function deletePersona(personaId: string, projectId: string) {
  const { supabase } = await getClientAndUser()
  await supabase.from('persona').delete().eq('id', personaId)
  revalidatePath(`/projects/${projectId}`)
}

export async function linkPersonaRequirement(
  personaId: string,
  requirementId: string,
  projectId: string
) {
  const { supabase } = await getClientAndUser()
  await supabase
    .from('persona_requirement')
    .upsert(
      { persona_id: personaId, requirement_id: requirementId, link_source: 'manual' },
      { onConflict: 'persona_id,requirement_id' }
    )
  revalidatePath(`/projects/${projectId}/personas/${personaId}`)
}

export async function unlinkPersonaRequirement(
  personaId: string,
  requirementId: string,
  projectId: string
) {
  const { supabase } = await getClientAndUser()
  await supabase
    .from('persona_requirement')
    .delete()
    .eq('persona_id', personaId)
    .eq('requirement_id', requirementId)
  revalidatePath(`/projects/${projectId}/personas/${personaId}`)
}
