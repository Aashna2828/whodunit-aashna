import { useCallback, useState } from 'react'
import { getAuthToken } from 'deepspace'
import { useToast } from '@/components/ui'

export type ActionResult =
  | { success: true; data: Record<string, unknown> }
  | { success: false; error: string }

// Calls POST /api/actions/<name> with the signed-in user's token.
// Never throws: network and server problems come back as { success: false, error }.
export async function callAction(name: string, params: Record<string, unknown>): Promise<ActionResult> {
  try {
    const token = await getAuthToken()
    if (!token) return { success: false, error: 'Please sign in again' }
    const res = await fetch(`/api/actions/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(params),
    })
    if (res.status === 401) return { success: false, error: 'Please sign in again' }
    const body = (await res.json().catch(() => null)) as ActionResult | null
    if (!body || typeof body.success !== 'boolean') return { success: false, error: `Server error (${res.status})` }
    return body
  } catch {
    return { success: false, error: 'Network error. Check your connection and try again.' }
  }
}

// One action, with its loading flag and last error, for a button to use.
export function useAction(name: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { error: toastError } = useToast()

  const run = useCallback(
    async (params: Record<string, unknown> = {}) => {
      setLoading(true)
      setError(null)
      const result = await callAction(name, params)
      setLoading(false)
      if (!result.success) {
        setError(result.error)
        toastError('That did not work', result.error)
      }
      return result
    },
    [name, toastError],
  )

  return { run, loading, error }
}
