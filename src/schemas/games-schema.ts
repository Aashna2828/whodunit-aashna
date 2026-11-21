import type { CollectionSchema } from 'deepspace/schema'

// One row per game. Players can read it; only server actions write it.
export const gamesSchema: CollectionSchema = {
  name: 'games',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain' },
    { name: 'setting', storage: 'text', interpretation: 'plain' },
    { name: 'victim', storage: 'text', interpretation: 'plain' },
    // List of Suspect objects (see src/mystery/types.ts), stored as JSON.
    { name: 'suspects', storage: 'text', interpretation: 'json' },
    { name: 'hostId', storage: 'text', interpretation: 'plain', required: true },
    {
      name: 'phase',
      storage: 'text',
      interpretation: { kind: 'select', options: ['lobby', 'investigating', 'voting', 'revealed'] },
      default: 'lobby',
    },
    // Empty until the reveal; the real answer lives in `solutions`.
    { name: 'revealedCulprit', storage: 'text', interpretation: 'plain' },
  ],
  permissions: {
    member: { read: true, create: false, update: false, delete: false },
    admin: { read: true, create: false, update: false, delete: true },
  },
}
