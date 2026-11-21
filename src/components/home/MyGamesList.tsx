import { useAuth, useQuery } from 'deepspace'
import { FolderOpen } from 'lucide-react'
import { Button, EmptyState } from '@/components/ui'
import { LoadError, Skeleton } from '@/components/common/Feedback'
import type { Game, Player } from '@/lib/game-types'
import { GameRow } from './GameRow'

// Games I'm a player in (hosts are players too), newest first.
export function MyGamesList({ onCreate }: { onCreate: () => void }) {
  const { userId } = useAuth()
  const mine = useQuery<Player>('players', { where: { userId: userId ?? '' } })
  const games = useQuery<Game>('games')

  if (mine.status === 'loading' || games.status === 'loading') return <Skeleton />
  if (mine.status === 'error') return <LoadError message={mine.error} />
  if (games.status === 'error') return <LoadError message={games.error} />

  const myGameIds = new Set(mine.records.map((p) => p.data.gameId))
  const list = games.records
    .filter((g) => myGameIds.has(g.recordId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  if (list.length === 0) {
    return (
      <EmptyState
        icon={<FolderOpen />}
        title="No cases yet"
        description="Open a new case and send the invite link to 1 to 3 friends, or open an invite link a friend sent you."
        action={{ label: 'Create game', onClick: onCreate }}
      />
    )
  }

  // The Create button lives here (not in the page header) so an empty list
  // shows only the empty state's button.
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="flex-1 font-typewriter text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Your cases
        </h2>
        <Button onClick={onCreate}>Create game</Button>
      </div>
      <ul className="space-y-2" data-testid="my-games">
        {list.map((game) => (
          <GameRow key={game.recordId} game={game} isHost={game.data.hostId === userId} />
        ))}
      </ul>
    </section>
  )
}
