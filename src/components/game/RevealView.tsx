import { useState } from 'react'
import { Vote as VoteIcon } from 'lucide-react'
import { Button, EmptyState } from '@/components/ui'
import { CaseCard } from '@/components/common/CaseCard'
import { CreateGameModal } from '@/components/home/CreateGameModal'
import type { Game } from '@/lib/game-types'
import { RevealedClues } from './RevealedClues'

type Verdict = 'right' | 'wrong' | 'split' | 'none'

// The group got it right if the suspect with the most votes is the culprit.
// A tie for most votes counts as split.
export function groupVerdict(votes: { suspect: string }[], culprit: string): Verdict {
  if (votes.length === 0) return 'none'
  const counts = new Map<string, number>()
  for (const v of votes) counts.set(v.suspect, (counts.get(v.suspect) ?? 0) + 1)
  const top = Math.max(...counts.values())
  const leaders = [...counts].filter(([, n]) => n === top).map(([name]) => name)
  if (leaders.length > 1) return 'split'
  return leaders[0] === culprit ? 'right' : 'wrong'
}

const VERDICT_TEXT: Record<Verdict, string> = {
  right: 'The group cracked it.',
  wrong: 'The group accused the wrong person.',
  split: 'The group was split. No majority accusation.',
  none: 'Nobody voted.',
}

export function RevealView({ game }: { game: Game }) {
  const culprit = game.revealedCulprit ?? 'Unknown'
  const votes = game.revealedVotes ?? []
  const nonVoters = game.revealedNonVoters ?? []
  const verdict = groupVerdict(votes, culprit)
  const [creating, setCreating] = useState(false)

  return (
    <div className="max-w-3xl space-y-4">
      <CaseCard label="Case closed" testId="reveal">
        <p className="text-sm uppercase tracking-wider text-muted-foreground">The culprit was</p>
        <p className="font-typewriter text-3xl text-primary">{culprit}</p>
        <p className="mt-3 font-typewriter text-lg" data-testid="verdict">
          {VERDICT_TEXT[verdict]}
        </p>
        <p className="mt-3 max-w-prose leading-relaxed">{game.revealedExplanation}</p>
      </CaseCard>

      <CaseCard label="Who accused whom">
        {votes.length === 0 ? (
          <EmptyState icon={<VoteIcon />} title="No accusations" description="Nobody voted before the reveal." className="py-6" />
        ) : (
          <ul className="divide-y divide-border">
            {votes.map((v, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-2 py-2">
                <span>{v.displayName}</span>
                <span className="text-muted-foreground">accused</span>
                <span className={v.suspect === culprit ? 'font-typewriter text-primary' : 'font-typewriter'}>
                  {v.suspect}
                </span>
              </li>
            ))}
          </ul>
        )}
        {nonVoters.length > 0 && (
          <ul className="mt-2 border-t border-border pt-2 text-sm text-muted-foreground" data-testid="non-voters">
            {nonVoters.map((name, i) => (
              <li key={i}>{name} didn&apos;t vote</li>
            ))}
          </ul>
        )}
      </CaseCard>

      <RevealedClues clues={game.revealedClues ?? []} />

      <div className="flex justify-center pt-2">
        <Button size="lg" onClick={() => setCreating(true)}>
          New case
        </Button>
      </div>
      {creating && <CreateGameModal open onClose={() => setCreating(false)} />}
    </div>
  )
}
