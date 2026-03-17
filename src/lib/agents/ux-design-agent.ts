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
    // Step 1: Visual Direction (25s hard timeout)
    const directionRes = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
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
    }, { timeout: 25000 })
    const visualDirection = parseJson(directionRes)

    // Step 2: Screen Specs (40s hard timeout)
    const screensRes = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
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
    }, { timeout: 40000 })
    const screens = parseJson(screensRes)

    // Step 3: HTML Prototype (deterministic — built from screen specs, no LLM call)
    const prototypeHtml = buildPrototypeHtml(screens, visualDirection, typedPersona.name)

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

function buildPrototypeHtml(
  screens: unknown[],
  direction: unknown,
  personaName: string
): string {
  const typedScreens = screens as Record<string, unknown>[]
  const dir = direction as Record<string, unknown>

  const screenDivs = typedScreens.map((screen, i) => {
    const components = (Array.isArray(screen.components)
      ? (screen.components as Record<string, unknown>[])
      : []
    )
    const componentHtml = components.map((c) => {
      const label = String(c.label ?? c.type ?? 'Action')
      const type = String(c.type ?? 'button').toLowerCase()
      if (type === 'input' || type === 'text_input' || type === 'search') {
        return `<input class="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300" placeholder="${label}" />`
      }
      if (type === 'text' || type === 'heading' || type === 'label' || type === 'description') {
        return `<p class="text-sm text-gray-600">${label}</p>`
      }
      if (type === 'list' || type === 'list_item') {
        return `<div class="rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-800 shadow-sm">${label}</div>`
      }
      // Default: navigable button
      const nextIdx = i < typedScreens.length - 1 ? i + 1 : i
      return `<button onclick="showScreen(${nextIdx})" class="w-full rounded-full bg-[#1D1D1F] px-5 py-3 text-sm font-semibold text-white hover:bg-black transition-colors">${label}</button>`
    }).join('\n        ')

    const isFirst = i === 0
    return `
  <div id="screen-${i}" class="screen absolute inset-0 flex flex-col" style="display:${isFirst ? 'flex' : 'none'}">
    <div class="flex items-center gap-3 border-b border-gray-100 bg-white px-5 py-4">
      ${i > 0 ? `<button onclick="showScreen(${i - 1})" class="text-gray-500 hover:text-gray-800 text-sm">← Back</button>` : '<div class="w-6"></div>'}
      <p class="flex-1 text-center text-sm font-semibold text-[#1D1D1F]">${String(screen.title ?? `Screen ${i + 1}`)}</p>
      <p class="text-xs text-gray-400">${i + 1}/${typedScreens.length}</p>
    </div>
    <div class="flex-1 overflow-y-auto bg-[#F5F5F7] p-5">
      ${screen.layout ? `<p class="mb-4 text-xs text-gray-500 uppercase tracking-wide">${String(screen.layout)}</p>` : ''}
      <div class="space-y-3">
        ${componentHtml}
      </div>
      ${screen.notes ? `<p class="mt-4 text-xs text-gray-400 italic">${String(screen.notes)}</p>` : ''}
    </div>
  </div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${personaName} – UI Prototype</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { margin: 0; background: #E5E5EA; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .phone { width: 390px; height: 844px; background: white; border-radius: 40px; overflow: hidden; position: relative; box-shadow: 0 25px 60px rgba(0,0,0,0.3); }
    .screen { display: none; }
  </style>
</head>
<body>
  <div>
    <p style="text-align:center;margin-bottom:12px;font-size:12px;color:#86868B;font-family:system-ui">
      ${personaName} · ${String(dir.style ?? '')} · ${typedScreens.length} screens
    </p>
    <div class="phone">
      ${screenDivs}
    </div>
  </div>
  <script>
    function showScreen(idx) {
      document.querySelectorAll('.screen').forEach(function(s) { s.style.display = 'none'; });
      var el = document.getElementById('screen-' + idx);
      if (el) el.style.display = 'flex';
    }
    showScreen(0);
  </script>
</body>
</html>`
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
