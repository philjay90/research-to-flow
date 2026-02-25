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
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <header className="border-b bg-white px-6 py-4">
          <a href="/" className="text-lg font-semibold text-indigo-600">
            Research-to-Flow
          </a>
        </header>
        <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
      </body>
    </html>
  )
}
