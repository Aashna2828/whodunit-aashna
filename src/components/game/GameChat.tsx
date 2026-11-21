import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQuery } from 'deepspace'
import { MessagesSquare } from 'lucide-react'
import { Button, EmptyState, Input } from '@/components/ui'
import { CaseCard } from '@/components/common/CaseCard'
import { ActionError, LoadError, Skeleton } from '@/components/common/Feedback'
import { useAction } from '@/lib/use-action'
import { MAX_MESSAGE_LENGTH, type ChatMessage } from '@/lib/game-types'

// The game's private chat. Messages arrive live; posting goes through sendMessage.
export function GameChat({ gameId, canPost }: { gameId: string; canPost: boolean }) {
  const messages = useQuery<ChatMessage>('messages', { where: { gameId }, orderBy: 'createdAt', orderDir: 'asc' })
  const send = useAction('sendMessage')
  const [text, setText] = useState('')
  const bottom = useRef<HTMLDivElement>(null)

  // Keep the newest message in view.
  // (Braces matter: an effect may only return a cleanup function, and newer
  // browsers make scrollIntoView return a value.)
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' })
  }, [messages.records.length])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const result = await send.run({ gameId, text })
    if (result.success) setText('')
  }

  return (
    <CaseCard label="Interrogation room" testId="game-chat">
      <div className="max-h-[50vh] min-h-40 overflow-y-auto">
        {messages.status === 'loading' ? (
          <Skeleton rows={2} />
        ) : messages.status === 'error' ? (
          <LoadError message={messages.error} />
        ) : messages.records.length === 0 ? (
          <EmptyState
            icon={<MessagesSquare />}
            title="No messages yet"
            description="Share what your clues say. Nobody else can see them unless you tell them."
            className="py-6"
          />
        ) : (
          <ul className="space-y-2">
            {messages.records.map((m) => (
              <li key={m.recordId} data-testid="chat-message">
                <span className="font-typewriter text-sm text-primary">{m.data.authorName}: </span>
                <span className="break-words">{m.data.text}</span>
              </li>
            ))}
          </ul>
        )}
        <div ref={bottom} />
      </div>

      {canPost ? (
        <form onSubmit={submit} className="mt-3 space-y-1 border-t border-border pt-3">
          <div className="flex gap-2">
            <Input
              aria-label="Message"
              className="min-w-0 flex-1"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder="Say what you know..."
            />
            <Button type="submit" loading={send.loading} disabled={!text.trim()}>
              Send
            </Button>
          </div>
          <p className="text-right text-xs text-muted-foreground">
            {text.length}/{MAX_MESSAGE_LENGTH}
          </p>
          <ActionError message={send.error} />
        </form>
      ) : (
        <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
          Only detectives dealt into this case can post.
        </p>
      )}
    </CaseCard>
  )
}
