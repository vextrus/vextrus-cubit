/*
 * Ticket 230's design gate, walk 1 (its musts and the 6.13 may), each pinned here:
 * 1. With no sheets yet and a file waiting, the inspector never says "Nothing is waiting.": "No sheets
 *    yet: they arrive as <file> is read."
 * 2. The no-sheets-yet canvas keeps the files band (a chip opens the file's report) and the way to the
 *    Drawing Set.
 * 3. Coverage's "Views by the step": one row per Takeoff Step, in the steps' order, Parts last; a
 *    Structural Part's views join Step 2's row ("2 Notes" once, the two counts summed).
 * 4. The Coverage panel says "<file> is still reading; its views join as its sheets arrive." for a file
 *    reading (never for one waiting), and shows no empty "Views by the step" heading.
 * May (6.13): while a file reads, the bulk act's why says its sheets are not in it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeDrawingSet, file, msg } from '@/acceptance/t20b/drawings.fixture'
import { FakeStep1 } from '@/acceptance/t22/step1.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-04T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)
const PATH = '/p/KR-01/takeoff/1'

function kr01(files: (step1: FakeStep1) => ReturnType<typeof file>[], empty = false) {
  const api = new FakeApi()
  const set = new FakeDrawingSet(api, 'KR-01')
  const step1 = new FakeStep1(api, 'KR-01', empty)
  if (!empty) step1.questions = step1.questions.filter((q) => q.kind !== 'file_misread')
  set.files = files(step1)
  return { api, set, step1 }
}

async function openCoverage(): Promise<HTMLElement> {
  const button = await waitFor(() => {
    const b = screen.getAllByRole('button').find((el) => clean(el.textContent).startsWith('Coverage '))
    expect(b, 'the status bar’s Coverage').toBeDefined()
    return b!
  })
  await userEvent.click(button)
  const heading = await screen.findByText('Coverage, every view on every sheet read')
  return heading.closest('aside, [role="complementary"], section')?.parentElement ?? document.body
}

describe('no sheets yet, a file waiting (musts 1 and 2)', () => {
  const waiting = () => kr01(() => [file({ name: 'SG-STR-R0.dwg', state: 'waiting', status: msg('drawings.files.waiting', { ahead: 0 }) })], true)

  it('says the sheets arrive as the file is read, never "Nothing is waiting."', async () => {
    const { api } = waiting()
    await mountApp(PATH, { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('SG-STR-R0.dwg is waiting to be read.'))
    expect(bodyText()).toContain('No sheets yet: they arrive as SG-STR-R0.dwg is read.')
    expect(bodyText()).not.toContain('Nothing is waiting.')
  })

  it('keeps the files band, whose chip opens the file’s report, and the way to the Drawing Set', async () => {
    const { api } = waiting()
    await mountApp(PATH, { as: PEOPLE.qs, api })
    const band = await screen.findByRole('list', { name: 'The Drawing Set’s files' })
    expect(screen.getByRole('link', { name: 'Go to the Drawing Set' })).toBeDefined()
    const chip = [...band.querySelectorAll('button')].find((b) => clean(b.textContent).includes('SG-STR-R0.dwg'))
    expect(chip, 'the file’s chip').toBeDefined()
    await userEvent.click(chip!)
    await waitFor(() => expect(bodyText()).not.toContain('No sheets yet: they arrive as'))
  })
})

describe('Coverage’s views by the step (must 3)', () => {
  it('shows Step 2 once, summing general_notes and the Structural Part, and the rows in the steps’ order, Parts last', async () => {
    const { api, step1 } = kr01(() => [])
    step1.coverage = { ...step1.coverage, by_step: { beams: 7, electrical: 4, general_notes: 3, structural: 1, foundations: 5, columns: 6 } }
    await mountApp(PATH, { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    await openCoverage()
    const heading = await screen.findByText('Views by the step that will read them, proposed or assigned')
    const block = heading.closest('section') ?? heading.parentElement!
    const terms = [...block.querySelectorAll('dt')].map((dt) => clean(dt.textContent))
    const values = [...block.querySelectorAll('dd')].map((dd) => clean(dd.textContent))
    expect(terms).toEqual(['2 Notes', '5 Foundations', '6 Columns', '7 Beams', 'Electrical, M3 onwards'])
    expect(values).toEqual(['4', '5', '6', '7', '4'])
  })
})

describe('the Coverage panel while a file reads (must 4)', () => {
  it('says the reading file’s views join as its sheets arrive, and nothing of the waiting one', async () => {
    const { api } = kr01(() => [
      file({ name: 'KR-ELE-R0.dwg', discipline: 'electrical', state: 'reading', status: msg('drawings.files.reading_sheet', { position: 2, total: 3 }) }),
      file({ name: 'KR-PLB-R0.dwg', discipline: 'plumbing', state: 'waiting', status: msg('drawings.files.waiting', { ahead: 1 }) }),
    ])
    await mountApp(PATH, { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    await openCoverage()
    await waitFor(() => expect(bodyText()).toContain('KR-ELE-R0.dwg is still reading; its views join as its sheets arrive.'))
    expect(bodyText()).not.toContain('KR-PLB-R0.dwg is still reading')
  })

  it('shows no "Views by the step" heading with no step under it', async () => {
    const { api, step1 } = kr01(() => [])
    step1.coverage = { ...step1.coverage, by_step: {} }
    await mountApp(PATH, { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    await openCoverage()
    expect(bodyText()).not.toContain('Views by the step that will read them')
  })
})

describe('the bulk act while a file reads (6.13)', () => {
  it('says the sheets of the file still to be read are not in it', async () => {
    const { api } = kr01(() => [file({ name: 'KR-ELE-R0.dwg', discipline: 'electrical', state: 'reading', status: msg('drawings.files.reading_sheet', { position: 2, total: 3 }) })])
    await mountApp(PATH, { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toMatch(/Confirm \d+ sheets? that agree/))
    expect(bodyText()).toContain('The sheets of the file still to be read are not in it.')
  })
})
