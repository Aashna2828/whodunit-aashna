import { MAX_PLAYERS, MIN_PLAYERS } from '@/lib/game-types'
import { callAction } from '@/lib/use-action'
import { HostAction } from './HostAction'
import { InviteLinkButton } from './InviteLinkButton'
import { JoinForm } from './JoinForm'
import { PlayerList } from './PlayerList'
import type { GameView } from './types'

// Once the case exists, ask for its optional cover and narrated briefing.
// Deliberately not awaited: the game never waits on these, and a failure
// only means the extra stays hidden.
function requestCaseExtras(gameId: string) {
  void callAction('generateCover', { gameId })
  void callAction('generateBriefing', { gameId })
}

export function LobbyView({ view }: { view: GameView }) {
  const count = view.players.length
  const full = count >= MAX_PLAYERS
  const startHint =
    count < MIN_PLAYERS
      ? `Waiting for detectives: need at least ${MIN_PLAYERS} players (${count} so far).`
      : count > MAX_PLAYERS
        ? `Too many players: the case is for at most ${MAX_PLAYERS}.`
        : undefined

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <PlayerList view={view} />
        <InviteLinkButton />
      </div>
      <div className="space-y-4">
        {!view.isPlayer && !full && <JoinForm gameId={view.gameId} />}
        {!view.isPlayer && full && (
          <p className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
            This case already has {MAX_PLAYERS} detectives.
          </p>
        )}
        {view.isPlayer && !view.isHost && (
          <p className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
            You are in. Waiting for the host to open the case file.
          </p>
        )}
        {view.isHost && (
          <HostAction
            action="startGame"
            gameId={view.gameId}
            label="Start the investigation"
            loadingLabel="Writing your case... (20-40 seconds)"
            disabledHint={startHint}
            onSuccess={() => requestCaseExtras(view.gameId)}
          />
        )}
      </div>
    </div>
  )
}
