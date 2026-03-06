import Link from 'next/link'
import { signOut } from '@/app/actions'
import { SubmitButton } from '@/app/components/SubmitButton'

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
    <header className="flex items-center justify-between bg-[#1D1D1F] px-8 py-4 border-b border-white/10">
      <nav className="flex items-center gap-2 text-sm">
        <Link
          href="/"
          className="font-bold text-white tracking-tight hover:text-white/80 transition-colors"
        >
          Research-to-Flow
        </Link>
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="text-white/20 text-base leading-none">›</span>
            {crumb.href ? (
              <Link href={crumb.href} className="text-white/60 hover:text-white/90 transition-colors">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-white/90 font-medium">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-1">
        {right && <div className="mr-3">{right}</div>}

        <Link
          href="/account"
          className="flex h-8 items-center rounded-full px-3.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          Account
        </Link>

        <form action={signOut}>
          <SubmitButton
            className="flex h-8 items-center rounded-full px-3.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            Sign out
          </SubmitButton>
        </form>
      </div>
    </header>
  )
}
