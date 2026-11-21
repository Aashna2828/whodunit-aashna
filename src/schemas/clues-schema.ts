import type { CollectionSchema } from 'deepspace/schema'

// Private clues. Each player can read only the clues dealt to them.
export const cluesSchema: CollectionSchema = {
  name: 'clues',
  columns: [
    { name: 'gameId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    // Set by the server action that deals clues. Deliberately NOT userBound:
    // userBound would overwrite it with the id of whoever triggered the deal.
    { name: 'ownerId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'text', storage: 'text', interpretation: 'plain', required: true },
  ],
  // 'own' below means "data.ownerId equals the reader's id" (not createdBy).
  ownerField: 'ownerId',
  permissions: {
    member: { read: 'own', create: false, update: false, delete: false },
    // Locked out too, so the app owner can play without seeing every clue.
    admin: { read: false, create: false, update: false, delete: false },
  },
}
