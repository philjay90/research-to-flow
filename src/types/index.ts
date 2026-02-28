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
  source_node_id: string
  target_node_id: string
  label: string | null
  created_at: string
}

export type DFVTag = 'desirability' | 'feasibility' | 'viability'
export type RequirementStatus = 'active' | 'draft' | 'stale' | 'unanchored'

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
  created_at: string
  updated_at: string
}
