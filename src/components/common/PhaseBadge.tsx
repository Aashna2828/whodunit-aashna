import { Badge } from '@/components/ui'
import type { Phase } from '@/lib/game-types'

const LABELS: Record<Phase, string> = {
  lobby: 'Lobby',
  investigating: 'Investigating',
  voting: 'Voting',
  revealed: 'Solved',
  cancelled: 'Cancelled',
}

// Live phases get the accent; finished ones are muted.
export function PhaseBadge({ phase }: { phase: Phase }) {
  const live = phase === 'investigating' || phase === 'voting'
  return (
    <Badge variant={live ? 'default' : 'outline'} className="font-typewriter uppercase tracking-wider">
      {LABELS[phase]}
    </Badge>
  )
}
