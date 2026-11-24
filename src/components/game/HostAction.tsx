import { useState } from 'react'
import { Button, ConfirmModal } from '@/components/ui'
import { ActionError } from '@/components/common/Feedback'
import { useAction } from '@/lib/use-action'

type Props = {
  action: string
  gameId: string
  label: string
  disabledHint?: string // set = button disabled, with this explanation
  note?: string // shown above the button
  confirm?: string // set = ask this question before running
  confirmDetail?: string // extra line in that question
  loadingLabel?: string // button text while the action runs
  onSuccess?: () => void // runs after the action succeeds
}

// A host-only button that runs one server action.
export function HostAction(props: Props) {
  const { action, gameId, label, disabledHint, note, confirm, confirmDetail, loadingLabel, onSuccess } = props
  const { run, loading, error } = useAction(action)
  const [asking, setAsking] = useState(false)

  async function go() {
    const result = await run({ gameId })
    if (!result.success) return
    setAsking(false)
    onSuccess?.()
  }

  return (
    <div className="space-y-2 rounded-md border border-dashed border-primary/50 bg-primary/5 p-4">
      <p className="font-typewriter text-xs uppercase tracking-[0.2em] text-primary">Host</p>
      {note && <p className="text-sm">{note}</p>}
      <Button onClick={() => (confirm ? setAsking(true) : go())} loading={loading} disabled={Boolean(disabledHint)}>
        {loading && loadingLabel ? loadingLabel : label}
      </Button>
      {disabledHint && <p className="text-sm text-muted-foreground">{disabledHint}</p>}
      <ActionError message={error} />
      {confirm && (
        <ConfirmModal
          open={asking}
          onClose={() => setAsking(false)}
          onConfirm={go}
          title={confirm}
          description={confirmDetail}
          confirmText={label}
          cancelText="Wait"
          variant="default"
          loading={loading}
        />
      )}
    </div>
  )
}
