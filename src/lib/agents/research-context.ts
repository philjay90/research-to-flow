import type { UxResearchBrief, Persona } from '@/types'

export function buildResearchContext(brief: UxResearchBrief | null | undefined): string {
  if (!brief) return ''

  return `## UX Research Context
This project has been enriched by the UX Research Agent. Use this context to inform all persona synthesis, journey generation, and canvas flow decisions.

**App Category:** ${brief.app_category}

**User Archetypes:**
${brief.user_archetypes
  .map(
    (a) =>
      `- ${a.name}: ${a.description}\n  Goals: ${a.primary_goals.join(', ')}\n  Pain points: ${a.typical_pain_points.join(', ')}`
  )
  .join('\n')}

**Competitive Landscape:**
${brief.competitive_landscape
  .map(
    (c) =>
      `- ${c.player}: ${c.positioning}. UX patterns: ${c.notable_ux_patterns.join(', ')}`
  )
  .join('\n')}

**Journey Stage Conventions:** ${brief.journey_stage_conventions.join(' → ')}

**Common Pain Points:** ${brief.common_pain_points.join('; ')}

**UX Pattern Notes:** ${brief.ux_pattern_notes}
`
}

export function buildDesignContext(
  persona: Persona,
  screens: Record<string, unknown>[] | null,
  direction: Record<string, unknown> | null
): string {
  if (!screens || !direction) return ''

  const screenTitles = screens.map((s) => String(s.title ?? '')).join(', ')
  return `## UX Design Context
The UX Design Agent has produced mockup artifacts for persona "${persona.name}" (${persona.role_title}).

**Visual Direction:** style=${String(direction.style ?? '')}, tone=${String(direction.tone ?? '')}, layout=${String(direction.layout_approach ?? '')}

**Screens:** ${screenTitles}

Use this context to inform any follow-up design decisions or content generation.
`
}
