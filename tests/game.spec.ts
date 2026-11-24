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
import { FALLBACK_MYSTERY } from '../src/mystery/fallback'

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

// A crashed earlier run can leave a host with an unfinished game, which makes
// createGame refuse. Close any such game first: cancel it in the lobby, or
// push it through to the reveal.
async function closeUnfinishedGames(host: MultiplayerUser) {
  for (const phase of ['lobby', 'investigating', 'voting']) {
    for (const game of await queryAs(host, 'games', { hostId: host.userId, phase })) {
      const gameId = game.recordId
      if (phase === 'lobby') await callAction(host, 'cancelGame', { gameId })
      if (phase === 'investigating') await callAction(host, 'startVoting', { gameId })
      if (phase !== 'lobby') await callAction(host, 'revealGame', { gameId })
    }
  }
}

// Alice creates a game (returns its id).
async function createGame(alice: MultiplayerUser): Promise<string> {
  await closeUnfinishedGames(alice)
  const created = await callAction(alice, 'createGame', { displayName: alice.name })
  expect(created, JSON.stringify(created)).toMatchObject({ success: true })
  return created.data.gameId
}

// Bob joins, Alice starts the game.
async function joinAndStart(alice: MultiplayerUser, bob: MultiplayerUser, gameId: string) {
  await join(bob, gameId)
  expect(await callAction(alice, 'startGame', { gameId })).toMatchObject({ success: true })
  await expectFallbackMystery(alice, gameId)
}

// Test accounts must never reach the paid AI: every game they start uses the
// hand-written fallback. If this fails, a test is spending real credits.
async function expectFallbackMystery(user: MultiplayerUser, gameId: string) {
  const game = (await queryAs(user, 'games', { recordId: gameId }))[0].data
  expect(game.title, 'a test game used the AI instead of the fallback').toBe(FALLBACK_MYSTERY.title)
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

    // Vote progress starts at 0 of 2 (Carol, a late joiner, isn't counted).
    const progress = async () => (await queryAs(carol, 'games', { recordId: gameId }))[0].data
    expect(await progress()).toMatchObject({ votesCast: 0, dealtCount: 2 })

    // Bob's first vote counts; his second is refused.
    expect(await callAction(bob, 'castVote', { gameId, suspect })).toMatchObject({ success: true })
    expect(await callAction(bob, 'castVote', { gameId, suspect })).toMatchObject({
      success: false,
      error: 'You have already voted',
    })

    // Everyone sees the count go up, still 1 after the refused second vote,
    // and the game row never names who voted.
    expect(await progress()).toMatchObject({ votesCast: 1, dealtCount: 2 })
    expect(JSON.stringify(await progress())).not.toContain(bob.userId)

    // After the reveal, voting is closed for everyone, and Alice is listed as
    // not having voted (Carol was never dealt in, so she isn't listed).
    expect(await callAction(alice, 'revealGame', { gameId })).toMatchObject({ success: true })
    expect(await callAction(alice, 'castVote', { gameId, suspect })).toMatchObject({
      success: false,
      error: 'Voting is not open',
    })
    expect((await progress()).revealedNonVoters).toEqual(['Alice'])
  } finally {
    await finishGame(alice, bob, gameId)
  }
})

test('the full clue file stays sealed until the reveal, then shows every clue and holder', async ({ users }) => {
  const [alice, bob] = await users(['Alice', 'Bob'])
  await openApp(alice, bob)
  const gameId = await createGame(alice)
  try {
    await joinAndStart(alice, bob, gameId)
    const owned = { Alice: await queryAs(alice, 'clues', { gameId }), Bob: await queryAs(bob, 'clues', { gameId }) }

    // Before the reveal: no clue file on the game, no kind or suspect on any
    // clue row a player can read, and the solutions row stays unreadable.
    for (const user of [alice, bob]) {
      const game = (await queryAs(user, 'games', { recordId: gameId }))[0].data
      expect(game.revealedClues).toBeUndefined()
      expect(await queryAs(user, 'solutions', { gameId })).toEqual([])
    }
    for (const clue of [...owned.Alice, ...owned.Bob]) {
      expect(Object.keys(clue.data).sort()).toEqual(['gameId', 'ownerId', 'text'])
    }

    expect(await callAction(alice, 'startVoting', { gameId })).toMatchObject({ success: true })
    expect((await queryAs(bob, 'games', { recordId: gameId }))[0].data.revealedClues).toBeUndefined()
    expect(await callAction(alice, 'revealGame', { gameId })).toMatchObject({ success: true })

    // After the reveal: every clue, each attributed to the player who held it.
    const file = (await queryAs(bob, 'games', { recordId: gameId }))[0].data.revealedClues as {
      text: string
      heldBy: 'Alice' | 'Bob'
      kind: string
      suspect: string
    }[]
    expect(file.length).toBe(owned.Alice.length + owned.Bob.length)
    for (const clue of file) {
      expect(owned[clue.heldBy].map((c) => c.data.text)).toContain(clue.text)
      expect(['clears', 'incriminates']).toContain(clue.kind)
      expect(clue.suspect).toBeTruthy()
    }
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

test('UI: invite, join, start, private clues, chat, voting and reveal all update live', async ({ users }) => {
  const [alice, bob] = await users(['Alice', 'Bob'])
  await openApp(alice, bob)
  await closeUnfinishedGames(alice)
  await alice.page.reload()

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

    // Alice starts. The fallback answers fast, so hold her request in the
    // browser for a moment (it still reaches the real server) to see the
    // "Writing your case..." label that a slower AI reply would show.
    await alice.page.route('**/api/actions/startGame', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800))
      await route.continue()
    })
    await alice.page.getByRole('button', { name: 'Start the investigation' }).click()
    await expect(alice.page.getByRole('button', { name: 'Writing your case... (20-40 seconds)' })).toBeVisible()
    await expect(alice.page.getByTestId('case-file')).toBeVisible()
    await expectFallbackMystery(alice, gameId)

    // The extras were requested but skipped (test account), so the case file
    // simply shows none: no cover, no briefing button, and nothing broken.
    for (const user of [alice, bob]) {
      await expect(user.page.getByTestId('case-cover')).toHaveCount(0)
      await expect(user.page.getByTestId('case-briefing')).toHaveCount(0)
    }

    // EVERY dealt player, host included, sees their own clues on screen:
    // at least one, exactly as many as they own, and never the "no clues" notice.
    for (const user of [alice, bob]) {
      await expect(user.page.getByTestId('case-file')).toBeVisible()
      const owned = await queryAs(user, 'clues', { gameId })
      expect(owned.length, `${user.name} owns no clues`).toBeGreaterThan(0)
      await expect(user.page.getByTestId('my-clue')).toHaveCount(owned.length)
      await expect(user.page.getByText('No clues for you')).toHaveCount(0)
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

    // Voting: both screens show progress; the host who has voted gets the host message.
    await alice.page.getByRole('button', { name: 'Start voting' }).click()
    for (const user of [alice, bob]) {
      await expect(user.page.getByTestId('vote-progress')).toContainText('0 of 2 players have voted')
    }
    await alice.page.getByRole('radio').first().click()
    await alice.page.getByRole('button', { name: /^Accuse / }).click()
    await expect(alice.page.getByTestId('vote-done')).toContainText("You're the host. Reveal when everyone has voted.")
    await expect(alice.page.getByText('Waiting for the host to reveal')).toHaveCount(0)
    for (const user of [alice, bob]) {
      await expect(user.page.getByTestId('vote-progress')).toContainText('1 of 2 players have voted')
    }

    // Bob hasn't voted, so revealing asks first.
    await alice.page.getByRole('button', { name: 'Reveal the culprit' }).click()
    const confirm = alice.page.getByRole('dialog')
    await expect(confirm).toContainText("1 player hasn't voted yet. Reveal anyway?")
    await confirm.getByRole('button', { name: 'Reveal the culprit' }).click()

    // Reveal: the full clue file, who didn't vote, and a New case button, on both screens.
    const total = (await queryAs(alice, 'clues', { gameId })).length + (await queryAs(bob, 'clues', { gameId })).length
    for (const user of [alice, bob]) {
      await expect(user.page.getByTestId('revealed-clue')).toHaveCount(total)
      await expect(user.page.getByTestId('revealed-clues')).toContainText('Held by Alice')
      await expect(user.page.getByTestId('revealed-clues')).toContainText('Held by Bob')
      await expect(user.page.getByTestId('non-voters')).toHaveText("Bob didn't vote")
      await expect(user.page.getByRole('button', { name: 'New case' })).toBeVisible()
    }

    // Alice's home lists this game as solved.
    await alice.page.goto('/home')
    const row = alice.page.getByTestId('game-row').filter({ has: alice.page.locator(`a[href="/game/${gameId}"]`) })
    await expect(row).toContainText('Solved')
  } finally {
    await finishGame(alice, bob, gameId)
  }
})

test('case extras (cover, briefing) are host-only, after the start, and skipped for test accounts', async ({ users }) => {
  const [alice, bob] = await users(['Alice', 'Bob'])
  await openApp(alice, bob)
  const gameId = await createGame(alice)
  try {
    // Not before the game starts.
    expect(await callAction(alice, 'generateCover', { gameId })).toMatchObject({
      success: false,
      error: 'The game has not started',
    })
    await joinAndStart(alice, bob, gameId)

    // Only the host can ask.
    expect(await callAction(bob, 'generateBriefing', { gameId })).toMatchObject({
      success: false,
      error: 'Only the host can do that',
    })

    // Test accounts are skipped before any paid call, and nothing is stored.
    for (const name of ['generateCover', 'generateBriefing']) {
      expect(await callAction(alice, name, { gameId })).toMatchObject({ success: true, data: { skipped: 'test-account' } })
    }
    expect(await queryAs(alice, 'media', { gameId })).toEqual([])
  } finally {
    await finishGame(alice, bob, gameId)
  }
})

test('actions refuse callers who are not signed in', async ({ request }) => {
  const res = await request.post('/api/actions/createGame', { data: { displayName: 'Nobody' } })
  expect(res.status()).toBe(401)
})
