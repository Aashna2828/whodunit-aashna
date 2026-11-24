import type { ReactNode } from 'react'
import { CaseFile } from './CaseFile'
import { GameChat } from './GameChat'
import { HostAction } from './HostAction'
import { MyClues } from './MyClues'
import type { GameView } from './types'

export function InvestigatingView({ view }: { view: GameView }) {
  return (
    <TwoColumns
      main={
        <>
          <CaseFile game={view.game} gameId={view.gameId} />
          <MyClues clues={view.myClues} />
        </>
      }
      side={
        <>
          {view.dealtIn && <GameChat gameId={view.gameId} canPost />}
          {view.isHost && <HostAction action="startVoting" gameId={view.gameId} label="Start voting" />}
        </>
      }
    />
  )
}

// Main column + side column on wide screens; one column on phones.
export function TwoColumns({ main, side }: { main: ReactNode; side: ReactNode }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <div className="min-w-0 space-y-4">{main}</div>
      <div className="min-w-0 space-y-4">{side}</div>
    </div>
  )
}
