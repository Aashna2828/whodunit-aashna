import { expect, test } from 'vitest'
import { FALLBACK_MYSTERY } from '../mystery/fallback'
import { briefingRequest, briefingText, coverRequest, dataUriToBlob } from './media-source'

test('a data URI becomes a Blob with its type; anything else is null', async () => {
  const blob = dataUriToBlob(`data:image/png;base64,${btoa('PNGDATA')}`)
  expect(blob?.type).toBe('image/png')
  expect(await blob?.text()).toBe('PNGDATA')
  expect(dataUriToBlob(`data:audio/mp3;base64,${btoa('ID3')}`)?.type).toBe('audio/mp3')

  expect(dataUriToBlob(undefined)).toBeNull()
  expect(dataUriToBlob('https://example.com/a.png')).toBeNull()
  expect(dataUriToBlob('data:image/png;base64,')).toBeNull()
  expect(dataUriToBlob('data:image/png;base64,***not base64***')).toBeNull()
})

test('the briefing reads the title, setting and victim, capped at 600 characters', () => {
  const text = briefingText(FALLBACK_MYSTERY)
  expect(text).toContain(FALLBACK_MYSTERY.title)
  expect(text).toContain(FALLBACK_MYSTERY.setting)
  expect(text).toContain(`The victim: ${FALLBACK_MYSTERY.victim}`)
  expect(briefingText({ title: 'x', setting: 'y'.repeat(2000), victim: 'z' }).length).toBe(600)
  expect(briefingRequest(FALLBACK_MYSTERY)).toMatchObject({ model: 'gpt-4o-mini-tts', voice: 'onyx', input: text })
})

test('the cover prompt is an explicit instruction from the setting, with no text or gore', () => {
  const { prompt, model, aspectRatio } = coverRequest(FALLBACK_MYSTERY)
  expect(model).toBe('gemini-2.5-flash-image')
  expect(aspectRatio).toBe('16:9')
  expect(prompt.startsWith('Generate one image:')).toBe(true)
  expect(prompt).toContain(FALLBACK_MYSTERY.setting)
  expect(prompt).toContain('No text, letters or words')
  expect(prompt).toContain('No gore')
})
