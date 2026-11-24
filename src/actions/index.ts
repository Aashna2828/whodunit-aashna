import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { gameActions } from './game-actions'
import { mediaActions } from './media-actions'

// Each key becomes POST /api/actions/<key>.
export const actions: Record<string, ActionHandler<Env>> = { ...gameActions, ...mediaActions }
