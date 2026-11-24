import { test, expect } from 'vitest'
import { validateMystery } from './validate'
import { dealClues, canSolveAlone, holdsTooMuchAgainstCulprit } from './deal'
import { FALLBACK_MYSTERY } from './fallback'
import type { Clue, Mystery } from './types'

// Makes a modified copy of the fallback, so each test changes one thing.
function variant(change: (m: Mystery) => void): string {
  const copy: Mystery = structuredClone(FALLBACK_MYSTERY)
  change(copy)
  return JSON.stringify(copy)
}

function errorsOf(raw: string, players = 4): string[] {
  const result = validateMystery(raw, players)
  return result.ok ? [] : result.errors
}

test('the fallback mystery passes validation', () => {
  expect(errorsOf(JSON.stringify(FALLBACK_MYSTERY))).toStrictEqual([])
})

test('JSON wrapped in ``` fences is accepted', () => {
  const fenced = '```json\n' + JSON.stringify(FALLBACK_MYSTERY) + '\n```'
  expect(validateMystery(fenced, 4).ok).toBe(true)
})

test('text that is not JSON is rejected', () => {
  expect(errorsOf('Sure! Here is your mystery...')).toStrictEqual(['Reply is not valid JSON'])
})

test('a missing field is rejected before rule checks run', () => {
  const errors = errorsOf(variant((m) => { (m as Partial<Mystery>).culprit = undefined }))
  expect(errors.includes('Missing text field "culprit"')).toBeTruthy()
})

test('a culprit who is not a suspect is rejected', () => {
  const errors = errorsOf(variant((m) => { m.culprit = 'Nobody' }))
  expect(errors.some((e) => e.includes('not one of the suspects'))).toBeTruthy()
})

test('a clue naming an unknown suspect is rejected, naming the wrong and the valid names', () => {
  // "Otto Kemp" drops the title; the suspect is "Dr. Otto Kemp".
  const errors = errorsOf(
    variant((m) => {
      for (const c of m.clues) if (c.suspect === 'Dr. Otto Kemp') c.suspect = 'Otto Kemp'
    }),
  )
  expect(errors).toContain(
    'Clues name suspects who are not in the suspect list: "Otto Kemp". ' +
      'Each clue\'s "suspect" must be exactly one of: "Iris Vane", "Dr. Otto Kemp", "Mabel Rook", "Felix Arden"',
  )
})

test('an innocent with no clearing clue is rejected', () => {
  const errors = errorsOf(
    variant((m) => { m.clues = m.clues.filter((c) => !(c.suspect === 'Felix Arden' && c.kind === 'clears')) }),
  )
  expect(errors.includes('Innocent suspect "Felix Arden" has no clue clearing them')).toBeTruthy()
})

test('a culprit with a clearing clue is rejected', () => {
  const errors = errorsOf(
    variant((m) => { m.clues.push({ suspect: 'Mabel Rook', kind: 'clears', text: 'She was elsewhere.' }) }),
  )
  expect(errors.includes('The culprit has a clue that clears them')).toBeTruthy()
})

test('an innocent with no incriminating clue is rejected', () => {
  const errors = errorsOf(
    variant((m) => { m.clues = m.clues.filter((c) => !(c.suspect === 'Felix Arden' && c.kind === 'incriminates')) }),
  )
  expect(errors).toContain('Innocent suspect "Felix Arden" has no incriminating (red herring) clue')
})

test('too few clues for the number of players is rejected', () => {
  const errors = errorsOf(JSON.stringify(FALLBACK_MYSTERY), 6) // 10 clues < 6 players x 2
  expect(errors.some((e) => e.startsWith('Need at least 12 clues'))).toBeTruthy()
})

// Clues against the culprit in one hand.
const againstCulprit = (hand: Clue[], m: Mystery) =>
  hand.filter((c) => c.suspect === m.culprit && c.kind === 'incriminates').length

test('with 2 clues against the culprit and 2 players, nobody holds both (the reported game)', () => {
  // The fallback has 3 such clues; drop one so there are exactly 2.
  const mystery: Mystery = structuredClone(FALLBACK_MYSTERY)
  const firstIndex = mystery.clues.findIndex((c) => c.suspect === mystery.culprit && c.kind === 'incriminates')
  mystery.clues.splice(firstIndex, 1)
  expect(againstCulprit(mystery.clues, mystery)).toBe(2)

  for (let run = 0; run < 300; run++) {
    const hands = dealClues(mystery, 2)
    expect(hands.map((hand) => againstCulprit(hand, mystery))).toEqual([1, 1])
    expect(hands.some((hand) => canSolveAlone(hand, mystery))).toBe(false)
  }
})

test('the evidence against the culprit is spread as evenly as the players allow', () => {
  // 3 clues against the culprit: at most 1 each with 3 or 4 players, at most 2 with 2.
  for (const [players, maxEach] of [[2, 2], [3, 1], [4, 1]]) {
    for (let run = 0; run < 200; run++) {
      const hands = dealClues(FALLBACK_MYSTERY, players)
      expect(Math.max(...hands.map((hand) => againstCulprit(hand, FALLBACK_MYSTERY)))).toBeLessThanOrEqual(maxEach)
    }
  }
})

test('holdsTooMuchAgainstCulprit compares a hand with its fair share', () => {
  const both = FALLBACK_MYSTERY.clues.filter((c) => c.suspect === FALLBACK_MYSTERY.culprit).slice(0, 2)
  expect(holdsTooMuchAgainstCulprit(both, FALLBACK_MYSTERY, 4)).toBe(true) // share of 3 among 4 is 1
  expect(holdsTooMuchAgainstCulprit(both, FALLBACK_MYSTERY, 2)).toBe(false) // share of 3 among 2 is 2
  expect(holdsTooMuchAgainstCulprit(both.slice(0, 1), FALLBACK_MYSTERY, 4)).toBe(false)
})

test('every clue is dealt exactly once, and nobody can solve alone', () => {
  for (const players of [2, 3, 4]) {
    for (let run = 0; run < 200; run++) {
      const hands = dealClues(FALLBACK_MYSTERY, players)
      expect(hands.length).toBe(players)
      expect(hands.flat().length).toBe(FALLBACK_MYSTERY.clues.length)
      expect(hands.every((hand) => !canSolveAlone(hand, FALLBACK_MYSTERY))).toBeTruthy()
    }
  }
})
