/*
 * The decode when no Worker can start (S27-G2 fix round 1, the review's 50): a Worker that cannot be
 * made, or whose script fails before it starts (a stale page after a new release), hands the sheet to
 * the main thread rather than leaving every sheet "could not be drawn"; a refusal is still a refusal.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import tinySheetUrl from '../../../engine/render/fixtures/tiny-sheet.bin?url'

const tiny = async () => (await fetch(tinySheetUrl)).arrayBuffer()

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('openDecodedSheet without a Worker', () => {
  it('opens a sheet on the main thread when a Worker cannot be made', async () => {
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          throw new Error('no Worker here')
        }
      },
    )
    const { openDecodedSheet } = await import('./decoded')
    const sheet = await openDecodedSheet(await tiny())
    expect(sheet.lines.count).toBeGreaterThan(0)
    await expect(openDecodedSheet(new Uint8Array(4096).fill(0x5a).buffer)).rejects.toThrow()
  })

  it('opens a sheet on the main thread when the Worker script fails before it starts', async () => {
    class FailsToLoad {
      onerror: ((event: { preventDefault(): void }) => void) | null = null
      onmessage: unknown = null
      onmessageerror: unknown = null
      postMessage() {
        setTimeout(() => this.onerror?.({ preventDefault() {} }), 0)
      }
      terminate() {}
    }
    vi.stubGlobal('Worker', FailsToLoad)
    const { openDecodedSheet } = await import('./decoded')
    const sheet = await openDecodedSheet(await tiny())
    expect(sheet.lines.count).toBeGreaterThan(0)
    // And every later open, without asking a Worker again.
    expect((await openDecodedSheet(await tiny())).lines.count).toBeGreaterThan(0)
  })
})
