// Checks the read rules with the SDK's own permission function, for BOTH roles
// a player can have. The app owner is always an admin, and the owner often
// hosts, so every rule a player depends on must hold for admins too.
import { expect, test } from 'vitest'
import { canRead } from 'deepspace/worker'
import { cluesSchema } from './clues-schema'
import { solutionsSchema } from './solutions-schema'
import { votesSchema } from './votes-schema'
import { messagesSchema } from './messages-schema'

const SERVER = 'server-action-caller' // rows are created by server actions
const ROLES = ['member', 'admin']

test.each(ROLES)('a %s reads their own clues and nobody else’s', (role) => {
  const mine = { data: { gameId: 'g', ownerId: 'me', text: 'x' }, createdBy: SERVER }
  const theirs = { data: { gameId: 'g', ownerId: 'them', text: 'y' }, createdBy: SERVER }
  expect(canRead(cluesSchema, role, mine, 'me')).toBe(true)
  expect(canRead(cluesSchema, role, theirs, 'me')).toBe(false)
})

test.each(ROLES)('a %s reads their own vote and nobody else’s', (role) => {
  expect(canRead(votesSchema, role, { data: { voterId: 'me' }, createdBy: 'me' }, 'me')).toBe(true)
  expect(canRead(votesSchema, role, { data: { voterId: 'them' }, createdBy: 'them' }, 'me')).toBe(false)
})

test.each(ROLES)('a %s reads chat only in games they were dealt into', (role) => {
  const message = (participants: string[]) => ({ data: { participants }, createdBy: 'them' })
  expect(canRead(messagesSchema, role, message(['them', 'me']), 'me')).toBe(true)
  expect(canRead(messagesSchema, role, message(['them', 'other']), 'me')).toBe(false)
})

test.each(ROLES)('a %s cannot read any solution', (role) => {
  expect(canRead(solutionsSchema, role, { data: { gameId: 'g' }, createdBy: SERVER }, 'me')).toBe(false)
})
