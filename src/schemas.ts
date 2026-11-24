/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth — imported by both worker and frontend.
 *
 * Add schemas by creating a file in src/schemas/ and importing it here.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { usersSchema } from './schemas/users-schema'
import { settingsSchema } from './schemas/admin-schema'
import { gamesSchema } from './schemas/games-schema'
import { playersSchema } from './schemas/players-schema'
import { cluesSchema } from './schemas/clues-schema'
import { solutionsSchema } from './schemas/solutions-schema'
import { votesSchema } from './schemas/votes-schema'
import { messagesSchema } from './schemas/messages-schema'
import { mediaSchema } from './schemas/media-schema'

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  gamesSchema,
  playersSchema,
  cluesSchema,
  solutionsSchema,
  votesSchema,
  messagesSchema,
  mediaSchema,
]
