import { appFiles, isAnonymousUserId } from 'deepspace/worker'
import type { ActionContext, ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import {
  BRIEFING_ENDPOINT,
  COVER_ENDPOINT,
  briefingRequest,
  coverRequest,
  dataUriToBlob,
} from './media-source'
import { isTestAccountCaller } from './test-account'

type Kind = 'cover' | 'briefing'
type GameFacts = { hostId: string; phase: string; title?: string; setting?: string; victim?: string }

// How each kind is requested, read back out of the reply, and stored.
const KINDS: Record<Kind, { endpoint: string; body: (g: GameFacts) => object; uri: (data: unknown) => unknown; ext: string }> = {
  cover: {
    endpoint: COVER_ENDPOINT,
    body: coverRequest,
    uri: (data) => (data as { base64Images?: unknown[] }).base64Images?.[0],
    ext: 'png',
  },
  briefing: {
    endpoint: BRIEFING_ENDPOINT,
    body: briefingRequest,
    uri: (data) => (data as { audioUrl?: unknown }).audioUrl,
    ext: 'mp3',
  },
}

// Generates one optional extra for a started game. The host's browser calls
// this after startGame and never waits for it; any failure just leaves the
// extra hidden. Never changes the game itself.
async function generateMedia(kind: Kind, { userId, params, tools, env, callerJwt }: ActionContext<Env>) {
  if (!userId || isAnonymousUserId(userId)) return { success: false as const, error: 'Sign in first' }
  const gameId = String(params.gameId ?? '')
  const found = gameId ? await tools.get<GameFacts>('games', gameId) : null
  const game = found?.success ? found.data.record.data : null
  if (!game) return { success: false as const, error: 'Game not found' }
  if (game.hostId !== userId) return { success: false as const, error: 'Only the host can do that' }
  if (game.phase === 'lobby' || game.phase === 'cancelled') return { success: false as const, error: 'The game has not started' }

  // Browser tests sign in as test accounts: skip before any paid call.
  if (isTestAccountCaller(callerJwt)) return { success: true as const, data: { skipped: 'test-account' } }

  // One row per game per kind: a second request is refused here, before spending.
  const lock = await tools.create('media', { gameId, kind, status: 'pending' })
  if (!lock.success) return { success: true as const, data: { skipped: 'already-requested' } }
  const mediaId = lock.data.recordId

  const started = Date.now()
  const spec = KINDS[kind]
  try {
    const reply = await tools.integration(spec.endpoint, spec.body(game))
    if (!reply.success) throw new Error(reply.error)
    const blob = dataUriToBlob(spec.uri(reply.data))
    if (!blob) throw new Error('The reply contained no file')
    const file = await appFiles(env, { scope: 'app', userId }).upload(blob, { key: `${kind}s/${gameId}.${spec.ext}` })
    const ms = Date.now() - started
    await tools.update('media', mediaId, { status: 'ready', path: file.path, ms, bytes: blob.size })
    console.info(`[media] kind=${kind} ms=${ms} result=ready bytes=${blob.size}`)
    return { success: true as const, data: {} }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const ms = Date.now() - started
    await tools.update('media', mediaId, { status: 'failed', ms, error: message.slice(0, 500) })
    console.warn(`[media] kind=${kind} ms=${ms} result=failed error=${JSON.stringify(message)}`)
    return { success: false as const, error: message }
  }
}

export const mediaActions: Record<string, ActionHandler<Env>> = {
  generateCover: (ctx) => generateMedia('cover', ctx),
  generateBriefing: (ctx) => generateMedia('briefing', ctx),
}
