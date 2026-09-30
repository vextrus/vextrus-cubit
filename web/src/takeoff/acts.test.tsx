/*
 * Step 1's acts when they go wrong (the review of 22, round 1): a bulk act whose exclusion is refused
 * after its Confirmation was made says both halves, offers Undo, and Ctrl Z names only what was done;
 * a second Enter while the act is in flight sends nothing more.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '@/acceptance/t22/step1.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (t: string | null | undefined) => (t ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => (document.body.textContent ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ')

async function open() {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
  return step1
}

describe('the bulk act, half refused', () => {
  it('says the 16 were confirmed and why the rest was not, offers Undo, and undoes only what was done', async () => {
    const step1 = await open()
    step1.answerOnce('POST /exclude', 409, { code: 'takeoff.step1.nothing_to_undo', params: {} })
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).toContain('Confirmed 16 sheets.'))
    expect(bodyText()).toContain('The rest was not done: You have nothing left to undo on Step 1')
    expect(screen.getByRole('button', { name: /Undo/ })).toBeInTheDocument()
    await userEvent.keyboard('{Control>}z{/Control}')
    await waitFor(() => expect(bodyText()).toContain('Undone: confirmed 16 sheets'))
    expect(bodyText()).not.toContain('left out 1')
    expect(step1.calls().filter((c) => c === 'POST /undo')).toHaveLength(1)
  })
})

const refusal = { code: 'takeoff.step1.nothing_to_undo', params: {} }
const posts = (step1: FakeStep1) => step1.calls().filter((c) => c.startsWith('POST'))
const count = (step1: FakeStep1, call: string) => step1.calls().filter((c) => c === call).length

/** Step 1 takes acts again: its act, its undos and the reloads after them have ended (the screen's aria-busy). */
const busy = () => document.querySelector('[data-step1]')?.getAttribute('aria-busy') === 'true'
/** Waits for the `n`th `call`, if named (so the act has begun), then for Step 1 to take acts again. */
async function accepting(step1?: FakeStep1, call?: string, n = 1) {
  if (step1 && call) await waitFor(() => expect(count(step1, call)).toBeGreaterThanOrEqual(n), { timeout: 5000 })
  await waitFor(() => expect(busy()).toBe(false), { timeout: 5000 })
}

/**
 * The app on the fake, where `hold('POST /exclude')` keeps the next such call waiting until released
 * (round 4's F1: tests force the order they test, never count on timing). Step 1's reload is
 * `GET /proposals`.
 */
async function openHeld() {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  const held = new Map<string, Promise<void>>()
  const base = api.handle
  api.handle = async (request: Request) => {
    const key = `${request.method} /${new URL(request.url, location.origin).pathname.split('/').at(-1)}`
    const wait = held.get(key)
    if (wait) {
      held.delete(key)
      await wait
    }
    return base(request)
  }
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
  const hold = (key: string) => {
    let release = () => {}
    held.set(key, new Promise<void>((r) => (release = r)))
    return () => release()
  }
  return { step1, hold }
}

/** Act A: the bulk act with its exclusion refused, so it confirms 16 and leaves the proposed one for B. */
async function actA(step1: FakeStep1) {
  step1.answerOnce('POST /exclude', 409, refusal)
  await userEvent.keyboard('{Enter}')
  await accepting(step1, 'POST /exclude', 1)
  await waitFor(() => expect(bodyText()).toContain('Confirmed 16 / 24'))
}

const ctrlZ = () => userEvent.keyboard('{Control>}z{/Control}')

describe('an act in flight', () => {
  it('sends the bulk act once for two Enters', async () => {
    const { step1, hold } = await openHeld()
    const release = hold('POST /exclude')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(busy()).toBe(true))
    await userEvent.keyboard('{Enter}')
    release()
    await accepting(step1, 'POST /exclude')
    expect(posts(step1)).toEqual(['POST /confirm', 'POST /exclude'])
  })

  it('sends the bulk act once when the second Enter comes while Step 1 reloads', async () => {
    const { step1, hold } = await openHeld()
    const release = hold('GET /proposals')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(count(step1, 'POST /exclude')).toBe(1))
    await waitFor(() => expect(bodyText()).toContain('Confirmed 16 sheets; left out 1'))
    expect(busy()).toBe(true)
    await userEvent.keyboard('{Enter}')
    release()
    await accepting()
    expect(posts(step1)).toEqual(['POST /confirm', 'POST /exclude'])
  })

  it("sends a sheet's act once when the second Enter comes while Step 1 reloads", async () => {
    const { step1, hold } = await openHeld()
    screen.getByRole('grid', { name: 'Sheets' }).focus()
    const active = () => document.activeElement as HTMLElement | null
    const number = () => (active()?.getAttribute('role') === 'row' ? (active()!.querySelectorAll('[role="gridcell"]')[1]?.textContent ?? '').replace(/[⁦-⁩‎‏\s]/g, '') : '')
    for (let i = 0; i < 30 && number() !== 'S-02'; i++) await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard(' ')
    await screen.findByRole('group', { name: /S-02/ })
    const release = hold('GET /proposals')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(posts(step1)).toHaveLength(1))
    expect(busy()).toBe(true)
    await userEvent.keyboard('{Enter}')
    release()
    await accepting()
    expect(posts(step1)).toHaveLength(1)
  })

  it('sends no drawing list while the bulk act is still reloading', async () => {
    const { step1, hold } = await openHeld()
    const heading = await screen.findByText('Architectural 8 found', { exact: false })
    const section = heading.closest('section, [role="rowgroup"], [role="group"], div')!.parentElement!
    const release = hold('GET /proposals')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(step1.calls()).toContain('POST /exclude'))
    await userEvent.click(within(section).getAllByText('Paste the drawing list')[0]!)
    const again = await screen.findByRole('dialog', { name: 'The architectural drawing list' })
    await userEvent.type(within(again).getByRole('textbox'), 'A-01–A-08')
    await waitFor(() => expect(clean(again.textContent)).toContain('Read as a range'))
    expect(busy()).toBe(true)
    await userEvent.click(within(again).getByRole('button', { name: 'Use as the drawing list' }))
    release()
    await accepting()
    expect(step1.calls()).not.toContain('POST /drawing-list')
  })
})

describe('an Undo while the act is still going (the review of 22, rounds 2 and 3)', () => {
  it('waits for the bulk act and undoes it, when Ctrl Z comes while its calls are in flight', async () => {
    const { step1, hold } = await openHeld()
    const release = hold('POST /exclude')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(busy()).toBe(true))
    await ctrlZ()
    expect(step1.calls()).not.toContain('POST /undo')
    release()
    await waitFor(() => expect(bodyText()).toContain('Undone: confirmed 16 sheets and left out 1'), { timeout: 5000 })
    await accepting()
    expect(posts(step1)).toEqual(['POST /confirm', 'POST /exclude', 'POST /undo', 'POST /undo'])
  })

  it('undoes the act when its toast’s Undo is pressed during the reload', async () => {
    const { step1, hold } = await openHeld()
    const release = hold('GET /proposals')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).toContain('Confirmed 16 sheets; left out 1'))
    expect(busy()).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: /Undo/ }))
    release()
    await waitFor(() => expect(bodyText()).toContain('Undone: confirmed 16 sheets and left out 1'), { timeout: 5000 })
    await accepting()
    expect(count(step1, 'POST /undo')).toBe(2)
  })

  it('undoes nothing when the act it waited for was refused outright', async () => {
    const { step1, hold } = await openHeld()
    await actA(step1)
    step1.answerOnce('POST /exclude', 409, refusal)
    const release = hold('POST /exclude')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(busy()).toBe(true))
    await ctrlZ()
    release()
    await accepting(step1, 'POST /exclude', 2)
    // Its refusal stays on screen (it says why); the Ctrl Z adds nothing over it (the words gate, round 4).
    await waitFor(() => expect(bodyText()).toContain('You have nothing left to undo on Step 1'))
    expect(bodyText()).not.toContain('Nothing undone')
    expect(step1.calls()).not.toContain('POST /undo')
    expect(bodyText()).toContain('Confirmed 16 / 24')
  })
})

describe('Ctrl Z after an act that was not made (the review of 22, round 4, F3)', () => {
  it('undoes nothing, and says so, when the Enter before it was dropped while an act was in flight', async () => {
    const { step1, hold } = await openHeld()
    const release = hold('POST /exclude')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(busy()).toBe(true))
    await userEvent.keyboard('{Enter}')
    release()
    await accepting(step1, 'POST /exclude')
    expect(posts(step1)).toEqual(['POST /confirm', 'POST /exclude'])
    await ctrlZ()
    await waitFor(() => expect(bodyText()).toContain('Nothing undone: your last change was not made. Press Ctrl Z again to undo the one before it.'))
    await accepting()
    expect(step1.calls()).not.toContain('POST /undo')
    await ctrlZ()
    await waitFor(() => expect(bodyText()).toContain('Undone: confirmed 16 sheets and left out 1'))
    expect(count(step1, 'POST /undo')).toBe(2)
  })

  it('undoes nothing, and says so, when the act before it was refused outright', async () => {
    const { step1 } = await openHeld()
    await actA(step1)
    step1.answerOnce('POST /exclude', 409, refusal)
    await userEvent.keyboard('{Enter}')
    await accepting(step1, 'POST /exclude', 2)
    await ctrlZ()
    await waitFor(() => expect(bodyText()).toContain('Nothing undone: your last change was not made.'))
    await accepting()
    expect(step1.calls()).not.toContain('POST /undo')
    await ctrlZ()
    await waitFor(() => expect(bodyText()).toContain('Undone: confirmed 16 sheets'))
    expect(count(step1, 'POST /undo')).toBe(1)
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
  })
})

describe('Ctrl Z takes the act the QS meant (the refuter of round 4)', () => {
  it('S1: Ctrl Z during an act, then an Enter dropped while it waits: the act is still undone', async () => {
    const { step1, hold } = await openHeld()
    const release = hold('POST /exclude')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(busy()).toBe(true))
    await ctrlZ()
    await userEvent.keyboard('{Enter}')
    release()
    await waitFor(() => expect(bodyText()).toContain('Undone: confirmed 16 sheets and left out 1'), { timeout: 5000 })
    await accepting()
    expect(count(step1, 'POST /undo')).toBe(2)
    expect(count(step1, 'POST /confirm')).toBe(1)
  })

  it('S2: an act refused outright while Ctrl Z waits, an Enter dropped meanwhile: the next Ctrl Z does not undo the act before', async () => {
    const { step1, hold } = await openHeld()
    await actA(step1)
    step1.answerOnce('POST /exclude', 409, refusal)
    const release = hold('POST /exclude')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(busy()).toBe(true))
    await ctrlZ()
    await userEvent.keyboard('{Enter}')
    release()
    await accepting(step1, 'POST /exclude', 2)
    await ctrlZ()
    await waitFor(() => expect(bodyText()).toContain('Nothing undone'))
    await accepting()
    expect(step1.calls()).not.toContain('POST /undo')
    expect(bodyText()).toContain('Confirmed 16 / 24')
  })

  it('S3: an undo refused keeps its act for the next Ctrl Z, named rightly', async () => {
    const { step1 } = await openHeld()
    await actA(step1)
    await userEvent.keyboard('{Enter}')
    await accepting(step1, 'POST /exclude', 2)
    step1.answerOnce('POST /undo', 409, refusal)
    await ctrlZ()
    await accepting(step1, 'POST /undo', 1)
    await ctrlZ()
    await waitFor(() => expect(bodyText()).toContain('Undone: left out 1 sheet'), { timeout: 5000 })
    await accepting()
    expect(bodyText()).toContain('Confirmed 16 / 24')
  })

  it('S4: a second Ctrl Z during an undo is not dropped: it undoes the act before', async () => {
    const { step1, hold } = await openHeld()
    await actA(step1)
    await userEvent.keyboard('{Enter}')
    await accepting(step1, 'POST /exclude', 2)
    const release = hold('POST /undo')
    await ctrlZ()
    await waitFor(() => expect(busy()).toBe(true))
    await ctrlZ()
    release()
    await accepting(step1, 'POST /undo', 2)
    await waitFor(() => expect(bodyText()).toContain('Undone: confirmed 16 sheets'))
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
  })

  it("S5: a later act clears the last act's toast, so its Undo cannot take back the later one", async () => {
    const { step1, hold } = await openHeld()
    await actA(step1)
    expect(screen.getByRole('button', { name: /Undo/ })).toBeInTheDocument()
    const release = hold('POST /exclude')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(busy()).toBe(true))
    expect(screen.queryByRole('button', { name: /Undo/ })).toBeNull()
    release()
    await accepting(step1, 'POST /exclude', 2)
    expect(step1.calls()).not.toContain('POST /undo')
  })
})
