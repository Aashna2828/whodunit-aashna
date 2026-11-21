import type { CollectionSchema } from 'deepspace/schema'

// The answer. No user can read or write it; only server actions touch it.
export const solutionsSchema: CollectionSchema = {
  name: 'solutions',
  columns: [
    { name: 'gameId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'culprit', storage: 'text', interpretation: 'plain', required: true },
    { name: 'explanation', storage: 'text', interpretation: 'plain', required: true },
    // Every clue with its kind and holder: { text, suspect, kind, holderId }.
    { name: 'clueFile', storage: 'text', interpretation: 'json' },
  ],
  uniqueOn: ['gameId'],
  permissions: {
    member: { read: false, create: false, update: false, delete: false },
    admin: { read: false, create: false, update: false, delete: false },
  },
}
