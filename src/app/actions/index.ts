'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { anthropic } from '@/lib/anthropic'
import Dagre from '@dagrejs/dagre'

const NODE_W = 220
const NODE_H_STEP = 70
const NODE_H_DECISION = 110

function applyDagreLayout(
  nodes: Array<{ id: string; type: string }>,
  edges: Array<{ source: string; target: string }>
): Map<string, { x: number; y: number }> {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 60 })
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

// ---------------------------------------------------------------------------
// Flow actions
// ---------------------------------------------------------------------------

// generateFlow: asks Claude to interpret all requirements and produce an
// optimal task-flow map. Clears existing nodes/edges first, then saves fresh.
export async function generateFlow(projectId: string) {
  // Fetch all requirements for this project
  const { data: requirements } = await supabase
    .from('requirement')
    .select('business_opportunity, user_story, acceptance_criteria, dfv_tag')
    .eq('project_id', projectId)

  if (!requirements || requirements.length === 0) return { error: 'No requirements to generate from' }

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

  let flow: {
    nodes: Array<{ id: string; type: string; label: string }>
    edges: Array<{ source: string; target: string; label?: string | null }>
  }

  try {
    const cleaned = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    flow = JSON.parse(cleaned)
    if (!flow.nodes || !flow.edges) throw new Error('Invalid shape')
  } catch (e) {
    console.error('Failed to parse Claude flow response:', responseText, e)
    return { error: 'Failed to parse flow from Claude' }
  }

  // Compute clean layout with dagre — ignore any coordinates from Claude
  const positions = applyDagreLayout(flow.nodes, flow.edges)

  // Clear existing flow data for this project
  await supabase.from('flow_edge').delete().eq('project_id', projectId)
  await supabase.from('flow_node').delete().eq('project_id', projectId)

  // Insert new nodes and collect their real DB IDs
  const nodeIdMap = new Map<string, string>() // tempId → real UUID

  for (const node of flow.nodes) {
    const pos = positions.get(node.id) ?? { x: 0, y: 0 }
    const { data, error } = await supabase
      .from('flow_node')
      .insert({
        project_id: projectId,
        requirement_id: null,
        type: node.type,
        label: node.label,
        position_x: pos.x,
        position_y: pos.y,
      })
      .select('id')
      .single()

    if (!error && data) {
      nodeIdMap.set(node.id, data.id)
    }
  }

  // Insert edges using real UUIDs
  const edgeRows = flow.edges
    .map((e) => {
      const sourceId = nodeIdMap.get(e.source)
      const targetId = nodeIdMap.get(e.target)
      if (!sourceId || !targetId) return null
      return { project_id: projectId, source_node_id: sourceId, target_node_id: targetId, label: e.label ?? null }
    })
    .filter(Boolean)

  if (edgeRows.length > 0) {
    await supabase.from('flow_edge').insert(edgeRows)
  }

  return { success: true }
}

export async function saveNodePosition(nodeId: string, x: number, y: number) {
  await supabase
    .from('flow_node')
    .update({ position_x: x, position_y: y })
    .eq('id', nodeId)
}

export async function saveEdge(projectId: string, sourceNodeId: string, targetNodeId: string) {
  const { data, error } = await supabase
    .from('flow_edge')
    .insert({ project_id: projectId, source_node_id: sourceNodeId, target_node_id: targetNodeId })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to save edge:', error)
    return null
  }
  return data?.id ?? null
}

export async function deleteEdge(edgeId: string) {
  await supabase.from('flow_edge').delete().eq('id', edgeId)
}
