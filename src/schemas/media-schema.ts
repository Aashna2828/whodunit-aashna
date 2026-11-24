import type { CollectionSchema } from 'deepspace/schema'

// Optional extras per game: a cover image and a narrated briefing. Written only
// by the generateCover / generateBriefing server actions. One row per game per
// kind, which also stops a second (paid) request for the same thing.
export const mediaSchema: CollectionSchema = {
  name: 'media',
  columns: [
    { name: 'gameId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'kind', storage: 'text', interpretation: { kind: 'select', options: ['cover', 'briefing'] }, required: true, immutable: true },
    { name: 'status', storage: 'text', interpretation: { kind: 'select', options: ['pending', 'ready', 'failed'] }, required: true },
    // Where the app serves the file (public app-scope storage), once ready.
    { name: 'path', storage: 'text', interpretation: 'plain' },
  ],
  uniqueOn: ['gameId', 'kind'],
  permissions: {
    // Covers and briefings show only public case facts (title, setting, victim).
    member: { read: true, create: false, update: false, delete: false },
    admin: { read: true, create: false, update: false, delete: true },
  },
}
