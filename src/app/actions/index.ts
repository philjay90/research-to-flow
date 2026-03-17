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

// ── Journey swim-lane layout constants ────────────────────────────────────────
// These must stay in sync with LANE_HEADER_W / CROSS_FORWARD_THRESHOLD in FlowCanvas.tsx
const COLUMN_W = 300        // column content width (px)
const COLUMN_GAP = 160      // horizontal gap between columns — wide enough for edge routing
const COLUMN_TOTAL = COLUMN_W + COLUMN_GAP
const CONTENT_START_Y = 120 // Y where flow nodes begin (below the lane header)

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

/**
 * Stage-aware left-to-right layout.
 * Each journey stage becomes a column; within a column dagre orders nodes top-to-bottom.
 */
function applyJourneyLayout(
  nodes: Array<{ id: string; type: string; stage: string | null }>,
  edges: Array<{ source: string; target: string }>,
  stages: string[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()

  // Group by stage
  const stageGroups = new Map<string, Array<{ id: string; type: string }>>()
  const unassigned: Array<{ id: string; type: string }> = []

  for (const node of nodes) {
    const idx = node.stage ? stages.indexOf(node.stage) : -1
    if (idx >= 0) {
      if (!stageGroups.has(stages[idx])) stageGroups.set(stages[idx], [])
      stageGroups.get(stages[idx])!.push(node)
    } else {
      unassigned.push(node)
    }
  }

  // Only include stages that have nodes; append unassigned at the end
  const occupiedStages = stages.filter((s) => stageGroups.has(s))
  if (unassigned.length > 0) occupiedStages.push('__unassigned__')

  occupiedStages.forEach((stage, colIdx) => {
    const colNodes = stage === '__unassigned__' ? unassigned : (stageGroups.get(stage) ?? [])
    const colX = colIdx * COLUMN_TOTAL
    if (colNodes.length === 0) return

    // Use dagre for within-column ordering
    const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
    g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 40 })

    colNodes.forEach((n) => {
      g.setNode(n.id, { width: NODE_W, height: n.type === 'decision' ? NODE_H_DECISION : NODE_H_STEP })
    })

    const colNodeIds = new Set(colNodes.map((n) => n.id))
    edges.forEach((e) => {
      if (colNodeIds.has(e.source) && colNodeIds.has(e.target)) {
        try { g.setEdge(e.source, e.target) } catch { /* skip cycles */ }
      }
    })

    Dagre.layout(g)

    colNodes.forEach((n) => {
      const pos = g.node(n.id)
      if (!pos) return
      const h = n.type === 'decision' ? NODE_H_DECISION : NODE_H_STEP
      positions.set(n.id, {
        x: colX + (COLUMN_W - NODE_W) / 2,  // centre node in its column
        y: CONTENT_START_Y + (pos.y - h / 2),
      })
    })
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
  const flowId = (formData.get('flow_id') as string) || null
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

  revalidatePath(`/projects/${projectId}`)
  if (flowId) revalidatePath(`/projects/${projectId}/flows/${flowId}`)
}

export async function deleteResearchInput(inputId: string, projectId: string, flowId?: string | null) {
  const { supabase } = await getClientAndUser()
  await supabase.from('research_input').delete().eq('id', inputId)
  revalidatePath(`/projects/${projectId}`)
  if (flowId) revalidatePath(`/projects/${projectId}/flows/${flowId}`)
}

export async function deleteAllFlowInputs(personaId: string, projectId: string) {
  const { supabase } = await getClientAndUser()
  await supabase.from('research_input').delete().eq('flow_id', personaId)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/flows/${personaId}`)
}

export async function updateResearchInput(
  inputId: string,
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
  revalidatePath(`/projects/${projectId}`)
}

export async function deleteAllInputs(projectId: string) {
  const { supabase } = await getClientAndUser()
  await supabase.from('research_input').delete().eq('project_id', projectId)
  revalidatePath(`/projects/${projectId}`)
}

// ---------------------------------------------------------------------------
// Requirement actions
// ---------------------------------------------------------------------------

export async function synthesiseInput(
  inputId: string,
  projectId: string,
  mode: 'append' | 'replace' = 'append'
) {
  const { supabase, user } = await getClientAndUser()
  if (!user || !inputId || !projectId) return

  if (mode === 'replace') {
    const { data: existingReqs } = await supabase
      .from('requirement')
      .select('id, source_input_ids')
      .eq('project_id', projectId)

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
    flow_id: null,
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

  revalidatePath(`/projects/${projectId}`)
}

export async function deleteRequirement(requirementId: string, projectId: string) {
  const { supabase } = await getClientAndUser()
  await supabase.from('requirement').delete().eq('id', requirementId)
  revalidatePath(`/projects/${projectId}`)
}

export async function updateRequirement(
  requirementId: string,
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
  revalidatePath(`/projects/${projectId}`)
}

export async function deleteAllRequirements(projectId: string) {
  const { supabase } = await getClientAndUser()
  await supabase.from('requirement').delete().eq('project_id', projectId)
  revalidatePath(`/projects/${projectId}`)
}

// ---------------------------------------------------------------------------
// Canvas actions
// ---------------------------------------------------------------------------

export async function generateFlow(projectId: string, personaId?: string | null) {
  const { supabase, user } = await getClientAndUser()
  if (!user) return { error: 'Not authenticated' }

  // Fetch project's journey stages (if set, we'll use swim-lane layout)
  const { data: projectData } = await supabase
    .from('project')
    .select('journey_stages')
    .eq('id', projectId)
    .single()
  const journeyStages: string[] = (projectData?.journey_stages as string[] | null) ?? []
  const hasStages = journeyStages.length > 0

  // If a persona is selected, fetch only requirements linked to that persona
  let requirementsQuery = supabase
    .from('requirement')
    .select('id, business_opportunity, user_story, acceptance_criteria, dfv_tag, journey_stage')
    .eq('project_id', projectId)

  if (personaId) {
    const { data: linkedReqs } = await supabase
      .from('persona_requirement')
      .select('requirement_id')
      .eq('persona_id', personaId)

    const linkedIds = (linkedReqs ?? []).map((r: { requirement_id: string }) => r.requirement_id)
    if (linkedIds.length > 0) {
      requirementsQuery = requirementsQuery.in('id', linkedIds)
    } else {
      return { error: 'This persona has no linked requirements. Link some requirements first.' }
    }
  }

  const { data: requirements } = await requirementsQuery

  if (!requirements || requirements.length === 0) return { error: 'No requirements to generate from' }

  // Fetch persona context if selected
  let personaContext = ''
  if (personaId) {
    const { data: persona } = await supabase
      .from('persona')
      .select('name, role_title, background, macro_goals, pain_points')
      .eq('id', personaId)
      .single()

    if (persona) {
      personaContext = `\nPERSONA CONTEXT:
Name: ${persona.name}
Role: ${persona.role_title}
Background: ${persona.background}
Goals: ${persona.macro_goals}
Pain points: ${persona.pain_points}

Design the flow specifically for this persona.\n`
    }
  }

  const requirementsSummary = requirements
    .map((r: { id: string; business_opportunity: string; user_story: string; acceptance_criteria: string[]; dfv_tag: string | null; journey_stage: string | null }, i: number) =>
      `Requirement ${i + 1} (id: "${r.id}"):
  Journey stage: ${r.journey_stage ?? 'unassigned'}
  Business opportunity: ${r.business_opportunity}
  User story: ${r.user_story}
  Acceptance criteria: ${r.acceptance_criteria.join(' | ')}
  DFV: ${r.dfv_tag ?? 'unclassified'}`
    )
    .join('\n\n')

  // Build the stage-assignment section of the prompt (only when stages exist)
  const stagePromptSection = hasStages ? `
SWIM-LANE LAYOUT:
This flow is organised as a left-to-right grid with one column per journey stage (in order):
${journeyStages.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}

Every node MUST include a "stage" field set to one of these stage names EXACTLY (case-sensitive).
Use the requirements' "Journey stage" field as the primary guide for which stage a node belongs to.
The overall flow should progress left-to-right across stages. Within each stage, steps flow top-to-bottom.
Cross-stage edges (e.g. a step in Stage 1 connecting to a step in Stage 2) are expected.

Valid stage values: ${journeyStages.map((s) => `"${s}"`).join(', ')}

Return ONLY a JSON object with this exact shape. No explanation, no markdown, no code fences:
{
  "nodes": [
    { "id": "n1", "type": "step",     "label": "...", "stage": "${journeyStages[0]}", "requirement_id": "<uuid from requirements list or null>" },
    { "id": "n2", "type": "decision", "label": "...?", "stage": "${journeyStages[0]}", "requirement_id": null }
  ],
  "edges": [
    { "source": "n1", "target": "n2", "label": null },
    { "source": "n2", "target": "n3", "label": "Yes" },
    { "source": "n2", "target": "n4", "label": "No" }
  ]
}` : `
Return ONLY a JSON object with this exact shape. No explanation, no markdown, no code fences:
{
  "nodes": [
    { "id": "n1", "type": "step",     "label": "...", "requirement_id": "<uuid from requirements list or null>" },
    { "id": "n2", "type": "decision", "label": "...?", "requirement_id": null }
  ],
  "edges": [
    { "source": "n1", "target": "n2", "label": null },
    { "source": "n2", "target": "n3", "label": "Yes" },
    { "source": "n2", "target": "n4", "label": "No" }
  ]
}`

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are a UX/product designer creating a task-flow diagram from a set of product requirements.
${personaContext}
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
- Each node MUST include a "requirement_id" field: set it to the UUID of the most relevant requirement from the list above (use the exact id string). If a node doesn't map directly to any single requirement, set it to null
${stagePromptSection}

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
    nodes: Array<{ id: string; type: string; label: string; stage?: string | null; requirement_id?: string | null }>
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

  // Choose layout: journey swim-lanes or fallback linear dagre
  const positions = hasStages
    ? applyJourneyLayout(
        flowData.nodes.map((n) => ({ id: n.id, type: n.type, stage: n.stage ?? null })),
        flowData.edges,
        journeyStages
      )
    : applyDagreLayout(flowData.nodes, flowData.edges)

  // Delete old lane headers (always rebuilt from current journey stages)
  await supabase
    .from('flow_node')
    .delete()
    .eq('project_id', projectId)
    .eq('type', 'laneHeader')
    .is('flow_id', null)

  // Delete the flow nodes/edges for this persona selection
  const edgeDelQ = supabase.from('flow_edge').delete().eq('project_id', projectId).is('flow_id', null)
  const nodeDelQ = supabase.from('flow_node').delete().eq('project_id', projectId).is('flow_id', null)
  if (personaId) {
    await edgeDelQ.eq('persona_id', personaId)
    await nodeDelQ.eq('persona_id', personaId)
  } else {
    await edgeDelQ.is('persona_id', null)
    await nodeDelQ.is('persona_id', null)
  }

  // Build a set of valid requirement IDs to guard against Claude hallucinating UUIDs
  const validReqIds = new Set((requirements ?? []).map((r: { id: string }) => r.id))

  // Insert flow nodes
  const nodeIdMap = new Map<string, string>()
  for (const node of flowData.nodes) {
    const pos = positions.get(node.id) ?? { x: 0, y: 0 }
    const reqId = node.requirement_id && validReqIds.has(node.requirement_id)
      ? node.requirement_id
      : null
    const { data, error } = await supabase
      .from('flow_node')
      .insert({
        project_id: projectId,
        flow_id: null,
        persona_id: personaId ?? null,
        requirement_id: reqId,
        type: node.type,
        label: node.label,
        position_x: pos.x,
        position_y: pos.y,
        user_id: user.id,
      })
      .select('id')
      .single()
    if (!error && data) nodeIdMap.set(node.id, data.id)
  }

  // Insert edges
  const edgeRows = flowData.edges
    .map((e) => {
      const sourceId = nodeIdMap.get(e.source)
      const targetId = nodeIdMap.get(e.target)
      if (!sourceId || !targetId) return null
      return {
        project_id: projectId,
        flow_id: null,
        persona_id: personaId ?? null,
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

  // Create lane header nodes for each stage that received at least one node
  if (hasStages) {
    const assignedStages = new Set(flowData.nodes.map((n) => n.stage).filter(Boolean))
    for (let i = 0; i < journeyStages.length; i++) {
      const stage = journeyStages[i]
      if (!assignedStages.has(stage)) continue
      await supabase.from('flow_node').insert({
        project_id: projectId,
        flow_id: null,
        persona_id: null,   // Lane headers are project-level (shown for all persona views)
        requirement_id: null,
        type: 'laneHeader',
        label: stage,
        position_x: i * COLUMN_TOTAL,
        position_y: 0,
        user_id: user.id,
      })
    }
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

export async function saveEdge(
  projectId: string,
  sourceNodeId: string,
  targetNodeId: string,
  personaId?: string | null,
) {
  const { supabase, user } = await getClientAndUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('flow_edge')
    .insert({
      project_id: projectId,
      flow_id: null,
      persona_id: personaId ?? null,
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

For multiline fields (background, tools, macro_goals, tasks_activities, pain_points), write each distinct point or item on its own line. Do not use bullet characters, hyphens, or numbers — just plain text lines separated by \\n.

Return ONLY a JSON array. No explanation, no markdown, no code fences. Each element must have this exact shape:
{
  "existing_persona_id": "uuid-or-null",
  "name": "First name or persona name",
  "role_title": "Job title or role",
  "background": "Line 1 about background\\nLine 2 about background",
  "tools": "Tool A\\nTool B\\nTool C",
  "macro_goals": "Goal 1\\nGoal 2",
  "tasks_activities": "Task 1\\nTask 2\\nTask 3",
  "pain_points": "Pain point 1\\nPain point 2",
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

// ---------------------------------------------------------------------------
// Create an empty persona/flow (used by "Add Flow" at project level)
// ---------------------------------------------------------------------------

export async function createEmptyPersona(projectId: string): Promise<{ id?: string; error?: string }> {
  const { supabase, user } = await getClientAndUser()
  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('persona')
    .insert({
      project_id: projectId,
      user_id: user.id,
      name: 'New Flow',
      role_title: '',
      background: '',
      tools: '',
      macro_goals: '',
      tasks_activities: '',
      pain_points: '',
      field_provenance: {},
      source_input_ids: [],
      status: 'active',
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('Failed to create flow:', error)
    return { error: 'Failed to create flow' }
  }

  revalidatePath(`/projects/${projectId}`)
  return { id: data.id }
}

// ---------------------------------------------------------------------------
// Synthesize a single flow's persona from its own inputs
// ---------------------------------------------------------------------------

export async function synthesizeFlow(
  projectId: string,
  personaId: string,
  overwriteManual = false
): Promise<{ error?: string; success?: boolean }> {
  const { supabase, user } = await getClientAndUser()
  if (!user) return { error: 'Not authenticated' }

  // Inputs scoped to this flow
  const { data: inputs } = await supabase
    .from('research_input')
    .select('id, type, content, source_label')
    .eq('project_id', projectId)
    .eq('flow_id', personaId)

  if (!inputs || inputs.length === 0) {
    return { error: 'No inputs found for this flow. Add inputs first.' }
  }

  // Existing persona to update
  const { data: persona } = await supabase
    .from('persona')
    .select('*')
    .eq('id', personaId)
    .single()

  if (!persona) return { error: 'Flow not found' }

  // All project requirements (for linking)
  const { data: requirements } = await supabase
    .from('requirement')
    .select('id, user_story, business_opportunity, dfv_tag')
    .eq('project_id', projectId)

  const inputsSummary = inputs
    .map(
      (inp) =>
        `[Input ID: ${inp.id}]\nType: ${inp.type}${inp.source_label ? `\nSource: ${inp.source_label}` : ''}\nContent: ${inp.content}`
    )
    .join('\n\n---\n\n')

  const requirementsSummary =
    requirements && requirements.length > 0
      ? requirements
          .map(
            (r) =>
              `[Requirement ID: ${r.id}]\nUser story: ${r.user_story}\nBusiness opportunity: ${r.business_opportunity}\nDFV: ${r.dfv_tag ?? 'unclassified'}`
          )
          .join('\n\n')
      : 'No requirements yet.'

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are a UX researcher updating a user persona from research data.

Analyse the research inputs below and update the persona's fields accordingly.

RULES:
- Update all fields based on the research inputs provided
- For field_provenance, set source to "data" if the value is directly stated in the research, or "llm_inferred" if you are inferring it
- source_input_ids: list the Input IDs that informed this persona
- requirement_ids: list Requirement IDs most relevant to this persona

For multiline fields (background, tools, macro_goals, tasks_activities, pain_points), write each distinct point or item on its own line. Do not use bullet characters, hyphens, or numbers — just plain text lines separated by \\n.

Return ONLY a JSON object (not an array). No explanation, no markdown, no code fences. The object must have this exact shape:
{
  "name": "First name or persona name",
  "role_title": "Job title or role",
  "background": "Line 1\\nLine 2",
  "tools": "Tool A\\nTool B",
  "macro_goals": "Goal 1\\nGoal 2",
  "tasks_activities": "Task 1\\nTask 2",
  "pain_points": "Pain point 1\\nPain point 2",
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
${requirementsSummary}`,
      },
    ],
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

  type PersonaResult = {
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

  let result: PersonaResult

  try {
    const cleaned = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    result = JSON.parse(cleaned)
  } catch (e) {
    console.error('Failed to parse Claude flow synthesis response:', responseText, e)
    return { error: 'Failed to parse synthesis result from Claude' }
  }

  // Merge provenance — preserve manually-edited fields
  const existingProvenance: Record<string, { source: string; input_ids: string[] }> =
    persona.field_provenance ?? {}

  const updates: Record<string, unknown> = {
    source_input_ids: result.source_input_ids,
    updated_at: new Date().toISOString(),
  }
  const newProvenance = { ...existingProvenance }

  for (const field of PERSONA_FIELDS) {
    if (!overwriteManual && existingProvenance[field]?.source === 'manual') {
      // Preserve manually edited fields unless the caller opts to overwrite
    } else {
      updates[field] = result[field as keyof PersonaResult]
      newProvenance[field] = result.field_provenance[field] ?? { source: 'llm_inferred', input_ids: [] }
    }
  }
  updates.field_provenance = newProvenance

  await supabase.from('persona').update(updates).eq('id', personaId)

  // Update requirement links
  if (result.requirement_ids?.length > 0) {
    await supabase
      .from('persona_requirement')
      .delete()
      .eq('persona_id', personaId)
      .eq('link_source', 'llm')

    const reqLinks = result.requirement_ids.map((reqId) => ({
      persona_id: personaId,
      requirement_id: reqId,
      link_source: 'llm',
    }))
    await supabase.from('persona_requirement').upsert(reqLinks, { onConflict: 'persona_id,requirement_id' })
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/flows/${personaId}`)
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
  revalidatePath(`/projects/${projectId}`)
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
  revalidatePath(`/projects/${projectId}`)
}

// ---------------------------------------------------------------------------
// Journey inference
// ---------------------------------------------------------------------------

export async function inferJourney(
  projectId: string
): Promise<{ error?: string; stages?: string[] }> {
  const { supabase, user } = await getClientAndUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: inputs } = await supabase
    .from('research_input')
    .select('id, type, content, source_label')
    .eq('project_id', projectId)

  if (!inputs || inputs.length === 0) {
    return { error: 'No research inputs found for this project.' }
  }

  const { data: requirements } = await supabase
    .from('requirement')
    .select('id, user_story, business_opportunity')
    .eq('project_id', projectId)

  if (!requirements || requirements.length === 0) {
    return { error: 'No requirements found. Generate requirements first.' }
  }

  const inputsSummary = inputs
    .map(
      (inp) =>
        `[Input ID: ${inp.id}]
Type: ${inp.type}${inp.source_label ? `\nSource: ${inp.source_label}` : ''}
Content: ${inp.content}`
    )
    .join('\n\n---\n\n')

  const requirementsSummary = requirements
    .map(
      (r) =>
        `[Requirement ID: ${r.id}]
User story: ${r.user_story}
Business opportunity: ${r.business_opportunity}`
    )
    .join('\n\n')

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are a UX researcher mapping user requirements onto a task-context journey.

Your goal is to define 3–5 stage names that describe the situational context AROUND using this product — not a customer lifecycle, but the real-world scenario a user is in before they open the app, while they are using it, and after they put it down.

For example, for a grocery list app the stages might be: "Planning the Shop", "At the Supermarket", "Back Home".
For a fitness app: "Preparing for a Workout", "During the Workout", "Post-Workout Recovery".

RULES:
- Stage names should be short (2–5 words), descriptive, and specific to THIS product's context
- Define between 3 and 5 stages
- Every requirement must be assigned to exactly one stage
- Respond with ONLY a JSON object matching this schema — no markdown, no explanation:
{
  "stages": ["Stage A", "Stage B", "Stage C"],
  "assignments": [
    { "requirement_id": "<uuid>", "stage": "<one of the stage names>" }
  ]
}

RESEARCH INPUTS:
${inputsSummary}

USER REQUIREMENTS:
${requirementsSummary}`,
      },
    ],
  })

  const rawText = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  // Strip markdown code fences if present (e.g. ```json ... ```)
  const raw = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  let parsed: { stages: string[]; assignments: { requirement_id: string; stage: string }[] }
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { error: 'Failed to parse journey response from AI.' }
  }

  // Persist stage names on the project
  await supabase
    .from('project')
    .update({ journey_stages: parsed.stages })
    .eq('id', projectId)

  // Batch-update each requirement's journey_stage
  await Promise.all(
    parsed.assignments.map(({ requirement_id, stage }) =>
      supabase
        .from('requirement')
        .update({ journey_stage: stage })
        .eq('id', requirement_id)
        .eq('project_id', projectId)
    )
  )

  revalidatePath(`/projects/${projectId}`)
  return { stages: parsed.stages }
}

export async function updateRequirementStage(
  requirementId: string,
  stage: string | null,
  projectId: string
) {
  const { supabase } = await getClientAndUser()
  await supabase
    .from('requirement')
    .update({ journey_stage: stage })
    .eq('id', requirementId)
  revalidatePath(`/projects/${projectId}`)
}

export async function renameStage(
  projectId: string,
  oldName: string,
  newName: string
) {
  const { supabase } = await getClientAndUser()

  // Update the stage name in the project's journey_stages array
  const { data: project } = await supabase
    .from('project')
    .select('journey_stages')
    .eq('id', projectId)
    .single()

  if (!project?.journey_stages) return

  const updatedStages = (project.journey_stages as string[]).map((s) =>
    s === oldName ? newName : s
  )

  await supabase
    .from('project')
    .update({ journey_stages: updatedStages })
    .eq('id', projectId)

  // Rename the stage on all requirements that had the old name
  await supabase
    .from('requirement')
    .update({ journey_stage: newName })
    .eq('project_id', projectId)
    .eq('journey_stage', oldName)

  revalidatePath(`/projects/${projectId}`)
}
