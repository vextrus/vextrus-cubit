/*
 * Ticket f1 (issue #245's t16 flake): wait for the box a test expects, never for "two reads agree".
 *
 * The pan tests read the sheet's ink box from the canvas. The old wait (`changed()` then `opened()`)
 * took two equal reads as settled, and a frame held half-way through the drag reads the same twice,
 * so CI read a half-drawn pan as the result (viewer.test.tsx:208, failing at 459-717 ms, far under
 * its 10 s poll). `untilBox` polls until the box is within `px` of the one wanted, and on timeout
 * names the last box it read.
 */

export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

const SIDES = ['x0', 'y0', 'x1', 'y1'] as const
const POLL_MS = 20

function near(a: Box, b: Box, px: number): boolean {
  return SIDES.every((side) => Math.abs(a[side] - b[side]) <= px)
}

/** Resolves with the first box read within `px` of `want`; rejects after `timeout` ms naming the last read. */
export async function untilBox<B extends Box>(
  read: () => B | null,
  want: Box,
  { timeout, px }: { timeout: number; px: number },
): Promise<B> {
  const start = performance.now()
  for (;;) {
    const last = read()
    if (last !== null && near(last, want, px)) return last
    if (performance.now() - start >= timeout) {
      throw new Error(`untilBox: wanted ${JSON.stringify(want)} within ${px} px; last read ${JSON.stringify(last)}`)
    }
    await new Promise<void>((resolve) => setTimeout(resolve, POLL_MS))
  }
}
