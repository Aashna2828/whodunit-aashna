import { Users } from 'lucide-react'
import { EmptyState } from '@/components/ui'
import { CaseCard } from '@/components/common/CaseCard'
import { MAX_PLAYERS } from '@/lib/game-types'
import type { GameView } from './types'

export function PlayerList({ view }: { view: GameView }) {
  return (
    <CaseCard label={`Detectives (${view.players.length}/${MAX_PLAYERS})`} testId="player-list">
      {view.players.length === 0 ? (
        <EmptyState icon={<Users />} title="No detectives yet" className="py-6" />
      ) : (
        <ul className="divide-y divide-border">
          {view.players.map((p) => (
            <li key={p.recordId} className="flex items-center gap-2 py-2">
              <span className="flex-1 truncate">{p.data.displayName}</span>
              {p.data.userId === view.game.hostId && <Tag>Host</Tag>}
              {p.data.userId === view.userId && <Tag>You</Tag>}
            </li>
          ))}
        </ul>
      )}
    </CaseCard>
  )
}

function Tag({ children }: { children: string }) {
  return <span className="text-xs uppercase tracking-wider text-muted-foreground">{children}</span>
}
