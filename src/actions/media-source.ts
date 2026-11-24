// Optional extras for a case: a cover illustration and a narrated briefing.
// Pure helpers only (request bodies and data-URI decoding), so they are easy
// to test and the real calls use exactly what the app sends.

export const COVER_ENDPOINT = 'gemini/generate-image'
export const COVER_MODEL = 'gemini-2.5-flash-image'
export const BRIEFING_ENDPOINT = 'speech/text-to-speech'
export const BRIEFING_MODEL = 'gpt-4o-mini-tts'
const BRIEFING_MAX_CHARS = 600

type CaseFacts = { title?: string; setting?: string; victim?: string }

export function coverRequest(game: CaseFacts) {
  return {
    model: COVER_MODEL,
    aspectRatio: '16:9',
    imageSize: '1K',
    // An explicit instruction: a descriptive prompt made Gemini reply with
    // chat text ("Here's a moody illustration...") and no image at all.
    prompt: [
      'Generate one image: a moody film-noir cover illustration for a cozy murder-mystery game.',
      `Scene: ${game.setting ?? 'a mysterious old building at night'}`,
      'Style: dramatic shadows, rain or mist, muted near-black tones with warm brass highlights, painterly.',
      'No text, letters or words anywhere in the image. No gore, no blood, no bodies, no real people.',
    ].join(' '),
  }
}

// What the narrator reads: title, setting and victim, all public case facts.
export function briefingText(game: CaseFacts): string {
  const text = `${game.title ?? 'A new case'}. ${game.setting ?? ''} The victim: ${game.victim ?? 'unknown'}`
  return text.replace(/\s+/g, ' ').trim().slice(0, BRIEFING_MAX_CHARS)
}

export function briefingRequest(game: CaseFacts) {
  return {
    model: BRIEFING_MODEL,
    voice: 'onyx',
    input: briefingText(game),
    response_format: 'mp3',
    instructions:
      'A world-weary 1940s film-noir detective narrating a case file: low, unhurried and dry, with a hint of intrigue. Not theatrical.',
  }
}

// "data:image/png;base64,AAAA" → a Blob with that type, or null if it isn't one.
export function dataUriToBlob(uri: unknown): Blob | null {
  if (typeof uri !== 'string') return null
  const match = /^data:([\w.+-]+\/[\w.+-]+);base64,(.+)$/s.exec(uri)
  if (!match) return null
  try {
    const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0))
    return bytes.length > 0 ? new Blob([bytes], { type: match[1] }) : null
  } catch {
    return null
  }
}
