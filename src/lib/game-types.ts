// What the browser reads from each collection (the `data` part of a record).
import type { Suspect } from '../mystery/types'

export type Phase = 'lobby' | 'investigating' | 'voting' | 'revealed' | 'cancelled'

export type Game = {
  title?: string
  setting?: string
  victim?: string
  suspects?: Suspect[]
  hostId: string
  phase: Phase
  revealedCulprit?: string
  revealedExplanation?: string
  revealedVotes?: { displayName: string; suspect: string }[]
}

export type Player = { gameId: string; userId: string; displayName: string }
export type Clue = { gameId: string; ownerId: string; text: string }
export type Vote = { gameId: string; voterId: string; suspect: string }
export type ChatMessage = { gameId: string; authorName: string; text: string }

// The envelope every record arrives in: your fields live under `data`.
export type Rec<T> = { recordId: string; data: T; createdBy: string; createdAt: string }

export const MAX_PLAYERS = 4
export const MIN_PLAYERS = 2
export const MAX_MESSAGE_LENGTH = 500
