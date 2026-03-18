import type { UxResearchBrief } from '@/types'

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

