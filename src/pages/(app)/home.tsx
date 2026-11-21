/* home pattern: search-first — the detective's case list in one column, "Create game" above it (no search box needed yet) */

import { useState } from 'react'
import { AuthOverlay, useAuth } from 'deepspace'
import { Button } from '@/components/ui'
import { Skeleton } from '@/components/common/Feedback'
import { CreateGameModal } from '@/components/home/CreateGameModal'
import { MyGamesList } from '@/components/home/MyGamesList'

export default function HomePage() {
  const { isLoaded, isSignedIn } = useAuth()
  const [creating, setCreating] = useState(false)
  const [signingIn, setSigningIn] = useState(false)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <div>
          <p className="font-typewriter text-xs uppercase tracking-[0.3em] text-muted-foreground">Case files</p>
          <h1 className="font-typewriter text-3xl text-foreground sm:text-4xl">Whodunit</h1>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            One victim, four suspects, and a clue file split between you and your friends. Talk it through, then
            accuse.
          </p>
        </div>
      </header>

      {!isLoaded ? (
        <Skeleton />
      ) : isSignedIn ? (
        <MyGamesList onCreate={() => setCreating(true)} />
      ) : (
        <div className="rounded-md border border-border bg-card p-6">
          <p className="font-typewriter text-lg">Sign in to open a case</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your games and private clues are tied to your account.
          </p>
          <Button className="mt-4" onClick={() => setSigningIn(true)}>
            Sign in
          </Button>
        </div>
      )}

      {creating && <CreateGameModal open onClose={() => setCreating(false)} />}
      {signingIn && <AuthOverlay onClose={() => setSigningIn(false)} />}
    </div>
  )
}
