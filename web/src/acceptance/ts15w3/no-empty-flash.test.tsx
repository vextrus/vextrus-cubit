/*
 * S15-W3 (issue #547, superseding #241): when the last file finishes reading, Step 1 never shows its
 * empty state on the way to the sheets, not even for one commit.
 *
 * docs/design/m0-screens.md §6.13, "Files still reading": the reading file's chip spins and "one skeleton
 * row per sheet to come, "reading…""; §4.7's "No files" state ("No sheets yet. Add the Drawing Set's
 * files first.") is for a set with no files, and §6.6's "Nothing is waiting." for nothing left to do.
 * #241: "`NoSheets` … mounts in the render where the files answer shows nothing reading; Step 1's
 * reload starts only in `useRefreshAsFilesFinish`'s effect, after that commit, so one commit holds "No
 * sheets yet. Add the Drawing Set…" and "Nothing is waiting." before the Skeleton replaces it"; "commit
 * the reviewer's A2 attack (a MutationObserver on every commit) as the test".
 *
 * KR-01 with one file, KR-STR-R0.dwg, still reading and no sheet in Step 1 yet (22's fake, empty, over
 * 20b's files list). `finish()` does what the server does as the file is read: the file's row moves to
 * read and its 13 sheets join Step 1's answers. Fake time only; the Drawing Set's polls run on it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeDrawingSet, file, msg } from '../t20b/drawings.fixture'
import { FakeStep1, kr01Proposals } from '../t22/step1.fixture'
import { PATH, bodyText, clean } from './w3.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  vi.setSystemTime(new Date('2026-10-06T06:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

/** §4.7's "No files" words up to the apostrophe (the product prints a typographic one), and §6.6's. */
const NO_FILES = 'No sheets yet. Add the Drawing Set'
const NOTHING_WAITING = 'Nothing is waiting.'

function onlyFileReading() {
  const api = new FakeApi()
  const set = new FakeDrawingSet(api, 'KR-01')
  const step1 = new FakeStep1(api, 'KR-01', true)
  const sheets = kr01Proposals().filter((p) => p.discipline === 'structural')
  const reading = file({ id: sheets[0]!.file_id, name: 'KR-STR-R0.dwg', state: 'reading', status: msg('drawings.files.reading_sheet', { position: 12, total: 13 }) })
  set.files = [reading]
  const finish = () => {
    Object.assign(reading, { state: 'read', status: msg('drawings.files.read', { sheets: 13 }), sheets_found: 13 })
    step1.proposals = sheets
    step1.lists = { structural: { source: 'sheet', numbers: sheets.map((p) => p.number!).filter((n, i, all) => all.indexOf(n) === i), entered_by: null, entered_at: null, read_numbers: null } }
    step1.coverage = { ...step1.coverage, views: 40, proposed: 40 }
  }
  return { api, finish }
}

/** Advances the fake clock in small steps until `ok` holds, at most `limitMs` of fake time (as ../tstep1live). */
async function within_(limitMs: number, ok: () => boolean): Promise<boolean> {
  for (let spent = 0; spent <= limitMs; spent += 50) {
    if (ok()) return true
    await vi.advanceTimersByTimeAsync(50)
  }
  return ok()
}

/**
 * Every text the page held after any commit while it watched: the whole body's text at each batch of
 * mutations, and the text of every node added (so a node added and removed in one batch is still seen).
 */
function watch(): { seen: string[]; stop: () => void } {
  const seen: string[] = []
  const observer = new MutationObserver((records) => {
    seen.push(bodyText())
    for (const r of records) {
      for (const n of r.addedNodes) seen.push(clean(n.textContent))
      if (r.type === 'characterData') seen.push(clean(r.target.textContent))
    }
  })
  observer.observe(document.body, { subtree: true, childList: true, characterData: true })
  return { seen, stop: () => observer.disconnect() }
}

async function finishWhileWatching(): Promise<string[]> {
  const { api, finish } = onlyFileReading()
  const mounting = mountApp(PATH, { as: PEOPLE.qs, api })
  let mounted = false
  void mounting.then(() => (mounted = true))
  expect(await within_(5_000, () => mounted), 'the app mounts').toBe(true)
  expect(await within_(5_000, () => bodyText().includes('KR-STR-R0.dwg')), `Step 1 shows the reading file; it shows: ${bodyText().slice(0, 300)}`).toBe(true)
  const watching = watch()
  finish()
  expect(await within_(10_000, () => bodyText().includes('S-01') && bodyText().includes('S-12')), 'the sheets join the list').toBe(true)
  // A little longer: any late commit is watched too.
  await within_(500, () => false)
  watching.stop()
  return watching.seen
}

describe('the last file finishing never flashes Step 1’s empty state (#241)', () => {
  it('never puts "No sheets yet. Add the Drawing Set’s files first." in the page', async () => {
    const seen = await finishWhileWatching()
    expect(seen.filter((t) => t.includes(NO_FILES)).length, `commits holding "${NO_FILES}…"`).toBe(0)
  })

  it('never puts "Nothing is waiting." in the page', async () => {
    const seen = await finishWhileWatching()
    expect(seen.filter((t) => t.includes(NOTHING_WAITING)).length, `commits holding "${NOTHING_WAITING}"`).toBe(0)
  })
})
