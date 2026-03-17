import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase'
import { computeCanvasHash } from './canvas-hash'
import { DESIGN_SYSTEMS_KB } from './design-systems'
import type { FlowNode, FlowEdge, Persona, Requirement } from '@/types'

const anthropic = new Anthropic()

export async function runUxDesignAgent({
  projectId,
  personaId,
}: {
  projectId: string
  personaId: string
}) {
  const supabase = await createClient()

  const [{ data: persona }, { data: nodes }, { data: edges }, { data: requirements }] =
    await Promise.all([
      supabase.from('persona').select('*').eq('id', personaId).single(),
      supabase.from('flow_node').select('*').eq('project_id', projectId).is('flow_id', null),
      supabase.from('flow_edge').select('*').eq('project_id', projectId).is('flow_id', null),
      supabase.from('requirement').select('*').eq('project_id', projectId),
    ])

  if (!persona) return

  const typedPersona = persona as Persona
  const typedNodes = (nodes ?? []) as FlowNode[]
  const typedEdges = (edges ?? []) as FlowEdge[]
  const typedReqs = (requirements ?? []) as Requirement[]

  await supabase.from('persona').update({ mockup_status: 'running' }).eq('id', personaId)

  const canvasHash = computeCanvasHash(typedNodes, typedEdges)
  const canvasSummary = buildCanvasSummary(typedNodes, typedReqs)
  const personaSummary = buildPersonaSummary(typedPersona)

  try {
    // Step 1: Visual Direction
    const directionRes = await anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 1000,
      system: DESIGN_SYSTEMS_KB,
      messages: [
        {
          role: 'user',
          content: `Given this persona and user flow, define a visual design direction. Return raw JSON only — no markdown, no preamble.

Persona: ${personaSummary}

Canvas flow:
${canvasSummary}

Return JSON: { "style": string, "color_emphasis": string, "layout_approach": string, "key_ui_patterns": [string], "tone": string }`,
        },
      ],
    })
    const visualDirection = parseJson(directionRes)

    // Step 2: Screen Specs
    const screensRes = await anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 2000,
      system: DESIGN_SYSTEMS_KB,
      messages: [
        {
          role: 'user',
          content: `Generate UI screen specifications for each meaningful step in this user flow. Return raw JSON array only — no markdown, no preamble.

Canvas flow:
${canvasSummary}

Visual direction: ${JSON.stringify(visualDirection)}

Return JSON array: [{ "screen_id": string, "title": string, "layout": string, "components": [{ "type": string, "label": string, "action": string }], "notes": string }]`,
        },
      ],
    })
    const screens = parseJson(screensRes)

    // Step 3: HTML Prototype
    const protoRes = await anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 4000,
      system: DESIGN_SYSTEMS_KB,
      messages: [
        {
          role: 'user',
          content: `Generate a single-file HTML prototype implementing the screen specs using Tailwind CSS CDN. All screens navigable via buttons. No external images. Return ONLY the raw HTML string — no JSON wrapper, no markdown code block.

Screens: ${JSON.stringify(screens)}
Visual direction: ${JSON.stringify(visualDirection)}
Persona name: ${typedPersona.name}`,
        },
      ],
    })
    const prototypeHtml = protoRes.content[0].type === 'text' ? protoRes.content[0].text : ''

    // Step 4: Figma JSON (deterministic — no LLM call)
    const figmaJson = buildFigmaJson(screens, visualDirection, typedPersona.name)

    await supabase
      .from('persona')
      .update({
        mockup_status: 'complete',
        mockup_visual_direction: visualDirection,
        mockup_screens: screens,
        mockup_prototype_html: prototypeHtml,
        mockup_figma_json: figmaJson,
        mockup_canvas_hash: canvasHash,
        mockup_pending_diff: false,
      })
      .eq('id', personaId)
  } catch (error) {
    console.error('UX Design Agent failed:', error)
    await supabase.from('persona').update({ mockup_status: 'failed' }).eq('id', personaId)
  }
}

function parseJson(res: Anthropic.Message) {
  const raw = res.content[0].type === 'text' ? res.content[0].text : '{}'
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  return JSON.parse(cleaned)
}

function buildPersonaSummary(p: Persona): string {
  return `Name: ${p.name}, Role: ${p.role_title}\nGoals: ${p.macro_goals}\nPain points: ${p.pain_points}`
}

function buildCanvasSummary(nodes: FlowNode[], reqs: Requirement[]): string {
  const reqMap = new Map(reqs.map((r) => [r.id, r]))
  return nodes
    .filter((n) => n.type !== 'laneHeader')
    .map((n) => {
      const req = n.requirement_id ? reqMap.get(n.requirement_id) : null
      return `[${n.type}] ${n.label}${req ? ` (${req.user_story})` : ''}`
    })
    .join('\n')
}

function buildFigmaJson(
  screens: unknown[],
  direction: unknown,
  personaName: string
): Record<string, unknown> {
  return {
    document: {
      id: 'root',
      name: `${personaName} – UX Mockup`,
      type: 'DOCUMENT',
      children: (screens as Record<string, unknown>[]).map((screen, i) => ({
        id: `frame-${i}`,
        name: String(screen.title ?? `Screen ${i + 1}`),
        type: 'FRAME',
        absoluteBoundingBox: { x: i * 420, y: 0, width: 390, height: 844 },
        backgroundColor: { r: 0.96, g: 0.96, b: 0.97, a: 1 },
        children: [],
      })),
    },
    schemaVersion: 0,
    styles: {},
    direction,
  }
}
