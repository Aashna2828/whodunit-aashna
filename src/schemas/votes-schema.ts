import type { CollectionSchema } from 'deepspace/schema'

// Accusations. Written only by the castVote server action (added later),
// which checks the phase, that the caller is a player, and the suspect name.
export const votesSchema: CollectionSchema = {
  name: 'votes',
  columns: [
    { name: 'gameId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    // Set by castVote from the verified caller. Not userBound, same reason as clues.ownerId.
    { name: 'voterId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'suspect', storage: 'text', interpretation: 'plain', required: true },
  ],
  // One vote per user per game, enforced by the server even for server actions.
  uniqueOn: ['gameId', 'voterId'],
  // Lets a player see their own vote; nobody sees anyone else's.
  ownerField: 'voterId',
  permissions: {
    member: { read: 'own', create: false, update: false, delete: false },
    admin: { read: 'own', create: false, update: false, delete: true },
  },
}
