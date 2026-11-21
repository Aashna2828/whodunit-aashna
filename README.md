# Whodunit

Whodunit is a multiplayer murder-mystery game for 2 to 4 friends. An AI writes a fresh case with four suspects, and
every player gets private clues that nobody else can see, so the group has to talk it through before accusing
someone. It is built on [DeepSpace](https://docs.deep.space) and runs on Cloudflare Workers.

**Live:** https://whodunit-aashna.app.space

## How a game works

1. **Lobby.** A signed-in player creates a game (they become the host) and shares the invite link. Friends open it,
   sign in, and join. The host can start with 2 to 4 players, or cancel the game.
2. **Investigating.** Starting the game writes the case (see [AI generation](#ai-generation)) and deals the clues.
   Everyone sees the case file (setting, victim, four suspects). Each player sees only their own clues, and the
   dealt-in players share a private chat.
3. **Voting.** The host opens voting. Each player accuses one suspect, once. Everyone sees "X of N players have
   voted", but not who voted for whom. If the host reveals before everyone has voted, they are asked to confirm.
4. **Revealed.** The culprit and explanation are shown, along with who accused whom, who didn't vote, whether the
   group got it right (the most-voted suspect is the culprit; a tie counts as split), and the full clue file: every
   clue, who held it, and whether it cleared or incriminated someone.

## Run it locally

Requires Node 22.15+, 24 or 26 (see `engines` in `package.json`) and a DeepSpace account.

```sh
npm install
npx deepspace auth login     # opens the browser
npx deepspace dev start      # http://localhost:5173
```

Games you start as your own account take the same AI path as the live site, which is billed to the app owner's
DeepSpace credits (a fraction of a cent per case). Test accounts always get the hand-written case instead.

## Tests

```sh
npx tsc --noEmit             # typecheck
npx vitest run               # unit tests only (34)
npx deepspace test run all   # unit tests, then every Playwright spec (19)
```

`npx deepspace test run` with no argument runs only the smoke and API specs; use `all` for the game tests.

The multi-user specs in `tests/game.spec.ts` sign in as three test accounts named **Alice**, **Bob** and **Carol**.
Create them once per machine (the password is read from stdin, never the command line):

```sh
npx deepspace test accounts create --email alice-<suffix>@deepspace.test --name Alice --password-stdin
# repeat for Bob and Carol, then check:
npx deepspace test accounts list --usable
```

What they cover:

- **Unit:** the mystery validator and dealer; read permissions for both `member` and `admin`, checked with the SDK's
  own `canRead`; AI generation with a fake model (valid reply, retry after an invalid one, fallback after three,
  timeout, logging); the group-verdict rule.
- **Browser, over HTTP and on real screens:** each player reads only their own clues; nobody (host included) can read
  solutions; voting rules (phase, players only, late joiners, one vote each, secret progress counts); the clue file
  stays sealed until the reveal; chat is private to the game; cancel-then-rehost; and a two-browser UI flow from
  invite to reveal with live updates.

Browser tests never call the real AI: the server gives test accounts the fallback case, and every test asserts that
the game it started used it.

## Architecture

```
src/schemas/        collection schemas and their permissions
src/actions/        server actions (game-actions.ts) and AI generation (mystery-source.ts)
src/mystery/        mystery types, validator, clue dealer, fallback case
src/pages/          / (static landing), /home, /game/:id
src/components/     home and game UI, one small component per piece
tests/game.spec.ts  multi-user game tests
```

### Schemas and permissions

Every rule is enforced in the server (the DeepSpace record room) before any data is sent to a browser.

| Collection  | Who can read                                   | Who writes                                    |
| ----------- | ---------------------------------------------- | --------------------------------------------- |
| `games`     | Any signed-in member                           | Server actions only                           |
| `players`   | Any signed-in member                           | A member joins as themselves; one row per user per game |
| `clues`     | Only the clue's owner (`ownerField: ownerId`)  | Server actions only                           |
| `solutions` | Nobody, including admins                       | Server actions only                           |
| `votes`     | Only the voter (`ownerField: voterId`)         | Server actions only; one vote per user per game |
| `messages`  | Only the game's dealt-in players (`collaboratorsField: participants`) | Server actions only |

- `players.userId` is `userBound`: the server stamps the caller's verified id, so nobody can join as someone else.
- `clues.ownerId`, `votes.voterId` and `messages.participants` are deliberately **not** `userBound`. A server action
  sets them, and `userBound` would overwrite them with the id of whoever triggered the action.
- One-per-user rules use `uniqueOn` (`players`: game + user, `votes`: game + voter, `solutions`: game), so a duplicate
  is refused by the server, not just hidden by the UI.
- Admins follow the same rules as members for clues, votes and chat. This matters because the app owner is always an
  admin and often hosts.

### Server actions

`src/actions/game-actions.ts` holds every privileged step, each callable at `POST /api/actions/<name>`:
`createGame`, `startGame`, `startVoting`, `castVote`, `sendMessage`, `revealGame`, `cancelGame`.
Each checks that the caller is signed in, then checks the game rules itself (host only, the right phase, a player
dealt into this game, a real suspect name, 1 to 500 characters of chat) before writing. Errors come back as
`{ success: false, error }` and are shown next to the button that caused them.

### Private clues

`startGame` writes the solution first (its one-per-game rule also stops a double start), then one `clues` row per
clue with `ownerId` set to the player it was dealt to. Clue rows hold only the text, never whether the clue clears
or incriminates. The full clue file (text, suspect, kind, holder) stays in the unreadable `solutions` row until
`revealGame` copies it onto the game. The dealer reshuffles (up to 50 times) to avoid any single player's hand
clearing every innocent, so nobody can solve it alone. Players who join after the deal hold no clues, and so can
watch but not chat or vote.

### AI generation

`getMystery` in `src/actions/mystery-source.ts` is the only place a case comes from:

1. It asks `claude-haiku-5-5` (one constant, `MYSTERY_MODEL`) through DeepSpace's built-in
   `anthropic/chat-completion` integration, for JSON matching `src/mystery/types.ts`. The prompt asks for a random
   setting, short fields, exactly 10 clues, clue text that plainly supports its tag, circumstantial evidence against
   the culprit, a red herring for every innocent, and a cozy, non-graphic story with no real people.
2. `validateMystery` checks every reply: 4 uniquely named suspects, a real culprit, a clearing clue for every innocent
   and none for the culprit, an incriminating clue for every suspect, and enough clues for the players.
3. An invalid reply is retried with the validator's errors in the next prompt, up to 3 attempts within a 45-second
   total budget. After that, or on a timeout, the game starts with the hand-written `FALLBACK_MYSTERY`.
4. Every attempt is logged with its duration and outcome (`npx deepspace logs --search mystery`).

The model reasons before answering and those tokens count toward `max_tokens`, so it is set to 8000. A real run
took about 17 seconds and $0.002.

## DeepSpace features used

| Feature | Used for |
| ------- | -------- |
| Collections with role-based permissions (`ownerField`, `collaboratorsField`, `userBound`, `uniqueOn`) | Server-enforced privacy for clues, votes, chat and the solution, and one-per-user rules |
| Live queries (`useQuery`) over the record room's WebSocket | Every screen follows the game as it changes, with no polling |
| Server actions | Multi-step, privileged game logic that players can't perform directly |
| Integration proxy (`anthropic/chat-completion`) | AI case writing with no API key in the code, billed to the owner's credits |
| Auth and protected routes | Sign-in, and invite links that sign visitors in before the game page |
| Static, prerendered landing page | A fast public front door with no sign-in request or live connection |
| Test fixture with multiple signed-in users (`deepspace/testing`) | Two- and three-player browser tests |
| Deploys, releases, rollback, logs | Shipping, rolling back, and reading the AI attempt logs |

DeepSpace's built-in messaging was not used for chat: it supports public channels only, and a per-game chat has to
stay private to that game's players.

## Known limitations

- **AI speed.** One attempt takes about 17 seconds, so the 45-second budget fits two. A case that needs a third
  attempt falls back to the hand-written one. A slow call can't be cancelled; it finishes in the background and is
  still billed.
- **Fairness is partly unchecked.** The validator counts clues and their tags, but can't tell whether a single clue
  gives the answer away; that relies on the prompt.
- **One fallback case.** When the AI fails, every such game gets the same mystery.
- **"My games" loads every game** and filters in the browser, since queries match exact values only. Fine at this
  scale, not for a large app.
- **No leaving or deleting games.** A host can cancel a game only while it's in the lobby; finished games stay in
  the list.
- **Players can join after the deal** (the schema allows it at any time). They can watch but hold no clues, can't
  chat and can't vote. The 4-player cap is enforced by `startGame` and the UI, not the schema.
- **Games started before a feature existed** lack its data: older reveals show no clue file, and older voting
  screens use the player count as the total.
- **Test data accumulates** in the local dev database, because members can't delete these collections.
