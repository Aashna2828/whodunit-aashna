/**
 * Landing page — a STATIC page (top level of src/pages/, so no DeepSpace
 * providers: no auth fetch, no records WebSocket) and prerendered to HTML at
 * build. Keep it renderable without a browser: no window/document in render.
 * `<Seo>` comes first and reads src/seo.ts.
 */

import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { seo } from '../seo'

const STEPS = [
  'One of you opens a case and sends the invite link.',
  'Each detective gets clues nobody else can see.',
  'Talk it through, then accuse. The file is unsealed at the reveal.',
]

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <main
        data-testid="static-landing"
        className="flex min-h-screen flex-col justify-center bg-background px-6 py-16 text-foreground"
      >
        <div className="mx-auto w-full max-w-2xl">
          <p className="font-typewriter text-xs uppercase tracking-[0.3em] text-muted-foreground">
            A murder mystery for 2 to 4 detectives
          </p>
          <h1 className="mt-3 font-typewriter text-5xl text-primary sm:text-7xl">Whodunit</h1>
          <p className="mt-6 max-w-prose text-lg leading-relaxed">
            Someone is dead. Four suspects have something to hide. Your friends hold the rest of the evidence,
            and nobody can solve it alone.
          </p>

          <ol className="mt-8 space-y-2 border-l border-dashed border-border pl-5">
            {STEPS.map((step, i) => (
              <li key={step} className="flex gap-3 text-muted-foreground">
                <span className="font-typewriter text-primary">{String(i + 1).padStart(2, '0')}</span>
                {step}
              </li>
            ))}
          </ol>

          <Link
            to="/home"
            className="mt-10 inline-flex items-center rounded-sm bg-primary px-8 py-3 font-typewriter text-lg tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
          >
            Enter
          </Link>
        </div>
      </main>
    </>
  )
}
