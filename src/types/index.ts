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

export interface ResearchInput {
  id: string
  project_id: string
  type: ResearchInputType
  content: string
  source_label: string | null
  created_at: string
  updated_at: string
}
