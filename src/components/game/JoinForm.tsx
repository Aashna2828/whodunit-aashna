import { useState, type FormEvent } from 'react'
import { useAuthProfileReady, useMutations } from 'deepspace'
import { Button, Input, Label } from '@/components/ui'
import { ActionError } from '@/components/common/Feedback'
import { CaseCard } from '@/components/common/CaseCard'

// A visitor adds their own players row. players.userId is userBound, so the
// server fills in who they are; the schema refuses a second join.
export function JoinForm({ gameId }: { gameId: string }) {
  const { user } = useAuthProfileReady({ requireUser: true })
  const { ready, createConfirmed } = useMutations<{ gameId: string; displayName: string }>('players')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const displayName = name || user?.name || ''

  async function join(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await createConfirmed({ gameId, displayName: displayName.trim() })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join this game')
    } finally {
      setLoading(false)
    }
  }

  return (
    <CaseCard label="Join the investigation">
      <form onSubmit={join} className="space-y-2">
        <Label htmlFor="join-name">Your detective name</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="join-name"
            className="min-w-0 flex-1"
            value={displayName}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
          />
          <Button type="submit" loading={loading} disabled={!ready || !displayName.trim()}>
            Join
          </Button>
        </div>
        <ActionError message={error} />
      </form>
    </CaseCard>
  )
}
