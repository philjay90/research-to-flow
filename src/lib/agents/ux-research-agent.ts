import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase'
import type { UxResearchBrief } from '@/types'

const anthropic = new Anthropic()

export async function runUxResearchAgent({
  projectId,
  name,
  description,
}: {
  projectId: string
  name: string
  description: string | null
}) {
  const supabase = await createClient()

  await supabase
    .from('project')
    .update({ research_status: 'running' })
    .eq('id', projectId)

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 2000,
      system: `You are a senior UX researcher. Given a product name and description, produce a structured UX intelligence brief in valid JSON only. No preamble, no markdown, no explanation — raw JSON only.

The JSON must conform exactly to this shape:
{
  "app_category": string,
  "user_archetypes": [{ "name": string, "description": string, "primary_goals": [string], "typical_pain_points": [string] }],
  "competitive_landscape": [{ "player": string, "positioning": string, "notable_ux_patterns": [string] }],
  "journey_stage_conventions": [string],
  "common_pain_points": [string],
  "ux_pattern_notes": string,
  "generated_at": string (ISO timestamp)
}`,
      messages: [
        {
          role: 'user',
          content: `Product name: ${name}
${description ? `Description: ${description}` : ''}

Research this product category thoroughly. Cover:
1. What category of app this is and the competitive landscape — who the established players are, what user archetypes they serve, and how they position themselves
2. UX pattern intelligence — common user pain points in this category, established journey stage conventions, known UX patterns and design conventions, and common friction points in competing experiences

Return only the JSON brief.`,
        },
      ],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const brief: UxResearchBrief = JSON.parse(cleaned)
    brief.generated_at = new Date().toISOString()

    await supabase
      .from('project')
      .update({ ux_research_brief: brief, research_status: 'complete' })
      .eq('id', projectId)
  } catch (error) {
    console.error('UX Research Agent failed:', error)
    await supabase
      .from('project')
      .update({ research_status: 'failed' })
      .eq('id', projectId)
  }
}

export async function reviewUxResearchAgent({
  projectId,
  name,
  description,
  existingBrief,
}: {
  projectId: string
  name: string
  description: string | null
  existingBrief: UxResearchBrief
}) {
  const supabase = await createClient()

  await supabase
    .from('project')
    .update({ research_status: 'running' })
    .eq('id', projectId)

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 2000,
      system: `You are a senior UX researcher. You will be given an existing UX intelligence brief and updated product information. Review the brief and adjust only the sections that are materially affected by the updated product name or description. If the core category, archetypes, and patterns still hold, leave them unchanged. Return the full updated brief as raw JSON only — no preamble, no markdown, no explanation.

The JSON must conform exactly to this shape:
{
  "app_category": string,
  "user_archetypes": [{ "name": string, "description": string, "primary_goals": [string], "typical_pain_points": [string] }],
  "competitive_landscape": [{ "player": string, "positioning": string, "notable_ux_patterns": [string] }],
  "journey_stage_conventions": [string],
  "common_pain_points": [string],
  "ux_pattern_notes": string,
  "generated_at": string (ISO timestamp)
}`,
      messages: [
        {
          role: 'user',
          content: `Updated product name: ${name}
${description ? `Updated description: ${description}` : ''}

Existing research brief:
${JSON.stringify(existingBrief, null, 2)}

Review the brief above. Update only what has genuinely changed given the updated product information. Return the full brief as raw JSON.`,
        },
      ],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const brief: UxResearchBrief = JSON.parse(cleaned)
    brief.generated_at = new Date().toISOString()

    await supabase
      .from('project')
      .update({ ux_research_brief: brief, research_status: 'complete' })
      .eq('id', projectId)
  } catch (error) {
    console.error('UX Research Review Agent failed:', error)
    await supabase
      .from('project')
      .update({ research_status: 'failed' })
      .eq('id', projectId)
  }
}
