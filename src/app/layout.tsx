import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Research-to-Flow',
  description: 'Turn UX research into flowcharts',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  )
}
