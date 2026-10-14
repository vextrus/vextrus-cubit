/*
 * S27-G4, f-11 of session 26's G1 walk (#833): once Step 1 is confirmed, the toolbar's Count carries the
 * confirmed mark. docs/design/m0-screens.md 6.11: "**Step 1 is confirmed** when every Discipline received is:
 * the Count then reads "✓ Confirmed 62 / 68, 6 excluded" and the rail marks Step 1 confirmed." The decisions
 * table (4): "when every Discipline is confirmed, "✓ Confirmed 62 / 68, 6 excluded" (4.7, 6.11)". Before
 * then the Count reads "Confirmed n / N, k excluded" with no mark.
 *
 * The mark is the one the rail draws for a confirmed Step 1 (the glyph named "Confirmed"), or a "✓", put
 * before the word "Confirmed" in the toolbar. Pinned by what the screen shows, never by how Step 1's
 * counts reach the frame. Run at /p/KR-01/takeoff/1 on t22's in-memory API (../t22/step1.fixture.ts).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { waitFor } from '@testing-library/react'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '@/acceptance/t22/step1.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏⁠]/g, '').replace(/\s+/g, ' ').trim()
const toolbar = () => document.querySelector<HTMLElement>('[role="toolbar"][aria-label="The step\'s tools"]')
const COUNT = /Confirmed \d+ \/ \d+(?:, \d+ excluded)?/

/**
 * The toolbar's Count as the eye reads it: "✓" stands for a drawn mark (an svg not named, or named
 * "Confirmed" as the rail names its mark) or a "✓" written just before it.
 */
function countAsRead(): string {
  const bar = toolbar()
  expect(bar, 'the step’s toolbar').not.toBeNull()
  let read = ''
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) read += node.textContent ?? ''
    else if (node instanceof SVGSVGElement) read += [null, 'Confirmed'].includes(node.getAttribute('aria-label')) ? ' ✓ ' : ' (another mark) '
    else node.childNodes.forEach(walk)
  }
  walk(bar!)
  const said = clean(read)
  const found = COUNT.exec(said)
  expect(found, `a Count in the toolbar: "${said}"`).not.toBeNull()
  return (said.slice(0, found!.index).trimEnd().endsWith('✓') ? '✓ ' : '') + found![0]
}

/** KR-01 with every Discipline settled but `open` (all settled: every sheet confirmed or excluded, every Question answered, Coverage none unaccounted). */
async function kr01(open: string) {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  step1.settleAllBut(open)
  const excluded = step1.proposals.filter((p) => p.decision === 'excluded').length
  const confirmed = step1.proposals.filter((p) => p.decision === 'confirmed').length
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(clean(toolbar()?.textContent)).toMatch(COUNT))
  return { confirmed, excluded, found: step1.proposals.length }
}

describe('the toolbar’s Count once Step 1 is confirmed (m0-screens 6.11; f-11, #833)', () => {
  it('reads "✓ Confirmed 22 / 24, 2 excluded" once every sheet is confirmed or excluded', async () => {
    const { confirmed, excluded, found } = await kr01('no discipline')
    expect([confirmed, excluded, found]).toEqual([22, 2, 24])
    await waitFor(() => expect(countAsRead(), 'the toolbar Count carries the confirmed mark').toBe('✓ Confirmed 22 / 24, 2 excluded'))
  })

  it('reads "Confirmed 19 / 24, 2 excluded" with no mark while Electrical’s sheets are still to confirm', async () => {
    await kr01('electrical')
    await waitFor(() => expect(countAsRead(), 'the toolbar Count with no mark').toBe('Confirmed 19 / 24, 2 excluded'))
  })
})
