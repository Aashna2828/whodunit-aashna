import type { CollectionSchema } from 'deepspace/schema'

// Who has joined which game. A user adds their own row to join.
export const playersSchema: CollectionSchema = {
  name: 'players',
  columns: [
    { name: 'gameId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    // userBound: the server fills this with the caller's real id,
    // so nobody can join a game as someone else.
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'displayName', storage: 'text', interpretation: 'plain', required: true },
  ],
  // One row per user per game; a second join is refused by the server.
  uniqueOn: ['gameId', 'userId'],
  permissions: {
    member: { read: true, create: true, update: false, delete: false },
    admin: { read: true, create: true, update: false, delete: true },
  },
}
