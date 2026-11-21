import { FALLBACK_MYSTERY } from '../mystery/fallback'
import { validateMystery } from '../mystery/validate'
import type { ValidationResult } from '../mystery/types'

// The one place a mystery comes from. Today it is the hand-written fallback;
// later this will ask the AI and fall back on failure. It is async already,
// because an AI call will be, so callers won't need to change.
export async function getMystery(playerCount: number): Promise<ValidationResult> {
  return validateMystery(JSON.stringify(FALLBACK_MYSTERY), playerCount)
}
