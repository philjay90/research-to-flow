export type ResearchInputType =
  | 'interview_notes'
  | 'transcript'
  | 'screenshot'
  | 'business_requirements'
  | 'other'

export interface Project {
  id: string
  name: string
  description: string | null
  journey_stages: string[] | null
  created_at: string
  updated_at: string
}

export interface Flow {
  id: string
  project_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface ResearchInput {
  id: string
  project_id: string
  flow_id: string | null
  type: ResearchInputType
  content: string
  source_label: string | null
  attachment_url: string | null
  created_at: string
  updated_at: string
}

export interface FlowNode {
  id: string
  project_id: string
  flow_id: string | null
  persona_id: string | null
  requirement_id: string | null
  type: string
  label: string
  position_x: number
  position_y: number
  created_at: string
  updated_at: string
}

export interface FlowEdge {
  id: string
  project_id: string
  flow_id: string | null
  persona_id: string | null
  source_node_id: string
  target_node_id: string
  label: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Persona types
// ---------------------------------------------------------------------------

export type PersonaFieldSource = 'data' | 'llm_inferred' | 'manual'

export interface PersonaFieldProvenance {
  source: PersonaFieldSource
  input_ids: string[]
}

export interface Persona {
  id: string
  project_id: string
  user_id: string
  name: string
  role_title: string
  background: string
  tools: string
  macro_goals: string
  tasks_activities: string
  pain_points: string
  /** { fieldName: { source, input_ids } } */
  field_provenance: Record<string, PersonaFieldProvenance>
  source_input_ids: string[]
  status: string
  created_at: string
  updated_at: string
}

export interface PersonaRequirement {
  persona_id: string
  requirement_id: string
  link_source: 'llm' | 'manual'
}

// ---------------------------------------------------------------------------
// Requirement types
// ---------------------------------------------------------------------------

export type DFVTag = 'desirability' | 'feasibility' | 'viability'
export type RequirementStatus = 'active' | 'draft' | 'stale' | 'unanchored' | 'edited'

export interface Requirement {
  id: string
  project_id: string
  flow_id: string | null
  source_input_ids: string[]
  business_opportunity: string
  user_story: string
  acceptance_criteria: string[]
  dfv_tag: DFVTag | null
  status: RequirementStatus
  journey_stage: string | null
  created_at: string
  updated_at: string
}
