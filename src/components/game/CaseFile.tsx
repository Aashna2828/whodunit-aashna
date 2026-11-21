import { CaseCard } from '@/components/common/CaseCard'
import type { Game } from '@/lib/game-types'

// The public facts: setting, victim, and the four suspects.
export function CaseFile({ game }: { game: Game }) {
  const suspects = game.suspects ?? []
  return (
    <CaseCard label="Case file" testId="case-file">
      <dl className="grid gap-3 sm:grid-cols-2">
        <Fact term="Setting" value={game.setting} />
        <Fact term="Victim" value={game.victim} />
      </dl>
      <h3 className="mt-5 mb-2 font-typewriter text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Suspects
      </h3>
      {suspects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No suspects on file.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {suspects.map((s) => (
            <li key={s.name} className="rounded-sm border border-border bg-background/40 p-3">
              <p className="font-typewriter text-base">{s.name}</p>
              <p className="text-xs uppercase tracking-wider text-primary">{s.role}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
            </li>
          ))}
        </ul>
      )}
    </CaseCard>
  )
}

function Fact({ term, value }: { term: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{term}</dt>
      <dd>{value || 'Unknown'}</dd>
    </div>
  )
}
