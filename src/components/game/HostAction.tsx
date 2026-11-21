import { Button } from '@/components/ui'
import { ActionError } from '@/components/common/Feedback'
import { useAction } from '@/lib/use-action'

type Props = { action: string; gameId: string; label: string; disabledHint?: string }

// A host-only button that runs one server action. If `disabledHint` is set,
// the button is disabled and the hint explains why.
export function HostAction({ action, gameId, label, disabledHint }: Props) {
  const { run, loading, error } = useAction(action)
  return (
    <div className="space-y-2 rounded-md border border-dashed border-primary/50 bg-primary/5 p-4">
      <p className="font-typewriter text-xs uppercase tracking-[0.2em] text-primary">Host</p>
      <Button onClick={() => run({ gameId })} loading={loading} disabled={Boolean(disabledHint)}>
        {label}
      </Button>
      {disabledHint && <p className="text-sm text-muted-foreground">{disabledHint}</p>}
      <ActionError message={error} />
    </div>
  )
}
