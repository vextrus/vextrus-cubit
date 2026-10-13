/*
 * S24-B1's "Who did what" at its edges (ts24b1 pins the promise): a history that cannot be read falls back to
 * the sheet's own decision; "other" words and an unnamed reason; a typed title names the person and where it
 * was read; a typed number whose correction was undone since names the correction that gave it; the arrow of a
 * number that had none reads "—".
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

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)

interface Act {
  id: string
  code: string
  actor: string
  actor_role: string
  at: string
  sheets?: number
  reason?: string
  text?: string
  changes?: Record<string, { old: string; new: string; old_source: string | null }>
}
const NUSRAT = { actor: 'Nusrat Jahan', actor_role: 'qs' }

/** KR-01's fake, each sheet's history answered from `acts` (by Proposal id), or refused when `broken`. */
function kr01(broken = false) {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  const acts = new Map<string, Act[]>()
  const handle = api.handle
  api.handle = async (request: Request) => {
    const path = new URL(request.url, location.origin).pathname
    const hit = /\/takeoff\/step1\/proposals\/([^/]+)\/history$/.exec(path)
    if (request.method === 'GET' && hit) {
      if (broken) return new Response(JSON.stringify({ code: 'platform.auth.not_found', params: {} }), { status: 404, headers: { 'Content-Type': 'application/json' } })
      return new Response(JSON.stringify({ acts: acts.get(decodeURIComponent(hit[1]!)) ?? [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return handle(request)
  }
  return { api, step1, acts }
}

const sheetOf = (step1: FakeStep1, number: string) => step1.proposals.find((p) => p.number === number)!

async function focus(api: FakeApi, number: string) {
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toMatch(/Confirmed \d+ \/ 24/))
  const rows = [...document.querySelectorAll<HTMLElement>('[role="row"]')].filter((r) => clean(r.textContent).includes(number))
  const row = rows.find((r) => !rows.some((o) => o !== r && r.contains(o)))!
  await userEvent.click(within(row).getByText(number))
}

const inspector = () => clean(screen.getByRole('complementary').textContent)
const whoDidWhat = () => {
  const heading = within(screen.getByRole('complementary')).getByText('Who did what')
  return clean((heading.closest('section') ?? heading.parentElement)?.textContent)
}

describe('Who did what, where the history cannot be read', () => {
  it('shows the decision the sheet itself carries', async () => {
    const { api, step1 } = kr01(true)
    Object.assign(sheetOf(step1, 'S-04'), { decision: 'confirmed', decided_by: 'Nusrat Jahan', decided_by_role: 'qs', decided_at: '2026-09-26T05:20:00Z', decided_with: 1 })
    await focus(api, 'S-04')
    await waitFor(() => expect(whoDidWhat()).toContain('Confirmed'))
    expect(whoDidWhat()).toContain('Nusrat Jahan, QS, 26 Sep 2026')
  })

  it('never says no one has acted on a decided sheet whose history lists nothing (an answer’s second act)', async () => {
    const { api, step1 } = kr01()
    Object.assign(sheetOf(step1, 'S-04'), { decision: 'excluded', excluded_reason: 'superseded', decided_by: 'Nusrat Jahan', decided_by_role: 'qs', decided_at: '2026-09-26T05:20:00Z', decided_with: 1 })
    await focus(api, 'S-04')
    await waitFor(() => expect(whoDidWhat()).toContain('Excluded: superseded'))
    expect(whoDidWhat()).not.toContain('no one has acted on it yet')
    expect(whoDidWhat()).toContain('Nusrat Jahan, QS, 26 Sep 2026')
  })

  it('says no one has acted on an undecided sheet', async () => {
    const { api } = kr01(true)
    await focus(api, 'S-06')
    await waitFor(() => expect(whoDidWhat()).toContain('no one has acted on it yet'))
  })
})

describe('Who did what words each act of the log', () => {
  it('gives an "other" exclusion the QS’s own words, and one with no reason named just "Excluded"', async () => {
    const { api, step1, acts } = kr01()
    const s04 = sheetOf(step1, 'S-04')
    Object.assign(s04, { decision: 'excluded', excluded_reason: 'other', excluded_text: 'a draft sheet', decided_by: 'Nusrat Jahan', decided_by_role: 'qs', decided_at: '2026-09-26T04:00:00Z' })
    acts.set(s04.id, [
      { id: 'a1', code: 'takeoff.step1.excluded', ...NUSRAT, at: '2026-09-26T04:00:00Z', sheets: 1, reason: 'other', text: 'a draft sheet' },
      { id: 'a2', code: 'takeoff.step1.excluded', ...NUSRAT, at: '2026-09-26T04:10:00Z', sheets: 1 },
    ])
    await focus(api, 'S-04')
    await waitFor(() => expect(whoDidWhat()).toContain('Excluded: a draft sheet'))
    expect(whoDidWhat().split('Excluded').length - 1).toBe(2)
  })

  it('reads a number given to a sheet that had none as "number — → S-12"', async () => {
    const { api, step1, acts } = kr01()
    const s05 = sheetOf(step1, 'S-05')
    Object.assign(s05, { number: 'S-12', number_source: 'typed', corrected: true })
    acts.set(s05.id, [{ id: 'a1', code: 'takeoff.step1.corrected', ...NUSRAT, at: '2026-09-27T04:00:00Z', sheets: 1, changes: { number: { old: '', new: 'S-12', old_source: null } } }])
    await focus(api, 'S-12')
    await waitFor(() => expect(whoDidWhat()).toContain('Corrected: number — → S-12'))
    expect(inspector()).toContain('corrected by Nusrat Jahan; none was read')
  })

  it('reads a number and a title changed together as one act', async () => {
    const { api, step1, acts } = kr01()
    const s05 = sheetOf(step1, 'S-05')
    Object.assign(s05, { number: 'S-51', number_source: 'typed', title: 'Beams', title_source: 'typed', corrected: true })
    acts.set(s05.id, [
      { id: 'a1', code: 'takeoff.step1.corrected', ...NUSRAT, at: '2026-09-27T04:00:00Z', sheets: 1, changes: { number: { old: 'S-05', new: 'S-51', old_source: 'title_block_attribute' }, title: { old: 'Old', new: 'Beams', old_source: 'title_block_attribute' } } },
    ])
    await focus(api, 'S-51')
    await waitFor(() => expect(whoDidWhat()).toContain('Corrected: number S-05 → S-51; title'))
  })
})

describe('a typed value names the person', () => {
  it('names the person and the old title for a corrected title', async () => {
    const { api, step1, acts } = kr01()
    const s04 = sheetOf(step1, 'S-04')
    Object.assign(s04, { title: 'Ground floor beams', title_source: 'typed', corrected: true })
    acts.set(s04.id, [{ id: 'a1', code: 'takeoff.step1.corrected', ...NUSRAT, at: '2026-09-27T04:00:00Z', sheets: 1, changes: { title: { old: 'GROUND FLOOR BEAM LAYOUT', new: 'Ground floor beams', old_source: 'title_block_text' } } }])
    await focus(api, 'S-04')
    await waitFor(() => expect(inspector()).toContain('corrected by Nusrat Jahan; read “GROUND FLOOR BEAM LAYOUT” from the text in the title block'))
  })

  it('names the correction that gave the number it holds now, not an undone one after it', async () => {
    const { api, step1, acts } = kr01()
    const s05 = sheetOf(step1, 'S-05')
    Object.assign(s05, { number: 'S-51', number_source: 'typed', corrected: true })
    acts.set(s05.id, [
      { id: 'a1', code: 'takeoff.step1.corrected', ...NUSRAT, at: '2026-09-27T04:00:00Z', sheets: 1, changes: { number: { old: 'S-05', new: 'S-51', old_source: 'title_block_attribute' } } },
      { id: 'a2', code: 'takeoff.step1.corrected', actor: 'Arif Rahman', actor_role: 'vextrus_engineer', at: '2026-09-27T05:00:00Z', sheets: 1, changes: { number: { old: 'S-51', new: 'S-52', old_source: 'typed' } } },
      { id: 'a2', code: 'takeoff.step1.undone', actor: 'Arif Rahman', actor_role: 'vextrus_engineer', at: '2026-09-27T05:05:00Z', sheets: 1 },
    ])
    await focus(api, 'S-51')
    await waitFor(() => expect(inspector()).toContain('corrected by Nusrat Jahan; read S-05 from the title-block attribute'))
    expect(inspector()).not.toContain('corrected by Arif Rahman')
  })

  it('credits the newest correction not undone, never an undone one that gave the same value', async () => {
    const { api, step1, acts } = kr01()
    const s05 = sheetOf(step1, 'S-05')
    Object.assign(s05, { number: 'S-51', number_source: 'typed', corrected: true })
    acts.set(s05.id, [
      { id: 'a1', code: 'takeoff.step1.corrected', ...NUSRAT, at: '2026-09-27T04:00:00Z', sheets: 1, changes: { number: { old: 'S-05', new: 'S-51', old_source: 'title_block_attribute' } } },
      { id: 'a2', code: 'takeoff.step1.corrected', actor: 'Arif Rahman', actor_role: 'vextrus_engineer', at: '2026-09-27T05:00:00Z', sheets: 1, changes: { number: { old: 'S-51', new: 'S-51', old_source: 'typed' } } },
      { id: 'a2', code: 'takeoff.step1.undone', actor: 'Arif Rahman', actor_role: 'vextrus_engineer', at: '2026-09-27T05:05:00Z', sheets: 1 },
    ])
    await focus(api, 'S-51')
    await waitFor(() => expect(inspector()).toContain('corrected by Nusrat Jahan; read S-05 from the title-block attribute'))
    expect(inspector()).not.toContain('corrected by Arif Rahman')
  })

  it('falls back to “typed by a person” where the history names no such correction', async () => {
    const { api, step1 } = kr01()
    Object.assign(sheetOf(step1, 'S-05'), { number: 'S-51', number_source: 'typed', corrected: true })
    await focus(api, 'S-51')
    await waitFor(() => expect(inspector()).toContain('typed by a person'))
  })
})
