import { FileSearch } from 'lucide-react'
import { EmptyState } from '@/components/ui'
import { CaseCard } from '@/components/common/CaseCard'
import type { Clue, Rec } from '@/lib/game-types'

// Only my clues ever reach this browser: the server filters clues by owner.
export function MyClues({ clues }: { clues: Rec<Clue>[] }) {
  return (
    <CaseCard label="Your clues (only you can see these)" testId="my-clues">
      {clues.length === 0 ? (
        <EmptyState
          icon={<FileSearch />}
          title="No clues for you"
          description="You joined after the clues were dealt. You can follow along, but you can't chat or vote in this case."
          className="py-6"
        />
      ) : (
        <ol className="space-y-2">
          {clues.map((clue, i) => (
            <li key={clue.recordId} data-testid="my-clue" className="flex gap-3 rounded-sm bg-background/40 p-3">
              <span className="font-typewriter text-primary">{String(i + 1).padStart(2, '0')}</span>
              <span>{clue.data.text}</span>
            </li>
          ))}
        </ol>
      )}
    </CaseCard>
  )
}
