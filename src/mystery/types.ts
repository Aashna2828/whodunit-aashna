// The shape of a mystery, as the AI must return it.
// Think of these like Python dataclasses: they describe objects, they don't run.

export type ClueKind = 'clears' | 'incriminates'

export interface Suspect {
  name: string
  role: string // e.g. "the butler"
  description: string
}

export interface Clue {
  text: string
  suspect: string // name of the suspect this clue is about
  kind: ClueKind
}

export interface Mystery {
  title: string
  setting: string
  victim: string
  suspects: Suspect[]
  culprit: string // must match one suspect's name
  explanation: string // shown at the reveal
  clues: Clue[]
}

// The validator returns either a usable mystery or a list of problems.
export type ValidationResult =
  | { ok: true; mystery: Mystery }
  | { ok: false; errors: string[] }

export const SUSPECT_COUNT = 4
export const MIN_CLUES_PER_PLAYER = 2
