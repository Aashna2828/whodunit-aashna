/**
 * /game/:id — one page that changes with the game's phase.
 * Under (protected), so visitors with an invite link sign in first.
 * Every useQuery here is a live subscription: when a server action changes
 * the game, every open copy of this page re-renders into the new phase.
 */
import { Link, useParams } from 'react-router-dom'
import { useAuth, useQuery } from 'deepspace'
import { LoadError, Skeleton } from '@/components/common/Feedback'
import { CancelledView } from '@/components/game/CancelledView'
import { GameHeader } from '@/components/game/GameHeader'
import { InvestigatingView } from '@/components/game/InvestigatingView'
import { LobbyView } from '@/components/game/LobbyView'
import { RevealView } from '@/components/game/RevealView'
import { VotingView } from '@/components/game/VotingView'
import type { GameView } from '@/components/game/types'
import type { Clue, Game, Player } from '@/lib/game-types'

export default function GamePage() {
  const { id: gameId = '' } = useParams()
  const { userId } = useAuth()
  // All games are member-readable; pick this one by id (filters match data fields).
  const games = useQuery<Game>('games')
  const players = useQuery<Player>('players', { where: { gameId }, orderBy: 'createdAt', orderDir: 'asc' })
  // The server only sends clues I own, so this is "my clues".
  const clues = useQuery<Clue>('clues', { where: { gameId }, orderBy: 'createdAt', orderDir: 'asc' })

  const queries = [games, players, clues]
  const failed = queries.find((q) => q.status === 'error')
  const record = games.records.find((g) => g.recordId === gameId)

  let body
  if (failed) body = <LoadError message={failed.error} />
  else if (queries.some((q) => q.status === 'loading') || !userId) body = <Skeleton rows={4} />
  else if (!record) body = <NotFound />
  else {
    const view: GameView = {
      gameId,
      game: record.data,
      players: players.records,
      myClues: clues.records,
      userId,
      isHost: record.data.hostId === userId,
      isPlayer: players.records.some((p) => p.data.userId === userId),
      dealtIn: clues.records.length > 0,
    }
    body = (
      <>
        <GameHeader view={view} />
        <PhaseView view={view} />
      </>
    )
  }

  return <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">{body}</div>
}

function PhaseView({ view }: { view: GameView }) {
  switch (view.game.phase) {
    case 'lobby':
      return <LobbyView view={view} />
    case 'investigating':
      return <InvestigatingView view={view} />
    case 'voting':
      return <VotingView view={view} />
    case 'revealed':
      return <RevealView game={view.game} />
    case 'cancelled':
      return <CancelledView />
  }
}

function NotFound() {
  return (
    <div className="rounded-md border border-border bg-card p-6">
      <p className="font-typewriter text-lg">No such case</p>
      <p className="mt-1 text-sm text-muted-foreground">This invite link may be mistyped.</p>
      <Link to="/home" className="mt-3 inline-block text-primary underline-offset-4 hover:underline">
        Back to your cases
      </Link>
    </div>
  )
}
