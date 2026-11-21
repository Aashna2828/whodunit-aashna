import { useState } from 'react'
import { useQuery } from 'deepspace'
import { Button } from '@/components/ui'
import { CaseCard } from '@/components/common/CaseCard'
import { ActionError, LoadError, Skeleton } from '@/components/common/Feedback'
import { useAction } from '@/lib/use-action'
import { cn } from '@/lib/utils'
import type { Suspect } from '@/mystery/types'
import type { Vote } from '@/lib/game-types'

// Pick a suspect and accuse. Votes are readable only by their voter, so this
// query returns my vote (if any) and nobody else's.
type Props = { gameId: string; suspects: Suspect[]; isHost: boolean }

export function VoteForm({ gameId, suspects, isHost }: Props) {
  const myVote = useQuery<Vote>('votes', { where: { gameId } })
  const castVote = useAction('castVote')
  const [choice, setChoice] = useState<string | null>(null)

  if (myVote.status === 'loading') return <Skeleton rows={2} />
  if (myVote.status === 'error') return <LoadError message={myVote.error} />

  const voted = myVote.records[0]?.data.suspect
  if (voted) {
    return (
      <CaseCard label="Your accusation" testId="vote-done">
        <p>
          You accused <span className="font-typewriter text-primary">{voted}</span>.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {isHost ? "You're the host. Reveal when everyone has voted." : 'Waiting for the host to reveal.'}
        </p>
      </CaseCard>
    )
  }

  return (
    <CaseCard label="Make your accusation" testId="vote-form">
      <div role="radiogroup" aria-label="Suspects" className="grid gap-2 sm:grid-cols-2">
        {suspects.map((s) => (
          <button
            key={s.name}
            type="button"
            role="radio"
            aria-checked={choice === s.name}
            onClick={() => setChoice(s.name)}
            className={cn(
              'rounded-sm border p-3 text-left transition-colors',
              choice === s.name
                ? 'border-primary bg-primary/15 ring-1 ring-primary'
                : 'border-border hover:border-muted-foreground',
            )}
          >
            <span className={cn('block font-typewriter', choice === s.name && 'text-primary')}>{s.name}</span>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">{s.role}</span>
          </button>
        ))}
      </div>
      <Button
        className="mt-4"
        onClick={() => castVote.run({ gameId, suspect: choice })}
        loading={castVote.loading}
        disabled={!choice}
      >
        {choice ? `Accuse ${choice}` : 'Pick a suspect'}
      </Button>
      <ActionError message={castVote.error} />
    </CaseCard>
  )
}
