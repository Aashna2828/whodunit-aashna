// "X of N players have voted". Counts only: who voted for whom stays secret.
export function VoteProgress({ cast, total }: { cast: number; total: number }) {
  const percent = total > 0 ? Math.min(100, Math.round((cast / total) * 100)) : 0
  return (
    <div className="rounded-md border border-border bg-card p-4" data-testid="vote-progress">
      <p className="text-sm">
        <span className="font-typewriter text-primary">
          {cast} of {total}
        </span>{' '}
        players have voted
      </p>
      <div className="mt-2 h-1.5 rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

// "1 player hasn't voted yet" / "2 players haven't voted yet".
export function notVotedYet(count: number) {
  return count === 1 ? "1 player hasn't voted yet" : `${count} players haven't voted yet`
}
