import { isAnonymousUserId } from 'deepspace/worker'
import type { ActionHandler, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { dealClues } from '../mystery/deal'
import type { Suspect } from '../mystery/types'
import { getMystery } from './mystery-source'

// The record shapes these actions read (the `data` part of each record).
type Phase = 'lobby' | 'investigating' | 'voting' | 'revealed' | 'cancelled'
type Game = { hostId: string; phase: Phase; suspects?: Suspect[] }
type Player = { gameId: string; userId: string; displayName: string }
type Vote = { voterId: string; suspect: string }
type Solution = { culprit: string; explanation: string }

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

const startGame: ActionHandler<Env> = async ({ userId, params, tools }) => {
  if (!signedIn(userId)) return fail('Sign in first')
  const gameId = String(params.gameId ?? '')
  const problem = await checkHost(tools, userId, gameId, 'lobby')
  if (problem) return fail(problem)

  const players = await loadPlayers(tools, gameId)
  if (players.length < 2 || players.length > 4) return fail('A game needs 2 to 4 players')

  const result = await getMystery(players.length)
  if (!result.ok) return fail(`Could not build a mystery: ${result.errors.join('; ')}`)
  const mystery = result.mystery

  // Written first: solutions allows one row per game, so a second Start stops here.
  const solution = await tools.create('solutions', {
    gameId,
    culprit: mystery.culprit,
    explanation: mystery.explanation,
  })
  if (!solution.success) return fail('This game has already started')

  // hands[i] belongs to players[i]. Only the clue text is stored, never its kind.
  const hands = dealClues(mystery, players.length)
  for (const [i, hand] of hands.entries()) {
    for (const clue of hand) {
      const created = await tools.create('clues', { gameId, ownerId: players[i].userId, text: clue.text })
      if (!created.success) return created
    }
  }

  const updated = await tools.update('games', gameId, {
    title: mystery.title,
    setting: mystery.setting,
    victim: mystery.victim,
    suspects: mystery.suspects,
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
  const revealedVotes = votes.data.records.map((v) => ({
    displayName: names.get(v.data.voterId) ?? 'Unknown',
    suspect: v.data.suspect,
  }))

  const updated = await tools.update('games', gameId, {
    revealedCulprit: solution.culprit,
    revealedExplanation: solution.explanation,
    revealedVotes,
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

  const clues = await tools.query<{ ownerId: string }>('clues', { where: { gameId } })
  if (!clues.success) return clues
  const participants = [...new Set(clues.data.records.map((c) => c.data.ownerId))]
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
