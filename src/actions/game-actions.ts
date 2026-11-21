import { isAnonymousUserId } from 'deepspace/worker'
import type { ActionHandler, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { dealClues } from '../mystery/deal'
import type { ClueKind, Suspect } from '../mystery/types'
import { claudeGenerator, getMystery } from './mystery-source'
import { isTestAccountCaller } from './test-account'

// The record shapes these actions read (the `data` part of each record).
type Phase = 'lobby' | 'investigating' | 'voting' | 'revealed' | 'cancelled'
type Game = { hostId: string; phase: Phase; suspects?: Suspect[] }
type Player = { gameId: string; userId: string; displayName: string }
type Vote = { voterId: string; suspect: string }
type ClueFileEntry = { text: string; suspect: string; kind: ClueKind; holderId: string }
type Solution = { culprit: string; explanation: string; clueFile?: ClueFileEntry[] }

// Every action answers { success: true, data } or { success: false, error }.
const ok = (data: Record<string, unknown> = {}) => ({ success: true as const, data })
const fail = (error: string) => ({ success: false as const, error })

// The route already refuses requests without a valid token (401); this also
// refuses anonymous guest ids, so "must be signed in" is visible in each action.
const signedIn = (userId: string) => Boolean(userId) && !isAnonymousUserId(userId)

async function loadGame(tools: ActionTools, gameId: string): Promise<Game | null> {
  if (!gameId) return null
  const result = await tools.get<Game>('games', gameId)
  return result.success ? result.data.record.data : null
}

// Players in the order they joined (the deal uses this order).
async function loadPlayers(tools: ActionTools, gameId: string): Promise<Player[]> {
  const result = await tools.query<Player>('players', { where: { gameId } })
  if (!result.success) return []
  return result.data.records
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((record) => record.data)
}

// User ids of the players dealt in at the start: the owners of the game's clues.
async function dealtPlayerIds(tools: ActionTools, gameId: string): Promise<string[]> {
  const clues = await tools.query<{ ownerId: string }>('clues', { where: { gameId } })
  return clues.success ? [...new Set(clues.data.records.map((c) => c.data.ownerId))] : []
}

// Shared check for host-only actions. Returns an error message, or null if OK.
async function checkHost(tools: ActionTools, userId: string, gameId: string, phase: Phase) {
  const game = await loadGame(tools, gameId)
  if (!game) return 'Game not found'
  if (game.hostId !== userId) return 'Only the host can do that'
  if (game.phase !== phase) return `The game must be in the ${phase} phase`
  return null
}

const createGame: ActionHandler<Env> = async ({ userId, params, tools }) => {
  if (!signedIn(userId)) return fail('Sign in first')
  const displayName = String(params.displayName ?? '').trim()
  if (!displayName) return fail('displayName is required')

  // One unfinished game per host.
  for (const phase of ['lobby', 'investigating', 'voting']) {
    const open = await tools.query('games', { where: { hostId: userId, phase }, limit: 1 })
    if (!open.success) return open
    if (open.data.records.length > 0) return fail('You already have an unfinished game')
  }

  const game = await tools.create('games', { hostId: userId, phase: 'lobby' })
  if (!game.success) return game
  const gameId = game.data.recordId

  // players.userId is userBound, so the server stamps the caller (the host) in.
  const player = await tools.create('players', { gameId, displayName })
  if (!player.success) return player
  return ok({ gameId })
}

const startGame: ActionHandler<Env> = async ({ userId, params, tools, callerJwt }) => {
  if (!signedIn(userId)) return fail('Sign in first')
  const gameId = String(params.gameId ?? '')
  const problem = await checkHost(tools, userId, gameId, 'lobby')
  if (problem) return fail(problem)

  const players = await loadPlayers(tools, gameId)
  if (players.length < 2 || players.length > 4) return fail('A game needs 2 to 4 players')

  // The only AI call in the app. Test accounts (browser tests) get the
  // hand-written fallback, so tests never spend credits or wait on the AI.
  const testAccount = isTestAccountCaller(callerJwt)
  if (testAccount) console.info('[mystery] test account: skipping the AI')
  const { mystery } = await getMystery(players.length, { generate: testAccount ? undefined : claudeGenerator(tools) })

  // hands[i] belongs to players[i]. The full file (with each clue's kind and
  // holder) is kept in the unreadable solutions row until the reveal.
  const hands = dealClues(mystery, players.length)
  const clueFile: ClueFileEntry[] = hands.flatMap((hand, i) =>
    hand.map((clue) => ({ ...clue, holderId: players[i].userId })),
  )

  // Written before any clue: solutions allows one row per game, so a second Start stops here.
  const solution = await tools.create('solutions', {
    gameId,
    culprit: mystery.culprit,
    explanation: mystery.explanation,
    clueFile,
  })
  if (!solution.success) return fail('This game has already started')

  // Players' clue rows carry only the text, never the kind.
  for (const clue of clueFile) {
    const created = await tools.create('clues', { gameId, ownerId: clue.holderId, text: clue.text })
    if (!created.success) return created
  }

  const updated = await tools.update('games', gameId, {
    title: mystery.title,
    setting: mystery.setting,
    victim: mystery.victim,
    suspects: mystery.suspects,
    dealtCount: players.length,
    votesCast: 0,
    phase: 'investigating',
  })
  return updated.success ? ok() : updated
}

const startVoting: ActionHandler<Env> = async ({ userId, params, tools }) => {
  if (!signedIn(userId)) return fail('Sign in first')
  const gameId = String(params.gameId ?? '')
  const problem = await checkHost(tools, userId, gameId, 'investigating')
  if (problem) return fail(problem)

  const updated = await tools.update('games', gameId, { phase: 'voting' })
  return updated.success ? ok() : updated
}

const castVote: ActionHandler<Env> = async ({ userId, params, tools }) => {
  if (!signedIn(userId)) return fail('Sign in first')
  const gameId = String(params.gameId ?? '')
  const suspect = String(params.suspect ?? '')

  const game = await loadGame(tools, gameId)
  if (!game) return fail('Game not found')
  if (game.phase !== 'voting') return fail('Voting is not open')

  const player = await tools.query('players', { where: { gameId, userId }, limit: 1 })
  if (!player.success || player.data.records.length === 0) return fail('You are not a player in this game')

  // Only players present at the deal hold clues; this shuts out late joiners.
  const clues = await tools.query('clues', { where: { gameId, ownerId: userId }, limit: 1 })
  if (!clues.success || clues.data.records.length === 0) return fail('Only players dealt in at the start can vote')

  if (!(game.suspects ?? []).some((s) => s.name === suspect)) return fail('That is not one of the suspects')

  // The votes schema's uniqueOn rule refuses a second vote by the same player.
  const vote = await tools.create('votes', { gameId, voterId: userId, suspect })
  if (!vote.success) return fail(vote.error.startsWith('Duplicate') ? 'You have already voted' : vote.error)

  // Public progress: a recount (not +1), so it stays right even if two votes land at once.
  const allVotes = await tools.query('votes', { where: { gameId } })
  if (allVotes.success) await tools.update('games', gameId, { votesCast: allVotes.data.records.length })
  return ok()
}

const revealGame: ActionHandler<Env> = async ({ userId, params, tools }) => {
  if (!signedIn(userId)) return fail('Sign in first')
  const gameId = String(params.gameId ?? '')
  const problem = await checkHost(tools, userId, gameId, 'voting')
  if (problem) return fail(problem)

  const solutions = await tools.query<Solution>('solutions', { where: { gameId }, limit: 1 })
  const solution = solutions.success ? solutions.data.records[0]?.data : undefined
  if (!solution) return fail('This game has no solution')

  const votes = await tools.query<Vote>('votes', { where: { gameId } })
  if (!votes.success) return votes
  const names = new Map((await loadPlayers(tools, gameId)).map((p) => [p.userId, p.displayName]))
  const nameOf = (id: string) => names.get(id) ?? 'Unknown'

  const revealedVotes = votes.data.records.map((v) => ({ displayName: nameOf(v.data.voterId), suspect: v.data.suspect }))
  const voterIds = new Set(votes.data.records.map((v) => v.data.voterId))
  const revealedNonVoters = (await dealtPlayerIds(tools, gameId)).filter((id) => !voterIds.has(id)).map(nameOf)
  const revealedClues = (solution.clueFile ?? []).map(({ holderId, ...clue }) => ({ ...clue, heldBy: nameOf(holderId) }))

  const updated = await tools.update('games', gameId, {
    revealedCulprit: solution.culprit,
    revealedExplanation: solution.explanation,
    revealedVotes,
    revealedNonVoters,
    revealedClues,
    phase: 'revealed',
  })
  return updated.success ? ok() : updated
}

// Lets a host abandon a game that never started, which frees them to host again.
const cancelGame: ActionHandler<Env> = async ({ userId, params, tools }) => {
  if (!signedIn(userId)) return fail('Sign in first')
  const gameId = String(params.gameId ?? '')
  const problem = await checkHost(tools, userId, gameId, 'lobby')
  if (problem) return fail(problem)

  const updated = await tools.update('games', gameId, { phase: 'cancelled' })
  return updated.success ? ok() : updated
}

const MAX_MESSAGE_LENGTH = 500

// Posts to the game's private chat. Readers are the players dealt in at the
// start (the owners of the game's clues), so late joiners are left out.
const sendMessage: ActionHandler<Env> = async ({ userId, params, tools }) => {
  if (!signedIn(userId)) return fail('Sign in first')
  const gameId = String(params.gameId ?? '')
  const text = String(params.text ?? '').trim()
  if (!text) return fail('Message is empty')
  if (text.length > MAX_MESSAGE_LENGTH) return fail(`Messages are limited to ${MAX_MESSAGE_LENGTH} characters`)

  const game = await loadGame(tools, gameId)
  if (!game) return fail('Game not found')
  if (game.phase !== 'investigating' && game.phase !== 'voting') return fail('Chat is open during the investigation and voting')

  const participants = await dealtPlayerIds(tools, gameId)
  if (!participants.includes(userId)) return fail('Only players in this game can chat')

  const author = (await loadPlayers(tools, gameId)).find((p) => p.userId === userId)
  const created = await tools.create('messages', {
    gameId,
    authorName: author?.displayName ?? 'Detective',
    text,
    participants,
  })
  return created.success ? ok() : created
}

export const gameActions = { createGame, startGame, startVoting, castVote, revealGame, cancelGame, sendMessage }
