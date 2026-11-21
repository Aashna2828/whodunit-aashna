import { expect, test } from 'vitest'
import { groupVerdict } from './RevealView'

const votes = (...suspects: string[]) => suspects.map((suspect) => ({ suspect }))

test('the most-voted suspect decides the verdict', () => {
  expect(groupVerdict(votes('Mabel', 'Mabel', 'Iris'), 'Mabel')).toBe('right')
  expect(groupVerdict(votes('Iris', 'Iris', 'Mabel'), 'Mabel')).toBe('wrong')
})

test('a tie for most votes is split, and no votes is none', () => {
  expect(groupVerdict(votes('Mabel', 'Iris'), 'Mabel')).toBe('split')
  expect(groupVerdict([], 'Mabel')).toBe('none')
})
