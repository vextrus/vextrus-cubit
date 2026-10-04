/*
 * Ticket f1, section 3 F2: `untilBox` waits for the box wanted, never for a frame held mid-drag.
 * The live flake (#245) is not deterministic (1 in 40 locally under load); these pin the helper the
 * pan tests now use. Against the old wait (non-null, then two equal reads) each of them fails.
 */
import { describe, expect, it } from 'vitest'
import { untilBox, type Box } from './settle'

const BEFORE: Box = { x0: 100, y0: 80, x1: 700, y1: 500 }
const HALF: Box = { x0: 130, y0: 100, x1: 730, y1: 520 }
const WANT: Box = { x0: 160, y0: 120, x1: 760, y1: 540 }

describe('untilBox', () => {
  it('waits through a frame held half-way for 30 polls and resolves only with the wanted box', async () => {
    let reads = 0
    const read = () => (++reads <= 30 ? HALF : WANT)
    const got = await untilBox(read, WANT, { timeout: 10_000, px: 2 })
    expect(got).toEqual(WANT)
    expect(reads).toBe(31)
  })

  it('resolves at once with a box within px of the wanted one', async () => {
    let reads = 0
    const close: Box = { x0: 161.5, y0: 118.5, x1: 758, y1: 541 }
    const got = await untilBox(() => (reads++, close), WANT, { timeout: 10_000, px: 2 })
    expect(got).toEqual(close)
    expect(reads).toBe(1)
  })

  it('rejects after the timeout, naming the last box read', async () => {
    let reads = 0
    const last: Box = { x0: 517, y0: 211, x1: 883, y1: 619 }
    const read = () => (++reads < 3 ? BEFORE : last)
    await expect(untilBox(read, WANT, { timeout: 200, px: 2 })).rejects.toThrow(/517.*211.*883.*619/)
  })
})
