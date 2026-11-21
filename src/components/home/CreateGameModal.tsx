import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthProfileReady } from 'deepspace'
import { Button, Input, Label, Modal } from '@/components/ui'
import { ActionError } from '@/components/common/Feedback'
import { useAction } from '@/lib/use-action'

// Asks for a display name, creates the game, and opens it.
export function CreateGameModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuthProfileReady({ requireUser: true })
  const [name, setName] = useState('')
  const createGame = useAction('createGame')
  const navigate = useNavigate()
  const displayName = name || user?.name || ''

  async function submit(e: FormEvent) {
    e.preventDefault()
    const result = await createGame.run({ displayName: displayName.trim() })
    if (result.success) navigate(`/game/${result.data.gameId}`)
  }

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <form onSubmit={submit}>
        <Modal.Header>
          <Modal.Title className="font-typewriter">Open a new case</Modal.Title>
        </Modal.Header>
        <Modal.Body className="space-y-2">
          <Label htmlFor="create-name">Your detective name</Label>
          <Input
            id="create-name"
            value={displayName}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            autoFocus
          />
          <ActionError message={createGame.error} />
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={createGame.loading} disabled={!displayName.trim()}>
            Create game
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
