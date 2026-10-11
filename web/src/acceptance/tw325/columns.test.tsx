/*
 * Ticket T-W325's acceptance tests (#325): the Projects list (docs/design/m0-screens.md §4.3) shows each
 * project's Drawing Set, Takeoff and Updated in 4.3's words, from the readings the API sends (the
 * files, Step 1's progress, and the project list's `updated_at`, the time of the project's newest
 * DomainEvent: S15-W6, #548), through the in-memory API with readings.fixture.ts laid over it. Each row asks for its own project's readings only; a reading that cannot be had is
 * the empty figure (§1.2), never an error. Every name, number and date is invented.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { overrideLanguage } from '@/app/dev-language'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { unmarkedNotation } from '@/format/unmarked'
import { activateLanguage } from '@/i18n/activate'
import { englishMessages } from '@/i18n/catalogues'
import { ENGLISH } from '@/i18n/languages'
import { activatePseudoRtl } from '@/i18n/pseudo'
import { expectKeyMapSound, notationProblems } from '@/ui'
import {
  COLUMNS,
  FakeReadings,
  aFile,
  aRow,
  cellOf,
  cellText,
  cellTitle,
  clean,
  confirmedRow,
  files,
  listbox,
  rowOf,
  rows,
  type Column,
  type FileOut,
  type ProgressRow,
} from './readings.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-29T08:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
  overrideLanguage(false)
  activateLanguage(ENGLISH, englishMessages())
})

/** The page's poll while a file moves (`POLL_MS`, drawing-set/data.ts), and the wait allowed for it. */
const POLL_WAIT = { timeout: 6000 }
const EMPTY = '—'

function seeded(extend?: (api: FakeApi) => void) {
  const api = new FakeApi({ extend })
  return { api, readings: new FakeReadings(api) }
}

async function projects(api: FakeApi, as: string = PEOPLE.qs) {
  const app = await mountApp('/projects', { as, api })
  await screen.findByRole('heading', { name: 'Projects' })
  await waitFor(() => expect(rows().length).toBeGreaterThan(0))
  return app
}

async function shows(code: string, column: Column, words: string, options?: { timeout: number }) {
  await waitFor(() => expect(cellText(code, column)).toBe(words), options)
}

const readingSheet = (name: string, position: number, total: number, over: Partial<FileOut> = {}) =>
  aFile(name, 'reading', {
    status: {
      code: 'drawings.files.reading_sheet',
      params: { position, total },
    },
    ...over,
  })

describe('the Drawing Set column (§4.3)', () => {
  it('shows "No drawings yet", "Not started" and the day it was created for a project with nothing in it', async () => {
    const { api } = seeded()
    api.project('SG-03').createdAt = '2026-08-11T03:00:00Z'
    await projects(api)
    await shows('SG-03', 'Drawing Set', 'No drawings yet')
    await shows('SG-03', 'Takeoff', 'Not started')
    await shows('SG-03', 'Updated', '11 Aug 2026')
  })

  it.each<[string, string, () => FileOut[]]>([
    [
      'seven read (two of them PDFs) and two held',
      '7 files read, 2 held',
      () => [...files(1, 'held', 'mezzanine'), ...files(5, 'read', 'level'), aFile('plotted-east.pdf', 'read'), ...files(1, 'held', 'podium'), aFile('plotted-west.pdf', 'read')],
    ],
    ['one read', '1 file read', () => files(1, 'read')],
    [
      'every kind of trouble, said in its order',
      '5 files read, 1 held, 3 could not be read, 2 refused, 1 stopped',
      () => [...files(1, 'cancelled'), ...files(2, 'refused'), ...files(2, 'unreadable'), ...files(5, 'read'), ...files(1, 'failed'), ...files(1, 'held')],
    ],
    ['none read and two held', 'No files read, 2 held', () => files(2, 'held')],
    ['two read and one cancelled', '2 files read, 1 stopped', () => [...files(2, 'read'), ...files(1, 'cancelled')]],
    ['one refused, nothing read', 'No files read, 1 refused', () => files(1, 'refused')],
  ])('words %s as "%s"', async (_, words, list) => {
    const { api, readings } = seeded()
    readings.setFiles('BP-02', list())
    await projects(api)
    await shows('BP-02', 'Drawing Set', words)
  })

  it.each<[string, string, () => FileOut[]]>([
    ['one file reading its sheet 4 of 19, beside one read', 'Reading 1 file, sheet 4 of 19', () => [aFile('core.dwg', 'read'), readingSheet('roof.dwg', 4, 19)]],
    ['two moving, one of them with its sheet', 'Reading 2 files', () => [readingSheet('east.dwg', 3, 8), aFile('west.dwg', 'retrying')]],
    ['one waiting, no sheet yet', 'Reading 1 file', () => [aFile('annex.dwg', 'waiting')]],
    ['one stopping', 'Reading 1 file', () => [aFile('annex.dwg', 'stopping'), aFile('plinth.dwg', 'read')]],
    [
      'three moving among read and held ones',
      'Reading 3 files',
      () => [aFile('a.dwg', 'waiting'), readingSheet('b.dwg', 2, 6), aFile('c.dwg', 'stopping'), aFile('d.dwg', 'read'), aFile('e.dwg', 'held')],
    ],
    ['one reading with no sheets counted yet', 'Reading 1 file', () => [readingSheet('f.dwg', 0, 0)]],
  ])('words %s as "%s"', async (_, words, list) => {
    const { api, readings } = seeded()
    readings.setFiles('KR-01', list())
    await projects(api)
    await shows('KR-01', 'Drawing Set', words)
  })

  it('reads a moving file again within the poll, shows it read, then reads that project’s Step 1 once more', async () => {
    const { api, readings } = seeded()
    const moving = readingSheet('tower.dwg', 2, 5)
    readings.setFiles('KR-01', [moving])
    readings.setProgress('KR-01', [aRow('structural', { found: 3 })])
    // BP-02's file keeps moving throughout: its polls mark the time passing.
    readings.setFiles('BP-02', [aFile('pacer.dwg', 'waiting')])
    await projects(api)
    await shows('KR-01', 'Drawing Set', 'Reading 1 file, sheet 2 of 5')
    await shows('KR-01', 'Takeoff', 'Step 1: 3 sheets to confirm')
    const kr01Files = readings.count('files', 'KR-01')
    await waitFor(() => expect(readings.count('files', 'KR-01')).toBeGreaterThan(kr01Files), POLL_WAIT)
    // While it moves, the list re-reads its files only, never its Step 1.
    expect(readings.count('progress', 'KR-01')).toBe(1)

    readings.setFiles('KR-01', [
      {
        ...moving,
        state: 'read',
        status: { code: 'drawings.files.read', params: {} },
        sheets_found: 5,
      },
    ])
    readings.setProgress('KR-01', [aRow('structural', { found: 8 })])
    await shows('KR-01', 'Drawing Set', '1 file read', POLL_WAIT)
    await shows('KR-01', 'Takeoff', 'Step 1: 8 sheets to confirm', POLL_WAIT)
    const after = {
      files: readings.count('files', 'KR-01'),
      progress: readings.count('progress', 'KR-01'),
    }
    expect(after.progress).toBe(2)
    // Two more of BP-02's polls: KR-01, now still, is asked nothing more.
    const pacer = readings.count('files', 'BP-02')
    await waitFor(() => expect(readings.count('files', 'BP-02')).toBeGreaterThanOrEqual(pacer + 2), POLL_WAIT)
    expect(readings.count('files', 'KR-01')).toBe(after.files)
    expect(readings.count('progress', 'KR-01')).toBe(2)
    expect(readings.count('progress', 'BP-02')).toBe(1)
  })
})

describe('the Takeoff column (§4.3)', () => {
  it.each<[string, string, () => ProgressRow[], string[]]>([
    ['no sheet found in any Discipline', 'Not started', () => [aRow('structural'), aRow('architectural')], []],
    ['no Discipline at all', 'Not started', () => [], ['structural', 'electrical']],
    [
      'none confirmed, six Questions open over two Disciplines',
      'Step 1: 6 Questions open',
      () => [aRow('structural', { found: 12, confirmed: 3, open_questions: 4 }), aRow('electrical', { found: 5, open_questions: 2 })],
      [],
    ],
    ['none confirmed, one Question open', 'Step 1: 1 Question open', () => [aRow('architectural', { found: 7, open_questions: 1 }), aRow('structural', { found: 3 })], []],
    [
      'none confirmed, no Question, eleven sheets not yet decided',
      'Step 1: 11 sheets to confirm',
      () => [aRow('structural', { found: 11, confirmed: 4 }), aRow('architectural', { found: 6, confirmed: 2 })],
      ['plumbing'],
    ],
    [
      'Structural confirmed, Electrical with four sheets left',
      'Step 1: Structural confirmed · Electrical 4 to confirm',
      () => [confirmedRow('structural', 9), aRow('electrical', { found: 15, confirmed: 11 })],
      [],
    ],
    [
      'Architectural confirmed, Plumbing decided with three Questions open',
      'Step 1: Architectural confirmed · Plumbing and sanitary: 3 Questions open',
      () => [confirmedRow('architectural', 6), aRow('plumbing', { found: 4, confirmed: 4, open_questions: 3 })],
      [],
    ],
    [
      'Structural confirmed, Electrical decided with one Question open',
      'Step 1: Structural confirmed · Electrical: 1 Question open',
      () => [confirmedRow('structural', 9), aRow('electrical', { found: 5, confirmed: 5, open_questions: 1 })],
      [],
    ],
    [
      'Structural confirmed, Electrical decided with a view unaccounted',
      'Step 1: Structural confirmed · Electrical: a view unaccounted',
      () => [confirmedRow('structural', 9), aRow('electrical', { found: 5, confirmed: 5 })],
      [],
    ],
    ['every Discipline with sheets confirmed and none still to come', 'Step 1 confirmed', () => [confirmedRow('structural', 9), aRow('fire'), confirmedRow('electrical', 4)], []],
    [
      'every Discipline with sheets confirmed, one still to come',
      'Step 1: Architectural confirmed · Electrical confirmed',
      () => [confirmedRow('architectural', 6), confirmedRow('electrical', 4)],
      ['plumbing'],
    ],
    [
      'none confirmed, every sheet decided, no Question',
      'Step 1: not yet confirmed',
      () => [aRow('structural', { found: 8, confirmed: 8 }), aRow('architectural', { found: 5, confirmed: 5 })],
      [],
    ],
  ])('words %s as "%s"', async (_, words, progress, notReceived) => {
    const { api, readings } = seeded()
    readings.setFiles('SG-03', files(2, 'read'))
    readings.setProgress('SG-03', progress(), notReceived)
    await projects(api)
    await shows('SG-03', 'Takeoff', words)
  })
})

describe('the Updated column: the day of the project’s newest act, its newest DomainEvent, in Dhaka time (S15-W6)', () => {
  it.each([
    ['the QS', PEOPLE.qs, true],
    ['the MD', PEOPLE.md, true],
    ['the Vextrus Engineer', PEOPLE.engineer, false],
    ['a Guest', PEOPLE.guest, false],
  ])('shows %s the day of the project’s newest act, the day it is in Dhaka', async (_, as, seesActs) => {
    const { api, readings } = seeded()
    api.project('KR-01').createdAt = '2026-09-03T04:00:00Z'
    readings.setFiles('KR-01', files(2, 'read', 'tower', { added_at: '2026-09-05T04:00:00Z' }))
    readings.act('KR-01', '2026-09-20T05:00:00Z')
    readings.act('KR-01', '2026-09-27T19:30:00Z')
    readings.act('KR-01', '2026-09-24T06:00:00Z')
    readings.act('BP-02', '2026-09-28T09:00:00Z')
    await projects(api, as)
    await shows('KR-01', 'Updated', '28 Sep 2026')
    await shows('KR-01', 'Drawing Set', '2 files read')
    // A role without the acts grant is never sent to the activity, so no refusal is asked for.
    if (!seesActs) expect(readings.seen.filter((call) => call.startsWith('GET /api/activity'))).toEqual([])
  })

  it('shows the new day when the QS comes back to the list after an act on the project', async () => {
    const { api, readings } = seeded()
    api.project('BP-02').createdAt = '2026-09-02T04:00:00Z'
    readings.act('BP-02', '2026-09-10T05:00:00Z')
    const { router } = await projects(api)
    await shows('BP-02', 'Updated', '10 Sep 2026')
    await router.navigate({ to: '/p/$code/drawing-set', params: { code: 'BP-02' } })
    expect(await screen.findByRole('heading', { name: 'Drawing Set' })).toBeVisible()
    readings.act('BP-02', '2026-09-29T07:30:00Z')
    await router.navigate({ to: '/projects' })
    await screen.findByRole('heading', { name: 'Projects' })
    await shows('BP-02', 'Updated', '29 Sep 2026')
  })
})

describe('only this member’s projects, one reading each (§1.4)', () => {
  it('asks a Guest given one project for that project’s readings only, and never the activity', async () => {
    const { api, readings } = seeded((a) => {
      const shapla = a.developer('Shapla Homes Ltd')
      a.addMembership(shapla, a.addUser('lipi@karnaphuli-works.example', 'Lipi Chakma'), 'guest', {
        outsideOrg: 'Karnaphuli Works',
        projectIds: [a.project('SG-03').id],
        expiresAt: '2026-10-30T17:59:00Z',
      })
    })
    readings.setFiles('SG-03', files(1, 'read'))
    readings.setFiles('KR-01', files(3, 'read'))
    await projects(api, 'lipi@karnaphuli-works.example')
    await shows('SG-03', 'Drawing Set', '1 file read')
    await shows('SG-03', 'Takeoff', 'Not started')
    expect(rows()).toHaveLength(1)
    expect([...readings.projectIdsAsked()]).toEqual([readings.id('SG-03')])
    expect(readings.count('activity')).toBe(0)
  })

  it('asks a QS given one project for that project’s readings only', async () => {
    const { api, readings } = seeded()
    api.project('BP-02').createdAt = '2026-09-06T04:00:00Z'
    readings.setFiles('BP-02', files(2, 'read', 'block'))
    readings.act('BP-02', '2026-09-18T04:00:00Z')
    readings.setFiles('KR-01', files(4, 'read'))
    await projects(api, PEOPLE.scopedQs)
    await shows('BP-02', 'Drawing Set', '2 files read')
    await shows('BP-02', 'Updated', '18 Sep 2026')
    expect([...readings.projectIdsAsked()]).toEqual([readings.id('BP-02')])
    expect(readings.count('activity', 'BP-02')).toBeLessThanOrEqual(1)
  })

  it('reads each of a QS’s three projects once on opening, and again only the files of the one that moves', async () => {
    const { api, readings } = seeded()
    readings.setFiles('KR-01', [aFile('slow.dwg', 'waiting')])
    readings.setFiles('BP-02', files(3, 'read'))
    readings.setProgress('BP-02', [aRow('structural', { found: 6, confirmed: 1 })])
    await projects(api)
    await shows('KR-01', 'Drawing Set', 'Reading 1 file')
    await shows('BP-02', 'Drawing Set', '3 files read')
    await shows('BP-02', 'Takeoff', 'Step 1: 5 sheets to confirm')
    await shows('SG-03', 'Drawing Set', 'No drawings yet')
    // KR-01's file moves: two of its polls mark the time passing.
    await waitFor(() => expect(readings.count('files', 'KR-01')).toBeGreaterThanOrEqual(3), POLL_WAIT)
    expect(readings.count('files', 'BP-02')).toBe(1)
    expect(readings.count('files', 'SG-03')).toBe(1)
    for (const code of ['KR-01', 'BP-02', 'SG-03']) {
      expect(readings.count('progress', code), code).toBe(1)
      expect(readings.count('activity', code), code).toBeLessThanOrEqual(1)
    }
    expect(readings.projectIdsAsked().has(readings.id('MG-01'))).toBe(false)
  })
})

describe('a reading that cannot be had (§1.2)', () => {
  it('shows the empty figure for a refused or failed reading, and the rest of the list and its keys work', async () => {
    const rejected: unknown[] = []
    const onRejection = (event: PromiseRejectionEvent) => rejected.push(event.reason)
    window.addEventListener('unhandledrejection', onRejection)
    const errors = vi.spyOn(console, 'error')
    try {
      const { api, readings } = seeded()
      readings.fail('KR-01', 'files', 404)
      readings.setProgress('KR-01', [aRow('structural', { found: 9, open_questions: 2 })])
      readings.setFiles('BP-02', files(2, 'read'))
      readings.fail('BP-02', 'progress', 500)
      readings.setFiles('SG-03', files(1, 'held'))
      readings.setProgress('SG-03', [aRow('electrical', { found: 4, confirmed: 1 })])
      const { router, keyMap } = await projects(api)
      await shows('KR-01', 'Takeoff', 'Step 1: 2 Questions open')
      await shows('BP-02', 'Drawing Set', '2 files read')
      await shows('SG-03', 'Drawing Set', 'No files read, 1 held')
      await shows('SG-03', 'Takeoff', 'Step 1: 3 sheets to confirm')
      await waitFor(() => expect(readings.count('files', 'KR-01')).toBeGreaterThanOrEqual(1))
      await waitFor(() => expect(readings.count('progress', 'BP-02')).toBeGreaterThanOrEqual(1))
      expect(cellText('KR-01', 'Drawing Set')).toBe(EMPTY)
      expect(cellText('BP-02', 'Takeoff')).toBe(EMPTY)
      expect(document.querySelector('[role="alert"]')).toBeNull()
      for (const status of document.querySelectorAll('[role="status"]')) expect(clean(status.textContent)).toBe('')
      expect(clean(document.body.textContent)).not.toMatch(/Something went wrong|could not be reached|Try again/)

      listbox().focus()
      await userEvent.keyboard('{ArrowDown}')
      expect(rows()[1]).toHaveAttribute('data-focused')
      await userEvent.keyboard('{End}')
      expect(rows()[2]).toHaveAttribute('data-focused')
      await userEvent.keyboard('{Home}{ArrowDown}{Enter}')
      await waitFor(() => expect(router.state.location.pathname).toBe('/p/KR-01/takeoff/1'))
      expectKeyMapSound(keyMap)
      expect(rejected).toEqual([])
      expect(errors).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('unhandledrejection', onRejection)
      errors.mockRestore()
    }
  })
})

describe('one 28 px line per row (§4.3, §8)', () => {
  it.each([
    [1440, 900],
    [1280, 800],
  ])('keeps a long Takeoff text on one line at %i px, its full text in its title, every cell under its header', async (width, height) => {
    await page.viewport(width, height)
    const { api, readings } = seeded()
    readings.setFiles('KR-01', [...files(6, 'read'), ...files(2, 'held'), ...files(1, 'unreadable')])
    readings.setProgress('KR-01', [confirmedRow('structural', 14), aRow('plumbing', { found: 23, confirmed: 11 })])
    readings.setFiles('BP-02', [readingSheet('long.dwg', 11, 37)])
    await projects(api)
    const words = 'Step 1: Structural confirmed · Plumbing and sanitary 12 to confirm'
    await shows('KR-01', 'Takeoff', words)
    await shows('BP-02', 'Drawing Set', 'Reading 1 file, sheet 11 of 37')
    const cell = cellOf(rowOf('KR-01'), 'Takeoff')
    expect(cellTitle(cell)).toBe(words)
    const holders = [cell, ...cell.querySelectorAll<HTMLElement>('*')]
    expect(holders.some((el) => getComputedStyle(el).whiteSpace === 'nowrap')).toBe(true)
    for (const row of rows()) {
      expect(row.getBoundingClientRect().height).toBe(28)
      for (const column of COLUMNS) expect(() => cellOf(row, column)).not.toThrow()
    }
    const list = listbox()
    expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth)
  })
})

describe('the design gate, with the rows full (§1.1, §1.8)', () => {
  function full() {
    const { api, readings } = seeded()
    readings.setFiles('KR-01', [...files(3, 'read'), ...files(1, 'held'), ...files(1, 'failed'), ...files(1, 'refused'), ...files(1, 'cancelled')])
    readings.setProgress('KR-01', [confirmedRow('architectural', 6), aRow('electrical', { found: 7, confirmed: 7, open_questions: 2 })])
    readings.setFiles('BP-02', [readingSheet('deck.dwg', 5, 16)])
    readings.setProgress('BP-02', [aRow('structural', { found: 10, open_questions: 3 })])
    readings.setFiles('SG-03', files(4, 'read'))
    readings.setProgress('SG-03', [confirmedRow('structural', 12), confirmedRow('electrical', 3)])
    api.project('SG-03').createdAt = '2026-09-04T04:00:00Z'
    readings.act('SG-03', '2026-09-23T09:00:00Z')
    return { api, readings }
  }

  it('shows no machine word, no message code, and no unmarked figure', async () => {
    const { api } = full()
    const { keyMap } = await projects(api)
    await shows('KR-01', 'Drawing Set', '3 files read, 1 held, 1 could not be read, 1 refused, 1 stopped')
    await shows('KR-01', 'Takeoff', 'Step 1: Architectural confirmed · Electrical: 2 Questions open')
    await shows('BP-02', 'Drawing Set', 'Reading 1 file, sheet 5 of 16')
    await shows('SG-03', 'Takeoff', 'Step 1 confirmed')
    await shows('SG-03', 'Updated', '23 Sep 2026')
    // m0-screens 1.1's never-shown words are judged on every screen by the one list (S15-W7), not here.
    const text = clean(document.body.textContent)
    expect(text).not.toMatch(/\b[a-z_]+\.[a-z_]+\.[a-z_]+\b/)
    expect(text).not.toMatch(/\b(waiting|reading|stopping|retrying|unreadable|cancelled|in_review|not_started)\b/)
    expect(notationProblems(document.body)).toEqual([])
    expect(unmarkedNotation(document.body)).toEqual([])
    expectKeyMapSound(keyMap)
  })

  it('mirrors the rows in the pseudo right-to-left language, each figure in the cells isolated', async () => {
    overrideLanguage()
    activatePseudoRtl()
    const { api } = full()
    await mountApp('/projects', { api })
    await waitFor(() => expect(document.documentElement.dir).toBe('rtl'))
    await waitFor(() => expect(rows()).toHaveLength(3))
    const row = rowOf('KR-01')
    await waitFor(() => expect(clean(cellOf(row, 'Drawing Set').textContent)).toMatch(/3/))
    await waitFor(() => expect(clean(cellOf(rowOf('BP-02'), 'Drawing Set').textContent)).toMatch(/16/))
    await waitFor(() => expect(clean(cellOf(rowOf('SG-03'), 'Updated').textContent)).toMatch(/23/))
    // Mirrored: the code at the row's start, which is its right.
    expect(cellOf(row, 'Code').getBoundingClientRect().left).toBeGreaterThan(cellOf(row, 'Drawing Set').getBoundingClientRect().left)
    for (const code of ['KR-01', 'BP-02']) {
      const raw = cellOf(rowOf(code), 'Drawing Set').textContent ?? ''
      expect(raw.replace(/⁨[^⁩]*⁩/g, ''), code).not.toMatch(/\d/)
    }
    expect(notationProblems(document.body)).toEqual([])
    expect(unmarkedNotation(document.body)).toEqual([])
  })
})
