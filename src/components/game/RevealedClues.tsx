import { FileSearch } from 'lucide-react'
import { EmptyState } from '@/components/ui'
import { CaseCard } from '@/components/common/CaseCard'
import { cn } from '@/lib/utils'
import type { RevealedClue } from '@/lib/game-types'

// The full clue file, unsealed: every clue, who held it, and what it proved.
export function RevealedClues({ clues }: { clues: RevealedClue[] }) {
  return (
    <CaseCard label="The full clue file" testId="revealed-clues">
      {clues.length === 0 ? (
        <EmptyState
          icon={<FileSearch />}
          title="No clue file on record"
          description="This case was played before clue files were kept."
          className="py-6"
        />
      ) : (
        <ul className="space-y-2">
          {clues.map((clue, i) => (
            <li key={i} data-testid="revealed-clue" className="rounded-sm bg-background/40 p-3">
              <p>{clue.text}</p>
              <p className="mt-1 flex flex-wrap gap-x-3 text-xs uppercase tracking-wider">
                <span className="text-muted-foreground">Held by {clue.heldBy}</span>
                <span className={cn(clue.kind === 'incriminates' ? 'text-primary' : 'text-muted-foreground')}>
                  {clue.kind === 'clears' ? `Clears ${clue.suspect}` : `Incriminates ${clue.suspect}`}
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </CaseCard>
  )
}
