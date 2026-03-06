import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { AppHeader } from '@/app/components/AppHeader'
import { AccountClient } from './AccountClient'

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <AppHeader crumbs={[{ label: 'Account' }]} />
      <main className="max-w-xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-[#1D1D1F] mb-8 tracking-tight">Account</h1>

        {/* Email */}
        <section className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
          <h2 className="text-xs font-semibold text-[#86868B] uppercase tracking-widest mb-4">Profile</h2>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#86868B]">Email</span>
            <span className="text-sm font-medium text-[#1D1D1F]">{user.email}</span>
          </div>
        </section>

        {/* Change password */}
        <section className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
          <h2 className="text-xs font-semibold text-[#86868B] uppercase tracking-widest mb-4">Change Password</h2>
          <AccountClient />
        </section>

        {/* Danger zone */}
        <section className="bg-white rounded-2xl p-6 border border-red-200 shadow-sm">
          <h2 className="text-xs font-semibold text-red-500 uppercase tracking-widest mb-1">Danger Zone</h2>
          <p className="text-sm text-[#86868B] mb-4">
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
          <AccountClient deleteMode />
        </section>
      </main>
    </div>
  )
}
