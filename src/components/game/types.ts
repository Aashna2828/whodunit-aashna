import type { Clue, Game, Player, Rec } from '@/lib/game-types'

// Everything a phase view needs, gathered once by the game page.
export type GameView = {
  gameId: string
  game: Game
  players: Rec<Player>[] // in join order
  myClues: Rec<Clue>[]
  userId: string
  isHost: boolean
  isPlayer: boolean
  dealtIn: boolean // was here for the deal (holds clues)
}
