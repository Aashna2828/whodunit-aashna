// Small shared feedback pieces: an inline error line and loading placeholders.

export function ActionError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  )
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  )
}

export function LoadError({ message }: { message?: string }) {
  return (
    <div role="alert" className="rounded-md border border-border bg-card p-4 text-sm text-destructive">
      Could not load this: {message ?? 'unknown error'}. Try refreshing the page.
    </div>
  )
}
