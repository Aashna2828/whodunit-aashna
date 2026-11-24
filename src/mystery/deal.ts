import type { Clue, Mystery } from './types'

// Two rules must hold at once now, so allow more reshuffles (each is microseconds).
const MAX_SHUFFLES = 200

// Splits the clues between players, round-robin, after shuffling.
// Returns one list of clues per player (hands[0] is player 0's clues).
// Reshuffles until the deal is fair, so players must talk:
//   1. nobody's clues clear every innocent (they could solve it alone), and
//   2. nobody holds too much of the evidence against the culprit.
// `random` is a parameter so tests can pass a predictable one.
export function dealClues(
  mystery: Mystery,
  playerCount: number,
  random: () => number = Math.random,
): Clue[][] {
  let hands: Clue[][] = []
  for (let attempt = 0; attempt < MAX_SHUFFLES; attempt++) {
    const shuffled = shuffle(mystery.clues, random)
    hands = Array.from({ length: playerCount }, () => [])
    shuffled.forEach((clue, i) => hands[i % playerCount].push(clue))

    const unfair = hands.some(
      (hand) => canSolveAlone(hand, mystery) || holdsTooMuchAgainstCulprit(hand, mystery, playerCount),
    )
    if (!unfair) return hands
  }
  // Very unlikely, but a playable deal beats no game. Return the last one.
  return hands
}

// A player can solve alone if their own clues clear every innocent suspect.
export function canSolveAlone(hand: Clue[], mystery: Mystery): boolean {
  const innocents = mystery.suspects.map((s) => s.name).filter((n) => n !== mystery.culprit)
  return innocents.every((name) => hand.some((c) => c.suspect === name && c.kind === 'clears'))
}

// The culprit's incriminating clues should be spread out: with enough players,
// at most one each; with fewer players than clues, as evenly as possible.
export function holdsTooMuchAgainstCulprit(hand: Clue[], mystery: Mystery, playerCount: number): boolean {
  const againstCulprit = (c: Clue) => c.suspect === mystery.culprit && c.kind === 'incriminates'
  const total = mystery.clues.filter(againstCulprit).length
  const fairShare = Math.ceil(total / playerCount)
  return hand.filter(againstCulprit).length > fairShare
}

// Fisher-Yates shuffle on a copy, so the original list is untouched.
function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
