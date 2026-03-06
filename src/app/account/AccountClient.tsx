'use client'

import { useActionState, useState } from 'react'
import { changePassword, deleteAccount } from '@/app/actions'

// ---------------------------------------------------------------------------
// Change Password
// ---------------------------------------------------------------------------

function ChangePasswordForm() {
  const [state, action, isPending] = useActionState(changePassword, {
    error: null,
    success: false,
  })

  if (state.success) {
    return (
      <p className="text-sm text-green-600 font-medium">
        Password updated successfully.
      </p>
    )
  }

  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="block text-xs text-[#86868B] mb-1">New password</label>
        <input
          name="password"
          type="password"
          required
          minLength={6}
          className="w-full rounded-xl border border-[#D2D2D7] px-3 py-2 text-sm text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/20"
          placeholder="At least 6 characters"
        />
      </div>
      <div>
        <label className="block text-xs text-[#86868B] mb-1">Confirm new password</label>
        <input
          name="confirm"
          type="password"
          required
          minLength={6}
          className="w-full rounded-xl border border-[#D2D2D7] px-3 py-2 text-sm text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/20"
          placeholder="Repeat password"
        />
      </div>
      {state.error && (
        <p className="text-xs text-red-500">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2 rounded-xl bg-[#1D1D1F] text-white text-sm font-medium hover:bg-black/80 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Updating…' : 'Update password'}
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Delete Account
// ---------------------------------------------------------------------------

function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setLoading(true)
    setError(null)
    const result = await deleteAccount()
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
    // On success, deleteAccount redirects to /login
  }

  if (confirming) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-red-600">
          Are you sure? All your projects, flows, and data will be permanently deleted.
        </p>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Deleting…' : 'Yes, delete everything'}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={loading}
            className="flex-1 py-2 rounded-xl border border-[#D2D2D7] text-sm text-[#1D1D1F] hover:bg-[#F5F5F7] disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="w-full py-2 rounded-xl border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
    >
      Delete account &amp; all data
    </button>
  )
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function AccountClient({ deleteMode = false }: { deleteMode?: boolean }) {
  if (deleteMode) return <DeleteAccountButton />
  return <ChangePasswordForm />
}
