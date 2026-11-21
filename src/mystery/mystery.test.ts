import { test } from 'node:test'
import assert from 'node:assert/strict'
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
  assert.deepEqual(errorsOf(JSON.stringify(FALLBACK_MYSTERY)), [])
})

test('JSON wrapped in ``` fences is accepted', () => {
  const fenced = '```json\n' + JSON.stringify(FALLBACK_MYSTERY) + '\n```'
  assert.equal(validateMystery(fenced, 4).ok, true)
})

test('text that is not JSON is rejected', () => {
  assert.deepEqual(errorsOf('Sure! Here is your mystery...'), ['Reply is not valid JSON'])
})

test('a missing field is rejected before rule checks run', () => {
  const errors = errorsOf(variant((m) => { (m as Partial<Mystery>).culprit = undefined }))
  assert.ok(errors.includes('Missing text field "culprit"'))
})

test('a culprit who is not a suspect is rejected', () => {
  const errors = errorsOf(variant((m) => { m.culprit = 'Nobody' }))
  assert.ok(errors.some((e) => e.includes('not one of the suspects')))
})

test('an innocent with no clearing clue is rejected', () => {
  const errors = errorsOf(
    variant((m) => { m.clues = m.clues.filter((c) => !(c.suspect === 'Felix Arden' && c.kind === 'clears')) }),
  )
  assert.ok(errors.includes('Innocent suspect "Felix Arden" has no clue clearing them'))
})

test('a culprit with a clearing clue is rejected', () => {
  const errors = errorsOf(
    variant((m) => { m.clues.push({ suspect: 'Mabel Rook', kind: 'clears', text: 'She was elsewhere.' }) }),
  )
  assert.ok(errors.includes('The culprit has a clue that clears them'))
})

test('too few clues for the number of players is rejected', () => {
  const errors = errorsOf(JSON.stringify(FALLBACK_MYSTERY), 6) // 10 clues < 6 players x 2
  assert.ok(errors.some((e) => e.startsWith('Need at least 12 clues')))
})

test('every clue is dealt exactly once, and nobody can solve alone', () => {
  for (const players of [2, 3, 4]) {
    for (let run = 0; run < 200; run++) {
      const hands = dealClues(FALLBACK_MYSTERY, players)
      assert.equal(hands.length, players)
      assert.equal(hands.flat().length, FALLBACK_MYSTERY.clues.length)
      assert.ok(hands.every((hand) => !canSolveAlone(hand, FALLBACK_MYSTERY)))
    }
  }
})
