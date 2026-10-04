/*
 * Step 1's still-reading row past ticket 230's acceptance tests (its words gate's must and mays):
 * "sheet n of N" only where the file's status counts sheets; a PDF (a Plot) counts pages and promises
 * its pages are matched to sheets, never that its sheets join the list; a waiting or interrupted file
 * is never "Still reading"; a file being stopped adds nothing and gets no row.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
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

const bodyText = () => (document.body.textContent ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()

it('words a Plot\'s pages, a wait, a retry and a stop by what each file is doing', async () => {
  const api = new FakeApi()
  const set = new FakeDrawingSet(api, 'KR-01')
  new FakeStep1(api, 'KR-01', true)
  set.files = [
    file({ name: 'KR-STR-R0.pdf', state: 'reading', status: msg('drawings.files.reading_page', { position: 4, total: 9 }) }),
    file({ name: 'KR-ARC-R0.dwg', state: 'waiting', status: msg('drawings.files.waiting', { ahead: 0 }) }),
    file({ name: 'KR-PLB-R0.dwg', state: 'retrying', status: msg('drawings.files.retrying', { attempt: 2, tries: 3 }) }),
    file({ name: 'KR-MEC-R0.dwg', state: 'reading', status: msg('drawings.files.opening_file') }),
    file({ name: 'KR-ELE-R0.dwg', state: 'stopping', status: msg('drawings.files.stopping') }),
  ]
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain('Still reading KR-STR-R0.pdf: page 4 of 9. Its pages are matched to sheets when it is read.'))
  expect(bodyText()).toContain('KR-ARC-R0.dwg is waiting to be read. Its sheets join the list when it is read.')
  expect(bodyText()).toContain('Reading KR-PLB-R0.dwg was interrupted and is starting again. Its sheets join the list when it is read.')
  expect(bodyText()).toContain('Still reading KR-MEC-R0.dwg. Its sheets join the list when it is read.')
  expect(bodyText()).not.toMatch(/Still reading KR-(ARC|PLB|ELE)/)
  expect(bodyText()).not.toMatch(/sheet 4 of 9/)
})

/*
 * The refresh, past the acceptance tests (the refuter's three gaps): a file read between Step 1's answer
 * and the files' answer on first load; the moment between the last file's finish and its sheets'
 * arrival; a file added while nothing moves (another tab, a colleague). All in fake time.
 */
async function within(limitMs: number, ok: () => boolean, never?: () => boolean): Promise<boolean> {
  for (let spent = 0; spent <= limitMs; spent += 50) {
    if (never?.()) throw new Error(`shown meanwhile: ${bodyText().slice(0, 300)}`)
    if (ok()) return true
    await vi.advanceTimersByTimeAsync(50)
  }
  return ok()
}

function fakeClock() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  vi.setSystemTime(new Date('2026-10-04T06:00:00Z'))
}

/** KR-01 whose one file KR-STR-R0.dwg reads; `finish()` reads it as the server does (its 13 sheets join Step 1). */
function oneFileReading() {
  const api = new FakeApi()
  const set = new FakeDrawingSet(api, 'KR-01')
  const step1 = new FakeStep1(api, 'KR-01')
  const sheets = step1.proposals.filter((p) => p.discipline === 'structural')
  step1.proposals = []
  step1.questions = []
  const reading = file({ id: sheets[0]!.file_id, name: 'KR-STR-R0.dwg', state: 'reading', status: msg('drawings.files.reading_sheet', { position: 2, total: 13 }) })
  set.files = [reading]
  const finish = () => {
    Object.assign(reading, { state: 'read', status: msg('drawings.files.read', { sheets: 13 }), sheets_found: 13 })
    step1.proposals = sheets
  }
  return { api, set, finish }
}

async function mountOnFakeClock(api: FakeApi) {
  let done = false
  void mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api }).then(() => (done = true))
  expect(await within(5_000, () => done), 'the app mounts').toBe(true)
}

const NO_FILES = 'No sheets yet. Add the Drawing Set'

it('lists a file read between Step 1’s first answer and the files’ first answer', async () => {
  fakeClock()
  const { api, finish } = oneFileReading()
  const handle = api.handle
  let answered = false
  api.handle = async (request) => {
    const path = new URL(request.url).pathname
    // The server answers Step 1 (no sheets yet), then finishes the file before it answers the files.
    if (path.endsWith('/drawings/files') && !answered) {
      answered = true
      finish()
    }
    return handle(request)
  }
  await mountOnFakeClock(api)
  expect(await within(10_000, () => bodyText().includes('S-01') && bodyText().includes('Confirmed 0 / 13')), `S-01 listed; it shows: ${bodyText().slice(-300)}`).toBe(true)
})

it('never says "Add the Drawing Set’s files first" while the last file’s sheets are on their way', async () => {
  fakeClock()
  const { api, finish } = oneFileReading()
  await mountOnFakeClock(api)
  expect(await within(5_000, () => bodyText().includes('Still reading KR-STR-R0.dwg'))).toBe(true)
  const handle = api.handle
  api.handle = async (request) => {
    // Step 1's answers come back a second after the file is read.
    if (new URL(request.url).pathname.includes('/step1/')) await new Promise((resolve) => setTimeout(resolve, 1_000))
    return handle(request)
  }
  finish()
  expect(
    await within(
      15_000,
      () => bodyText().includes('S-01'),
      () => bodyText().includes(NO_FILES),
    ),
  ).toBe(true)
})

it('starts the row for a file added while nothing moves, within half a minute', async () => {
  fakeClock()
  const { api, set } = oneFileReading()
  const added = set.files[0]!
  set.files = []
  await mountOnFakeClock(api)
  expect(await within(5_000, () => bodyText().includes(NO_FILES))).toBe(true)
  set.files = [added]
  expect(await within(31_000, () => bodyText().includes('Still reading KR-STR-R0.dwg: sheet 2 of 13.')), `it shows: ${bodyText().slice(0, 300)}`).toBe(true)
})
