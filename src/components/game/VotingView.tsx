import { CaseFile } from './CaseFile'
import { GameChat } from './GameChat'
import { HostAction } from './HostAction'
import { MyClues } from './MyClues'
import { TwoColumns } from './InvestigatingView'
import { VoteForm } from './VoteForm'
import type { GameView } from './types'

export function VotingView({ view }: { view: GameView }) {
  return (
    <TwoColumns
      main={
        <>
          {view.dealtIn ? (
            <VoteForm gameId={view.gameId} suspects={view.game.suspects ?? []} />
          ) : (
            <p className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
              Voting is open. You joined after the deal, so you are watching this one.
            </p>
          )}
          <CaseFile game={view.game} />
          <MyClues clues={view.myClues} />
        </>
      }
      side={
        <>
          {view.dealtIn && <GameChat gameId={view.gameId} canPost />}
          {view.isHost && <HostAction action="revealGame" gameId={view.gameId} label="Reveal the culprit" />}
        </>
      }
    />
  )
}
