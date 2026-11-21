import { test, expect } from 'vitest'
import { validateMystery } from './validate'
import { dealClues, canSolveAlone } from './deal'
import { FALLBACK_MYSTERY } from './fallback'
import type { Mystery } from './types'

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
