/*
 * Ticket S25-D4's acceptance tests, the jump to a sheet by its number (G1 item M0-FL13, f-6; issue #330,
 * reproduced by #714's design gate).
 *
 * docs/design/m0-screens.md §2.2: "`Ctrl K` | global | Jump to: projects; inside a project, the Drawing
 * Set, Step 1, Members and access, and any sheet by number or title". §4.1, Routes:
 * "`/p/:code/takeoff/:step` (Step 1 is `takeoff/1`; `?sheet=S-04` opens a sheet)". The orchestrator's
 * brief: Ctrl K finds and opens a listed sheet by its number; `?sheet=<number>` opens that sheet in sheet
 * mode with focus on it. Today Ctrl K then "S-04" says "Nothing here by that name." and
 * `/p/KR-01/takeoff/1?sheet=S-04` opens the list with no sheet open.
 *
 * Run through S15-W2's sheet-mode seed (../ts15w2/keys.fixture.ts): six Structural sheets, S-01 to S-06;
 * S-04 is "GROUND FLOOR BEAM LAYOUT". Sheet mode is read as its canvas, 16's viewer group "Sheet S-04",
 * and the toolbar's sheet label (§6.5).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { PEOPLE, mountApp } from '@/app/testing'
import { canvasOf, clean, openList, seed, shownSheet } from '../ts15w2/keys.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const NOTHING = 'Nothing here by that name.'

async function jumpTyping(text: string): Promise<HTMLElement> {
  await userEvent.keyboard('{Control>}k{/Control}')
  const jump = await screen.findByRole('dialog')
  await userEvent.keyboard(text)
  return jump
}

/** The Jump to option that names sheet `number`. */
function optionFor(jump: HTMLElement, number: string): HTMLElement {
  const options = within(jump)
    .queryAllByRole('option')
    .filter((o) => clean(o.textContent).includes(number))
  expect(options, `one option naming ${number}`).toHaveLength(1)
  return options[0]!
}

/** Focus is on the open sheet: on its canvas or inside it. */
async function focusIsOn(number: string) {
  const canvas = await canvasOf(number)
  await waitFor(() => expect(canvas === document.activeElement || canvas.contains(document.activeElement), `focus on Sheet ${number}`).toBe(true))
}

describe('Ctrl K finds a listed sheet (§2.2)', () => {
  it('lists sheet S-04 when its number is typed, not "Nothing here by that name."', async () => {
    await openList(seed())
    const jump = await jumpTyping('S-04')
    await waitFor(() => optionFor(jump, 'S-04'))
    expect(clean(jump.textContent)).not.toContain(NOTHING)
  })

  it('lists sheet S-04 when its title is typed', async () => {
    await openList(seed())
    const jump = await jumpTyping('GROUND FLOOR BEAM')
    await waitFor(() => optionFor(jump, 'S-04'))
    expect(clean(jump.textContent)).not.toContain(NOTHING)
  })

  it('opens S-04 in sheet mode when Enter takes the number typed', async () => {
    await openList(seed())
    const jump = await jumpTyping('S-04')
    await waitFor(() => optionFor(jump, 'S-04'))
    await userEvent.keyboard('{Enter}')
    await canvasOf('S-04')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(shownSheet()).toBe('S-04')
  })

  it('puts focus on S-04 once Jump to has opened it', async () => {
    await openList(seed())
    const jump = await jumpTyping('S-04')
    await waitFor(() => optionFor(jump, 'S-04'))
    await userEvent.keyboard('{Enter}')
    await focusIsOn('S-04')
  })

  it('still says "Nothing here by that name." for a number no sheet has', async () => {
    await openList(seed())
    const jump = await jumpTyping('S-99')
    await waitFor(() => expect(clean(jump.textContent)).toContain(NOTHING))
  })
})

describe('?sheet=<number> opens that sheet (§4.1 Routes)', () => {
  it('opens /p/KR-01/takeoff/1?sheet=S-04 on S-04 in sheet mode', async () => {
    await mountApp('/p/KR-01/takeoff/1?sheet=S-04', { as: PEOPLE.qs, api: seed().api })
    await canvasOf('S-04')
    expect(shownSheet()).toBe('S-04')
  })

  it('puts focus on S-04 when opened at ?sheet=S-04', async () => {
    await mountApp('/p/KR-01/takeoff/1?sheet=S-04', { as: PEOPLE.qs, api: seed().api })
    await focusIsOn('S-04')
  })

  it('opens the list with no sheet open at ?sheet=S-99, a number no sheet has', async () => {
    await mountApp('/p/KR-01/takeoff/1?sheet=S-99', { as: PEOPLE.qs, api: seed().api })
    await waitFor(() => expect(clean(document.body.textContent)).toContain('Confirmed 0 / 6'))
    expect(screen.queryByRole('group', { name: /^Sheet\s/ })).toBeNull()
    expect(shownSheet()).toBeNull()
  })
})
