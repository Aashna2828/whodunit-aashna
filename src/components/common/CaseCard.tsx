import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = { label: string; children: ReactNode; className?: string; testId?: string }

// A case-file card: a typed label strip on top, content below.
export function CaseCard({ label, children, className, testId }: Props) {
  return (
    <section data-testid={testId} className={cn('rounded-md border border-border bg-card', className)}>
      <h2 className="border-b border-dashed border-border px-4 py-2 font-typewriter text-xs uppercase tracking-[0.2em] text-primary">
        {label}
      </h2>
      <div className="p-4">{children}</div>
    </section>
  )
}
