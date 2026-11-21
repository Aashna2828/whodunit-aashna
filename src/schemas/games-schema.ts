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
      interpretation: { kind: 'select', options: ['lobby', 'investigating', 'voting', 'revealed', 'cancelled'] },
      default: 'lobby',
    },
    // Empty until the reveal; the real answer lives in `solutions`.
    { name: 'revealedCulprit', storage: 'text', interpretation: 'plain' },
    { name: 'revealedExplanation', storage: 'text', interpretation: 'plain' },
    // List of { displayName, suspect }, filled in by revealGame.
    { name: 'revealedVotes', storage: 'text', interpretation: 'json' },
    // Display names of dealt-in players who never voted, filled in by revealGame.
    { name: 'revealedNonVoters', storage: 'text', interpretation: 'json' },
    // The full clue file { text, suspect, kind, heldBy }, copied from the solution at the reveal.
    { name: 'revealedClues', storage: 'text', interpretation: 'json' },
    // Vote progress: counts only, never names, so votes stay secret.
    { name: 'dealtCount', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'votesCast', storage: 'number', interpretation: 'plain', default: 0 },
  ],
  permissions: {
    member: { read: true, create: false, update: false, delete: false },
    admin: { read: true, create: false, update: false, delete: true },
  },
}
