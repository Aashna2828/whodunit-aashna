import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, ConfirmModal } from '@/components/ui'
import { PhaseBadge } from '@/components/common/PhaseBadge'
import { ActionError } from '@/components/common/Feedback'
import { useAction } from '@/lib/use-action'
import type { Game, Rec } from '@/lib/game-types'

// One game in "my games": name, phase, Open, and Cancel for my lobby games.
export function GameRow({ game, isHost }: { game: Rec<Game>; isHost: boolean }) {
  const [confirming, setConfirming] = useState(false)
  const cancelGame = useAction('cancelGame')
  const name = game.data.title || 'Unopened case'
  const canCancel = isHost && game.data.phase === 'lobby'

  async function cancel() {
    const result = await cancelGame.run({ gameId: game.recordId })
    if (result.success) setConfirming(false)
  }

  return (
    <li data-testid="game-row" className="rounded-md border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-typewriter text-base">{name}</p>
          <p className="text-xs text-muted-foreground">
            {isHost ? 'You are hosting' : 'You are a player'} · opened{' '}
            {new Date(game.createdAt).toLocaleDateString()}
          </p>
        </div>
        <PhaseBadge phase={game.data.phase} />
        {canCancel && (
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            Cancel
          </Button>
        )}
        <Link
          to={`/game/${game.recordId}`}
          className="rounded-sm px-2 py-1 text-sm text-primary underline-offset-4 hover:underline"
        >
          Open
        </Link>
      </div>
      <ActionError message={cancelGame.error} />
      <ConfirmModal
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={cancel}
        title="Cancel this game?"
        description="Players in the lobby will see that the case was closed. This cannot be undone."
        confirmText="Cancel game"
        cancelText="Keep it"
        loading={cancelGame.loading}
      />
    </li>
  )
}
