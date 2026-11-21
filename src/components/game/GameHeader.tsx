import { PhaseBadge } from '@/components/common/PhaseBadge'
import type { GameView } from './types'

export function GameHeader({ view }: { view: GameView }) {
  const host = view.players.find((p) => p.data.userId === view.game.hostId)
  return (
    <header className="mb-6 flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="font-typewriter text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Case file · hosted by {host?.data.displayName ?? 'unknown'}
        </p>
        <h1 className="font-typewriter text-2xl sm:text-3xl">{view.game.title || 'A case not yet opened'}</h1>
      </div>
      <PhaseBadge phase={view.game.phase} />
    </header>
  )
}
