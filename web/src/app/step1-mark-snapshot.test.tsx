/*
 * S27-G4 fix round 1 (findings 1 and 2 of review r1): the toolbar's ✓, the rail's mark, the Count and the status
 * bar's Coverage line are one snapshot (S26-D7): while some of Step 1's reloads are held, none of them moves, and
 * when the held reload ends they move in one render. The class: the mark never says Confirmed beside a Coverage
 * line that says "unaccounted", nor beside a Count that is not all settled; and arriving on a confirmed Step 1
 * never shows "Proposals ready" first.
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
const railMarks = () => [...document.querySelectorAll('nav[aria-label="Takeoff Steps"] li:first-child [role="img"]')].map((e) => e.getAttribute('aria-label'))
const toolbarTick = () => (toolbar()?.querySelectorAll('svg.text-confirmed').length ?? 0) > 0
const coverageLine = () => /Coverage \d+ views.*?(\d+) unaccounted/.exec(clean(document.body.textContent))?.[1] ?? null
const countLine = () => /Confirmed (\d+) \/ (\d+)/.exec(clean(toolbar()?.textContent))

/** The kinds of disagreement ever seen between the four, sampled at every change of the page. */
function watch(): { seen: Set<string>; stop: () => void } {
  const seen = new Set<string>()
  const sample = () => {
    const unaccounted = coverageLine()
    const count = countLine()
    const tick = toolbarTick()
    const rail = railMarks()
    if (tick && unaccounted !== null && unaccounted !== '0') seen.add('tick beside unaccounted')
    if (rail.includes('Confirmed') && unaccounted !== null && unaccounted !== '0') seen.add('rail Confirmed beside unaccounted')
    if (tick !== rail.includes('Confirmed') && count !== null) seen.add('tick and rail disagree')
    if (tick && count && count[1] !== '22') seen.add('tick beside an unsettled Count')
  }
  const mo = new MutationObserver(sample)
  mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true })
  return { seen, stop: () => mo.disconnect() }
}

/** Every request for `hold` waits until `release()`. */
function holding(api: FakeApi, hold: string) {
  let release = () => {}
  const gate = new Promise<void>((r) => (release = r))
  let held = false
  const inner = api.handle
  api.handle = async (request: Request) => {
    if (held && request.method === 'GET' && new URL(request.url).pathname.endsWith(`/step1/${hold}`)) await gate
    return inner(request)
  }
  return { start: () => (held = true), release }
}

async function settled(api: FakeApi, unaccounted: number) {
  const step1 = new FakeStep1(api)
  step1.settleAllBut('no discipline')
  step1.coverage = { ...step1.coverage, unaccounted }
  return step1
}

describe('the ✓, the rail’s mark, the Count and Coverage’s line change in one render (S27-G4 fix round 1)', () => {
  it('keeps the ✓ while the proposals reload is held behind Coverage’s, then drops it with the Coverage line', async () => {
    const api = new FakeApi()
    const step1 = await settled(api, 0)
    const gate = holding(api, 'proposals')
    const { queryClient } = await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(toolbarTick()).toBe(true))
    await waitFor(() => expect(coverageLine()).toBe('0'))
    const w = watch()
    gate.start()
    step1.coverage = { ...step1.coverage, unaccounted: 1 }
    void queryClient.invalidateQueries({ queryKey: ['step1'] })
    await new Promise((r) => setTimeout(r, 300))
    // Coverage has answered; the proposals have not: nothing the frame shows has moved.
    expect(coverageLine()).toBe('0')
    expect(toolbarTick()).toBe(true)
    expect(railMarks()).toContain('Confirmed')
    gate.release()
    await waitFor(() => expect(coverageLine()).toBe('1'))
    await waitFor(() => expect(toolbarTick()).toBe(false))
    w.stop()
    expect([...w.seen]).toEqual([])
    expect(railMarks()).not.toContain('Confirmed')
  })

  it('does not draw the ✓ before the Count’s reload ends, with Coverage already answered (the reverse)', async () => {
    const api = new FakeApi()
    const step1 = await settled(api, 1)
    const gate = holding(api, 'proposals')
    const { queryClient } = await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(coverageLine()).toBe('1'))
    const w = watch()
    gate.start()
    step1.coverage = { ...step1.coverage, unaccounted: 0 }
    void queryClient.invalidateQueries({ queryKey: ['step1'] })
    await new Promise((r) => setTimeout(r, 300))
    expect(coverageLine()).toBe('1')
    expect(toolbarTick()).toBe(false)
    gate.release()
    await waitFor(() => expect(toolbarTick()).toBe(true))
    expect(coverageLine()).toBe('0')
    w.stop()
    expect([...w.seen]).toEqual([])
  })

  it('shows no "Proposals ready" on arrival at /takeoff/2 on a confirmed Step 1', async () => {
    const api = new FakeApi()
    await settled(api, 0)
    const marks: (string | null)[] = []
    const mo = new MutationObserver(() => marks.push(...railMarks()))
    mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true })
    await mountApp('/p/KR-01/takeoff/2', { as: PEOPLE.qs, api })
    await waitFor(() => expect(railMarks()).toEqual(['Confirmed']))
    mo.disconnect()
    expect(marks).not.toContain('Proposals ready')
  })
})
