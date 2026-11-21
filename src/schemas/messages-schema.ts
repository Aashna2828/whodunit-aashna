import type { CollectionSchema } from 'deepspace/schema'

// Per-game chat. Written only by the sendMessage server action, which stamps
// each message with the game's dealt-in players. Only those players can read it.
export const messagesSchema: CollectionSchema = {
  name: 'messages',
  columns: [
    { name: 'gameId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'authorName', storage: 'text', interpretation: 'plain', required: true },
    { name: 'text', storage: 'text', interpretation: 'plain', required: true },
    // JSON list of user ids allowed to read this message.
    { name: 'participants', storage: 'text', interpretation: 'json', required: true },
  ],
  // 'collaborator' below means: the sender, or anyone listed in `participants`.
  collaboratorsField: 'participants',
  permissions: {
    member: { read: 'collaborator', create: false, update: false, delete: false },
    admin: { read: 'collaborator', create: false, update: false, delete: false },
  },
}
