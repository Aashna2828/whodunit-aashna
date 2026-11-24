import { CaseFile } from './CaseFile'
import { GameChat } from './GameChat'
import { HostAction } from './HostAction'
import { MyClues } from './MyClues'
import { TwoColumns } from './InvestigatingView'
import { VoteForm } from './VoteForm'
import { VoteProgress, notVotedYet } from './VoteProgress'
import type { GameView } from './types'

export function VotingView({ view }: { view: GameView }) {
  const cast = view.game.votesCast ?? 0
  // Games started before dealtCount existed fall back to the player count.
  const total = view.game.dealtCount || view.players.length
  const missing = Math.max(0, total - cast)

  return (
    <TwoColumns
      main={
        <>
          <VoteProgress cast={cast} total={total} />
          {view.dealtIn ? (
            <VoteForm gameId={view.gameId} suspects={view.game.suspects ?? []} isHost={view.isHost} />
          ) : (
            <p className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
              Voting is open. You joined after the deal, so you are watching this one.
            </p>
          )}
          <CaseFile game={view.game} gameId={view.gameId} />
          <MyClues clues={view.myClues} />
        </>
      }
      side={
        <>
          {view.dealtIn && <GameChat gameId={view.gameId} canPost />}
          {view.isHost && (
            <HostAction
              action="revealGame"
              gameId={view.gameId}
              label="Reveal the culprit"
              confirm={missing > 0 ? `${notVotedYet(missing)}. Reveal anyway?` : undefined}
              confirmDetail="Players who haven't voted won't be counted."
            />
          )}
        </>
      }
    />
  )
}
