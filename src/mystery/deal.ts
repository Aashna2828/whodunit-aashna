import type { Clue, Mystery } from './types'

const MAX_SHUFFLES = 50

// Splits the clues between players, round-robin, after shuffling.
// Returns one list of clues per player (hands[0] is player 0's clues).
// Reshuffles if any single player could solve it alone, so players must talk.
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

    if (!hands.some((hand) => canSolveAlone(hand, mystery))) return hands
  }
  // Very unlikely, but a playable deal beats no game. Return the last one.
  return hands
}

// A player can solve alone if their own clues clear every innocent suspect.
export function canSolveAlone(hand: Clue[], mystery: Mystery): boolean {
  const innocents = mystery.suspects.map((s) => s.name).filter((n) => n !== mystery.culprit)
  return innocents.every((name) => hand.some((c) => c.suspect === name && c.kind === 'clears'))
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
