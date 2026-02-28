import Link from 'next/link'

interface Crumb {
  label: string
  href?: string
}

interface AppHeaderProps {
  crumbs?: Crumb[]
  /** Optional right-side content (e.g. action buttons) */
  right?: React.ReactNode
}

export function AppHeader({ crumbs = [], right }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between bg-[#19323C] px-6 py-4">
      <nav className="flex items-center gap-2 text-sm">
        <Link href="/" className="font-semibold text-white tracking-tight hover:text-white/80 transition-colors">
          Research-to-Flow
        </Link>
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="text-white/30">/</span>
            {crumb.href ? (
              <Link href={crumb.href} className="text-white/70 hover:text-white transition-colors">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-white font-medium">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>
      {right && <div>{right}</div>}
    </header>
  )
}
