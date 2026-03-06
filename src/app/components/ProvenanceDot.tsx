import type { PersonaFieldSource } from '@/types'

interface ProvenanceDotProps {
  source: PersonaFieldSource
}

const CONFIG: Record<PersonaFieldSource, { color: string; label: string }> = {
  data:         { color: 'bg-emerald-500', label: 'From data' },
  llm_inferred: { color: 'bg-amber-400',   label: 'LLM inferred' },
  manual:       { color: 'bg-blue-500',    label: 'Manually edited' },
}

export function ProvenanceDot({ source }: ProvenanceDotProps) {
  const { color, label } = CONFIG[source] ?? CONFIG.llm_inferred
  return (
    <span
      title={label}
      className={`inline-block h-2 w-2 rounded-full shrink-0 ${color}`}
      aria-label={label}
    />
  )
}

/** Legend bar — render once per section */
export function ProvenanceLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-[#86868B]">
      {(Object.entries(CONFIG) as [PersonaFieldSource, { color: string; label: string }][]).map(
        ([, { color, label }]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full shrink-0 ${color}`} />
            {label}
          </span>
        )
      )}
    </div>
  )
}
