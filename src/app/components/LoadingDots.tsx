/**
 * Animated three-dot loading indicator.
 * Uses `bg-current` so it inherits the surrounding text colour,
 * making it usable on any background (dark/light buttons alike).
 */
export function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-[3px]" aria-label="Loading">
      <span
        className="h-[4px] w-[4px] rounded-full bg-current animate-bounce"
        style={{ animationDelay: '0ms', animationDuration: '0.8s' }}
      />
      <span
        className="h-[4px] w-[4px] rounded-full bg-current animate-bounce"
        style={{ animationDelay: '150ms', animationDuration: '0.8s' }}
      />
      <span
        className="h-[4px] w-[4px] rounded-full bg-current animate-bounce"
        style={{ animationDelay: '300ms', animationDuration: '0.8s' }}
      />
    </span>
  )
}
