/**
 * Multi-user game rules, tested over HTTP (there is no UI yet).
 * Alice hosts, Bob plays, Carol is an outsider / late joiner.
 *
 * Reads go through the agent-tools route as each user, which applies the
 * collection permissions, so a query here returns exactly what that user is
 * allowed to see.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { MultiplayerUser } from 'deepspace/testing'

test.skip(loadAllTestAccounts().length < 3, 'Needs 3 test accounts: npx deepspace test accounts create ...')

// A short-lived sign-in token for this user (what getAuthToken() does in the app).
async function tokenOf(user: MultiplayerUser): Promise<string> {
  const res = await user.page.request.post('/api/auth/token')
  return (await res.json()).token
}

// Calls a server action as `user`. Returns { success, data } or { success: false, error }.
async function callAction(user: MultiplayerUser, name: string, params: Record<string, unknown> = {}) {
  const res = await user.page.request.post(`/api/actions/${name}`, {
    headers: { Authorization: `Bearer ${await tokenOf(user)}` },
    data: params,
  })
  return res.json()
}

// Calls a records tool as `user`, with that user's permissions applied.
async function callTool(user: MultiplayerUser, tool: string, input: Record<string, unknown>) {
  const res = await user.page.request.post(`/_deepspace/agent/browser/tools/${tool}`, {
    headers: { Authorization: `Bearer ${await tokenOf(user)}` },
    data: { input },
  })
  return res.json()
}

// The records `user` can read in `collection` that match `where`.
async function queryAs(user: MultiplayerUser, collection: string, where: Record<string, unknown>) {
  const body = await callTool(user, 'records_query', { collection, where })
  expect(body, JSON.stringify(body)).toMatchObject({ ok: true, result: { success: true } })
  return body.result.data.records as { recordId: string; data: Record<string, unknown> }[]
}

// The client-side join: a user adds their own players row.
async function join(user: MultiplayerUser, gameId: string) {
  const body = await callTool(user, 'records_create', {
    collection: 'players',
    data: { gameId, displayName: user.name },
  })
  expect(body, JSON.stringify(body)).toMatchObject({ ok: true, result: { success: true } })
}

// Opens the app once per user: a signed-in visit creates their user row,
// which the records tools require.
async function openApp(...people: MultiplayerUser[]) {
  for (const user of people) {
    await user.page.goto('/home')
    await expect(user.page.getByTestId('app-navigation')).toBeVisible({ timeout: 15_000 })
  }
}

// Alice creates a game (returns its id).
async function createGame(alice: MultiplayerUser): Promise<string> {
  const created = await callAction(alice, 'createGame', { displayName: alice.name })
  expect(created, JSON.stringify(created)).toMatchObject({ success: true })
  return created.data.gameId
}

// Bob joins, Alice starts the game.
async function joinAndStart(alice: MultiplayerUser, bob: MultiplayerUser, gameId: string) {
  await join(bob, gameId)
  expect(await callAction(alice, 'startGame', { gameId })).toMatchObject({ success: true })
}

// Pushes a game through to "revealed" (errors ignored) so Alice can host again next run.
async function finishGame(alice: MultiplayerUser, bob: MultiplayerUser, gameId: string) {
  await callTool(bob, 'records_create', { collection: 'players', data: { gameId, displayName: bob.name } })
  for (const name of ['startGame', 'startVoting', 'revealGame']) await callAction(alice, name, { gameId })
}

test('each player reads only their own clues', async ({ users }) => {
  const [alice, bob] = await users(['Alice', 'Bob'])
  await openApp(alice, bob)
  const gameId = await createGame(alice)
  try {
    await joinAndStart(alice, bob, gameId)
    const aliceClues = await queryAs(alice, 'clues', { gameId })
    const bobClues = await queryAs(bob, 'clues', { gameId })

    expect(aliceClues.length).toBeGreaterThan(0)
    expect(bobClues.length).toBeGreaterThan(0)
    expect(aliceClues.every((c) => c.data.ownerId === alice.userId)).toBe(true)
    expect(bobClues.every((c) => c.data.ownerId === bob.userId)).toBe(true)

    // Asking for the other player's clues directly returns nothing.
    expect(await queryAs(alice, 'clues', { gameId, ownerId: bob.userId })).toEqual([])
    expect(await queryAs(bob, 'clues', { gameId, ownerId: alice.userId })).toEqual([])

    // No clue was dealt to both players.
    const texts = [...aliceClues, ...bobClues].map((c) => c.data.text)
    expect(aliceClues.length + bobClues.length).toBe(new Set(texts).size)
  } finally {
    await finishGame(alice, bob, gameId)
  }
})

test('nobody, including the host, can read solutions', async ({ users }) => {
  const [alice, bob] = await users(['Alice', 'Bob'])
  await openApp(alice, bob)
  const gameId = await createGame(alice)
  try {
    await joinAndStart(alice, bob, gameId)
    expect(await queryAs(alice, 'solutions', { gameId })).toEqual([])
    expect(await queryAs(bob, 'solutions', { gameId })).toEqual([])
    expect(await queryAs(alice, 'solutions', {})).toEqual([])
  } finally {
    await finishGame(alice, bob, gameId)
  }
})

test('voting rules: phase, players only, late joiners, one vote each', async ({ users }) => {
  const [alice, bob, carol] = await users(['Alice', 'Bob', 'Carol'])
  await openApp(alice, bob, carol)
  const gameId = await createGame(alice)
  try {
    await joinAndStart(alice, bob, gameId)
    const game = (await queryAs(bob, 'games', { recordId: gameId }))[0].data
    const suspect = (game.suspects as { name: string }[])[0].name

    // Not voting yet: still investigating.
    expect(await callAction(bob, 'castVote', { gameId, suspect })).toMatchObject({ success: false })

    expect(await callAction(alice, 'startVoting', { gameId })).toMatchObject({ success: true })

    // Carol is not a player.
    expect(await callAction(carol, 'castVote', { gameId, suspect })).toMatchObject({
      success: false,
      error: 'You are not a player in this game',
    })

    // Carol joins after the deal: she is a player now, but holds no clues.
    await join(carol, gameId)
    expect(await callAction(carol, 'castVote', { gameId, suspect })).toMatchObject({
      success: false,
      error: 'Only players dealt in at the start can vote',
    })

    // Bob's first vote counts; his second is refused.
    expect(await callAction(bob, 'castVote', { gameId, suspect })).toMatchObject({ success: true })
    expect(await callAction(bob, 'castVote', { gameId, suspect })).toMatchObject({
      success: false,
      error: 'You have already voted',
    })

    // After the reveal, voting is closed for everyone.
    expect(await callAction(alice, 'revealGame', { gameId })).toMatchObject({ success: true })
    expect(await callAction(alice, 'castVote', { gameId, suspect })).toMatchObject({
      success: false,
      error: 'Voting is not open',
    })
  } finally {
    await finishGame(alice, bob, gameId)
  }
})

test('chat is private to the game, non-empty, and at most 500 characters', async ({ users }) => {
  const [alice, bob, carol] = await users(['Alice', 'Bob', 'Carol'])
  await openApp(alice, bob, carol)
  const game1 = await createGame(alice)
  const game2 = await createGame(carol)
  try {
    await joinAndStart(alice, bob, game1) // game 1: Alice + Bob
    await joinAndStart(carol, bob, game2) // game 2: Carol + Bob

    expect(await callAction(bob, 'sendMessage', { gameId: game1, text: 'I suspect the gardener' })).toMatchObject({
      success: true,
    })

    // Both game-1 players read it.
    for (const player of [alice, bob]) {
      const messages = await queryAs(player, 'messages', { gameId: game1 })
      expect(messages.map((m) => m.data.text)).toEqual(['I suspect the gardener'])
    }

    // Carol plays in game 2 only: she can neither read nor post in game 1.
    expect(await queryAs(carol, 'messages', { gameId: game1 })).toEqual([])
    expect(await callAction(carol, 'sendMessage', { gameId: game1, text: 'hi' })).toMatchObject({
      success: false,
      error: 'Only players in this game can chat',
    })

    // Empty and over-long messages are refused.
    expect(await callAction(bob, 'sendMessage', { gameId: game1, text: '   ' })).toMatchObject({
      success: false,
      error: 'Message is empty',
    })
    expect(await callAction(bob, 'sendMessage', { gameId: game1, text: 'x'.repeat(501) })).toMatchObject({
      success: false,
      error: 'Messages are limited to 500 characters',
    })
    expect(await callAction(bob, 'sendMessage', { gameId: game1, text: 'x'.repeat(500) })).toMatchObject({
      success: true,
    })
  } finally {
    await finishGame(alice, bob, game1)
    await finishGame(carol, bob, game2)
  }
})

test('a host can cancel a lobby game and then host a new one', async ({ users }) => {
  const [alice] = await users(['Alice'])
  await openApp(alice)
  const first = await createGame(alice)
  expect(await callAction(alice, 'cancelGame', { gameId: first })).toMatchObject({ success: true })
  expect((await queryAs(alice, 'games', { recordId: first }))[0].data.phase).toBe('cancelled')

  const second = await createGame(alice)
  expect(second).not.toBe(first)
  await callAction(alice, 'cancelGame', { gameId: second }) // clean up
})

test('UI: invite, join, start, private clues, and chat all update live', async ({ users }) => {
  const [alice, bob] = await users(['Alice', 'Bob'])
  await openApp(alice, bob)

  // Alice creates a game from /home and lands on its page.
  await alice.page.getByRole('button', { name: 'Create game' }).first().click()
  const dialog = alice.page.getByRole('dialog')
  await dialog.getByLabel('Your detective name').fill('Alice')
  await dialog.getByRole('button', { name: 'Create game' }).click()
  await alice.page.waitForURL(/\/game\//)
  const gameId = alice.page.url().split('/game/')[1]

  try {
    // Bob opens the invite link and joins; Alice's list shows him without a reload.
    await bob.page.goto(`/game/${gameId}`)
    await bob.page.getByLabel('Your detective name').fill('Bob')
    await bob.page.getByRole('button', { name: 'Join' }).click()
    await expect(alice.page.getByTestId('player-list')).toContainText('Bob')

    // Alice starts; both screens switch to the case file.
    await alice.page.getByRole('button', { name: 'Start the investigation' }).click()
    for (const user of [alice, bob]) {
      await expect(user.page.getByTestId('case-file')).toBeVisible()
      await expect(user.page.getByTestId('my-clue').first()).toBeVisible()
    }

    // None of Bob's clues appear on Alice's screen.
    const aliceScreen = await alice.page.getByTestId('my-clues').innerText()
    for (const clue of await queryAs(bob, 'clues', { gameId })) {
      expect(aliceScreen).not.toContain(String(clue.data.text))
    }

    // Bob posts in chat; Alice sees it live.
    await bob.page.getByLabel('Message').fill('Check the greenhouse')
    await bob.page.getByRole('button', { name: 'Send' }).click()
    await expect(alice.page.getByTestId('game-chat')).toContainText('Bob: Check the greenhouse')

    // Alice's home lists the game with its phase.
    await alice.page.goto('/home')
    await expect(alice.page.getByTestId('my-games')).toContainText('Investigating')
  } finally {
    await finishGame(alice, bob, gameId)
  }
})

test('actions refuse callers who are not signed in', async ({ request }) => {
  const res = await request.post('/api/actions/createGame', { data: { displayName: 'Nobody' } })
  expect(res.status()).toBe(401)
})
