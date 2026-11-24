import {
  type Clue,
  type Mystery,
  type ValidationResult,
  SUSPECT_COUNT,
  MIN_CLUES_PER_PLAYER,
} from './types'

// Takes the AI's raw text reply and decides whether it is a playable mystery.
// A mystery is solvable by elimination when every innocent suspect is cleared
// by at least one clue and the culprit is cleared by none.
export function validateMystery(raw: string, playerCount: number): ValidationResult {
  // Step 1: parse. Models sometimes wrap JSON in ``` fences, so strip those first.
  let data: unknown
  try {
    data = JSON.parse(raw.replace(/```json|```/g, '').trim())
  } catch {
    return { ok: false, errors: ['Reply is not valid JSON'] }
  }

  // Step 2: check the shape before trusting any field.
  const shapeErrors = checkShape(data)
  if (shapeErrors.length > 0) return { ok: false, errors: shapeErrors }
  const mystery = data as Mystery

  // Step 3: check the game rules.
  const errors: string[] = []
  const names = mystery.suspects.map((s) => s.name)

  if (names.length !== SUSPECT_COUNT) {
    errors.push(`Expected ${SUSPECT_COUNT} suspects, got ${names.length}`)
  }
  if (new Set(names).size !== names.length) {
    errors.push('Suspect names are not unique')
  }
  if (!names.includes(mystery.culprit)) {
    errors.push(`Culprit "${mystery.culprit}" is not one of the suspects`)
  }

  // Name the wrong names and the right ones, so a retry knows exactly what to fix.
  const unknown = [...new Set(mystery.clues.map((c) => c.suspect).filter((s) => !names.includes(s)))]
  if (unknown.length > 0) {
    errors.push(
      `Clues name suspects who are not in the suspect list: ${quoteList(unknown)}. ` +
        `Each clue's "suspect" must be exactly one of: ${quoteList(names)}`,
    )
  }

  for (const name of names) {
    const clearing = countClues(mystery.clues, name, 'clears')
    if (name === mystery.culprit) {
      if (clearing > 0) errors.push('The culprit has a clue that clears them')
      if (countClues(mystery.clues, name, 'incriminates') === 0) {
        errors.push('The culprit has no incriminating clue')
      }
    } else {
      if (clearing === 0) errors.push(`Innocent suspect "${name}" has no clue clearing them`)
      // Fairness: every suspect looks guilty at first, so the culprit isn't
      // simply "the only one with an incriminating clue".
      if (countClues(mystery.clues, name, 'incriminates') === 0) {
        errors.push(`Innocent suspect "${name}" has no incriminating (red herring) clue`)
      }
    }
  }

  const needed = playerCount * MIN_CLUES_PER_PLAYER
  if (mystery.clues.length < needed) {
    errors.push(`Need at least ${needed} clues for ${playerCount} players, got ${mystery.clues.length}`)
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, mystery }
}

// ['a', 'b'] → '"a", "b"'
function quoteList(items: string[]): string {
  return items.map((item) => `"${item}"`).join(', ')
}

function countClues(clues: Clue[], suspect: string, kind: Clue['kind']): number {
  return clues.filter((c) => c.suspect === suspect && c.kind === kind).length
}

// Confirms every field exists with the right type. Returns a list of problems.
function checkShape(data: unknown): string[] {
  if (typeof data !== 'object' || data === null) return ['Reply is not a JSON object']
  const d = data as Record<string, unknown>
  const errors: string[] = []

  for (const field of ['title', 'setting', 'victim', 'culprit', 'explanation']) {
    if (typeof d[field] !== 'string' || d[field] === '') errors.push(`Missing text field "${field}"`)
  }

  if (!Array.isArray(d.suspects)) {
    errors.push('"suspects" is not a list')
  } else if (!d.suspects.every((s) => isObject(s) && typeof s.name === 'string')) {
    errors.push('A suspect is missing a name')
  }

  if (!Array.isArray(d.clues)) {
    errors.push('"clues" is not a list')
  } else if (
    !d.clues.every(
      (c) =>
        isObject(c) &&
        typeof c.text === 'string' &&
        typeof c.suspect === 'string' &&
        (c.kind === 'clears' || c.kind === 'incriminates'),
    )
  ) {
    errors.push('A clue is missing text, suspect, or a valid kind')
  }

  return errors
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}
