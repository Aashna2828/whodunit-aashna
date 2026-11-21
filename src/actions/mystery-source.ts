import type { ActionTools } from 'deepspace/worker'
import { FALLBACK_MYSTERY } from '../mystery/fallback'
import { validateMystery } from '../mystery/validate'
import { MIN_CLUES_PER_PLAYER, SUSPECT_COUNT, type Mystery } from '../mystery/types'

// Change the model here; nothing else needs to change.
export const MYSTERY_MODEL = 'claude-haiku-5-5'
// Total time for all attempts. After this the game starts with the fallback.
export const MYSTERY_TIMEOUT_MS = 45_000
const MAX_ATTEMPTS = 3

// Anything that turns a prompt into reply text. startGame passes a Claude
// caller; unit tests pass a fake, so they never touch the network.
export type Prompt = { system: string; user: string }
export type GenerateText = (prompt: Prompt) => Promise<string>

export type MysteryResult = {
  ok: true
  mystery: Mystery
  source: 'ai' | 'fallback'
  attempts: number
  reason?: 'no-ai' | 'invalid' | 'timeout'
}

type Options = { generate?: GenerateText; timeoutMs?: number; random?: () => number }

// The one place a mystery comes from: the AI when available, checked by
// validateMystery, with up to MAX_ATTEMPTS tries before the hand-written fallback.
export async function getMystery(playerCount: number, options: Options = {}): Promise<MysteryResult> {
  const { generate, timeoutMs = MYSTERY_TIMEOUT_MS, random = Math.random } = options
  if (!generate) return fallback(0, 'no-ai')

  const deadline = Date.now() + timeoutMs
  const setting = SETTING_IDEAS[Math.floor(random() * SETTING_IDEAS.length)]
  let problems: string[] = []

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const started = Date.now()
    const logAttempt = (outcome: string) =>
      console.info(`[mystery] attempt=${attempt} ms=${Date.now() - started} ${outcome}`)

    let reply: string
    try {
      reply = await withTimeout(generate(buildPrompt(playerCount, setting, problems)), deadline - Date.now())
    } catch (err) {
      if (err === TIMED_OUT) {
        logAttempt('result=timeout')
        return fallback(attempt, 'timeout')
      }
      const message = err instanceof Error ? err.message : String(err)
      logAttempt(`result=error error=${JSON.stringify(message)}`)
      problems = [`The request failed: ${message}`]
      continue
    }
    const result = validateMystery(reply, playerCount)
    if (result.ok) {
      logAttempt('result=valid')
      console.info(`[mystery] source=ai attempts=${attempt}`)
      return { ok: true, mystery: result.mystery, source: 'ai', attempts: attempt }
    }
    logAttempt(`result=invalid errors=${JSON.stringify(result.errors.join('; '))}`)
    problems = result.errors
  }
  return fallback(MAX_ATTEMPTS, 'invalid')
}

function fallback(attempts: number, reason: NonNullable<MysteryResult['reason']>): MysteryResult {
  console.info(`[mystery] source=fallback attempts=${attempts} reason=${reason}`)
  return { ok: true, mystery: FALLBACK_MYSTERY, source: 'fallback', attempts, reason }
}

// Calls Claude through the platform's integration proxy (no API key here;
// billed to the app owner's DeepSpace credits).
export function claudeGenerator(tools: Pick<ActionTools, 'integration'>): GenerateText {
  return async ({ system, user }) => {
    const result = await tools.integration<{ content?: { type: string; text?: string }[] }>(
      'anthropic/chat-completion',
      // A full case is roughly 1,000 tokens; the cap stops a runaway reply.
      { model: MYSTERY_MODEL, max_tokens: 2000, temperature: 1, system, messages: [{ role: 'user', content: user }] },
    )
    if (!result.success) throw new Error(result.error)
    const text = (result.data.content ?? []).map((part) => (part.type === 'text' ? (part.text ?? '') : '')).join('')
    if (!text.trim()) throw new Error('The reply was empty')
    return text
  }
}

// ---- Timeout -------------------------------------------------------------

const TIMED_OUT = Symbol('timed out')

// Resolves with the promise, or rejects with TIMED_OUT after `ms`. The call
// itself can't be cancelled, but nobody waits for it any longer.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  if (ms <= 0) return Promise.reject(TIMED_OUT)
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(TIMED_OUT), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

// ---- Prompt --------------------------------------------------------------

// A random starting idea per game, so settings don't repeat.
const SETTING_IDEAS = [
  'a 1920s ocean liner crossing the Atlantic',
  'a snowed-in ski lodge in the Alps',
  'a research station in Antarctica',
  'a traveling circus in 1890s France',
  'a lighthouse island off the coast of Maine',
  'a Victorian botanical garden during a flower show',
  'a vineyard estate during the harvest festival',
  'a riverboat on the Mississippi in the 1870s',
  'a remote observatory on a mountaintop',
  'a seaside hotel during a jazz festival in the 1930s',
  'a bookshop and its book club in a small English village',
  'a desert archaeological dig in the 1920s',
  'a mountain monastery that makes famous cheese',
  'a luxury train crossing Canada in winter',
  'a film studio backlot in 1950s Hollywood',
  'a chess tournament in a grand Viennese hotel',
]

export function buildPrompt(playerCount: number, setting: string, problems: string[]): Prompt {
  // Exactly 10 clues (more only if a large group needs 2 each). Short and fixed keeps the reply fast.
  const clueCount = Math.max(10, playerCount * MIN_CLUES_PER_PLAYER)
  const system = [
    'You write cozy, fair-play murder mysteries for a party game.',
    'Keep it non-graphic: no gore and no detailed violence. Use only invented people, never real people.',
    'Reply with a single JSON object and nothing else: no prose and no code fences.',
  ].join(' ')

  const user = `Write a new murder mystery set in or inspired by: ${setting}.

Return JSON with exactly this shape. Keep every field short:
{
  "title": string (a few words),
  "setting": string (1 to 2 sentences),
  "victim": string (name and who they were, 1 to 2 sentences),
  "suspects": [{ "name": string, "role": string (a few words), "description": string (1 sentence) }],
  "culprit": string (exactly one suspect's name),
  "explanation": string (2 to 3 sentences on how and why the culprit did it),
  "clues": [{ "text": string (under 30 words), "suspect": string (a suspect's name), "kind": "clears" | "incriminates" }]
}

Rules, all required:
- Exactly ${SUSPECT_COUNT} suspects with different names.
- Exactly ${clueCount} clues.
- Every suspect, guilty or innocent, has at least one "incriminates" clue. For each
  innocent suspect it is a red herring: something that looks suspicious but has an
  innocent explanation.
- Every innocent suspect also has at least one "clears" clue.
- The culprit has no "clears" clue and at least two "incriminates" clues.
- The culprit's incriminating clues must be circumstantial. No single clue may prove
  guilt on its own or name the culprit as the killer; the answer should only follow
  from combining clues and ruling the innocents out.
- Each clue's text must clearly support its tag. A "clears" clue must plainly give that
  suspect an alibi or rule them out. An "incriminates" clue must plainly point at that suspect.
- The "suspect" field of every clue must exactly match a suspect's name.${
    problems.length > 0
      ? `\n\nYour previous reply was rejected for these problems. Fix all of them:\n- ${problems.join('\n- ')}`
      : ''
  }`

  return { system, user }
}
