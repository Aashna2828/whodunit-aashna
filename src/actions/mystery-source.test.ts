import { expect, test, vi } from 'vitest'
import { FALLBACK_MYSTERY } from '../mystery/fallback'
import { MYSTERY_TIMEOUT_MS, getMystery, type GenerateText, type Prompt } from './mystery-source'
import { isTestAccountCaller } from './test-account'

// A valid mystery that is clearly not the fallback.
const AI_MYSTERY = { ...FALLBACK_MYSTERY, title: 'The Case of the Fake AI' }
const VALID = JSON.stringify(AI_MYSTERY)
const INVALID = JSON.stringify({ ...FALLBACK_MYSTERY, culprit: 'Nobody' })

// A fake AI that returns the given replies in order and records each prompt.
function fakeAI(...replies: string[]) {
  const prompts: Prompt[] = []
  const generate: GenerateText = async (prompt) => {
    prompts.push(prompt)
    return replies[prompts.length - 1] ?? INVALID
  }
  return { generate, prompts }
}

test('a valid reply is used on the first attempt', async () => {
  const ai = fakeAI(VALID)
  const result = await getMystery(3, { generate: ai.generate })
  expect(result).toMatchObject({ source: 'ai', attempts: 1 })
  expect(result.mystery.title).toBe('The Case of the Fake AI')
})

test('an invalid reply is retried, and the retry prompt lists what was wrong', async () => {
  const ai = fakeAI(INVALID, VALID)
  const result = await getMystery(3, { generate: ai.generate })
  expect(result).toMatchObject({ source: 'ai', attempts: 2 })
  expect(ai.prompts[0].user).not.toContain('previous reply was rejected')
  expect(ai.prompts[1].user).toContain('Culprit "Nobody" is not one of the suspects')
})

test('three invalid replies fall back to the hand-written mystery', async () => {
  const ai = fakeAI(INVALID, 'not json at all', INVALID)
  const result = await getMystery(3, { generate: ai.generate })
  expect(result).toMatchObject({ source: 'fallback', attempts: 3, reason: 'invalid' })
  expect(result.mystery).toBe(FALLBACK_MYSTERY)
  expect(ai.prompts).toHaveLength(3)
})

test('a failed AI call counts as an attempt and is retried', async () => {
  let calls = 0
  const generate: GenerateText = async () => {
    calls += 1
    if (calls === 1) throw new Error('upstream 503')
    return VALID
  }
  expect(await getMystery(3, { generate })).toMatchObject({ source: 'ai', attempts: 2 })
})

test('a slow AI falls back at the timeout instead of hanging', async () => {
  const never: GenerateText = () => new Promise(() => {})
  const started = Date.now()
  const result = await getMystery(3, { generate: never, timeoutMs: 50 })
  expect(result).toMatchObject({ source: 'fallback', reason: 'timeout', attempts: 1 })
  expect(Date.now() - started).toBeLessThan(1000)
})

test('with no AI available, the fallback is used without any attempt', async () => {
  expect(await getMystery(3)).toMatchObject({ source: 'fallback', attempts: 0, reason: 'no-ai' })
})

test('the prompt carries the content rules', async () => {
  const ai = fakeAI(VALID)
  await getMystery(4, { generate: ai.generate, random: () => 0 })
  const { system, user } = ai.prompts[0]
  expect(system).toMatch(/no gore/i)
  expect(system).toMatch(/never real people/i)
  expect(user).toContain('must plainly give that\n  suspect an alibi')
  expect(user).toContain('a 1920s ocean liner') // random() = 0 picks the first idea
  // Speed: short fields and a fixed clue count.
  expect(user).toContain('Exactly 10 clues.')
  expect(user).toContain('(under 30 words)')
  expect(user).toContain('"description": string (1 sentence)')
  // Fairness: circumstantial evidence and a red herring for every innocent.
  expect(user).toContain('must be circumstantial')
  expect(user).toContain('No single clue may prove\n  guilt on its own')
  expect(user).toContain('Every suspect, guilty or innocent, has at least one "incriminates" clue')
  // Names copied exactly, titles included.
  expect(user).toContain('Copy each clue\'s "suspect" EXACTLY from the suspects\' "name" fields')
  expect(user).toContain('including any title')
  // No example names: a real run copied the example into the case.
  expect(user).not.toContain('Otto Kemp')
})

test('the total budget is 60 seconds', () => {
  expect(MYSTERY_TIMEOUT_MS).toBe(60_000)
})

test('a reply with a wrong suspect name is retried with the exact names to use', async () => {
  const wrongName = JSON.stringify({
    ...FALLBACK_MYSTERY,
    clues: FALLBACK_MYSTERY.clues.map((c) => (c.suspect === 'Dr. Otto Kemp' ? { ...c, suspect: 'Otto Kemp' } : c)),
  })
  const ai = fakeAI(wrongName, VALID)
  expect(await getMystery(3, { generate: ai.generate })).toMatchObject({ source: 'ai', attempts: 2 })
  expect(ai.prompts[1].user).toContain('not in the suspect list: "Otto Kemp"')
  expect(ai.prompts[1].user).toContain('must be exactly one of: "Iris Vane", "Dr. Otto Kemp"')
})

test('each attempt is logged with its duration, and why it failed', async () => {
  const log = vi.spyOn(console, 'info').mockImplementation(() => {})
  await getMystery(3, { generate: fakeAI(INVALID, VALID).generate })
  const lines = log.mock.calls.map((call) => String(call[0]))
  log.mockRestore()

  expect(lines[0]).toMatch(/^\[mystery\] attempt=1 ms=\d+ result=invalid errors=".*Culprit \\"Nobody\\" is not one of the suspects/)
  expect(lines[1]).toMatch(/^\[mystery\] attempt=2 ms=\d+ result=valid$/)
  expect(lines[2]).toBe('[mystery] source=ai attempts=2')
})

test('a timed-out attempt is logged before falling back', async () => {
  const log = vi.spyOn(console, 'info').mockImplementation(() => {})
  await getMystery(3, { generate: () => new Promise(() => {}), timeoutMs: 30 })
  const lines = log.mock.calls.map((call) => String(call[0]))
  log.mockRestore()

  expect(lines[0]).toMatch(/^\[mystery\] attempt=1 ms=\d+ result=timeout$/)
  expect(lines[1]).toBe('[mystery] source=fallback attempts=1 reason=timeout')
})

test('a fake AI reply with no red herrings is rejected by the validator and retried', async () => {
  const noRedHerrings = JSON.stringify({
    ...FALLBACK_MYSTERY,
    clues: FALLBACK_MYSTERY.clues.filter((c) => c.kind === 'clears' || c.suspect === FALLBACK_MYSTERY.culprit),
  })
  const ai = fakeAI(noRedHerrings, VALID)
  expect(await getMystery(3, { generate: ai.generate })).toMatchObject({ source: 'ai', attempts: 2 })
  expect(ai.prompts[1].user).toContain('has no incriminating (red herring) clue')
})

// Builds an unsigned token with the given claims (the route verifies real ones).
const tokenWith = (claims: object) => `x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`

test('test accounts are recognized from the token claim', () => {
  expect(isTestAccountCaller(tokenWith({ sub: 'u1', isTestAccount: true }))).toBe(true)
  expect(isTestAccountCaller(tokenWith({ sub: 'u2' }))).toBe(false)
  expect(isTestAccountCaller(tokenWith({ sub: 'u3', isTestAccount: 'true' }))).toBe(false)
  expect(isTestAccountCaller('garbage')).toBe(false)
})
