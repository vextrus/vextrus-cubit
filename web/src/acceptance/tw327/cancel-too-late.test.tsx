/*
 * T-W327's acceptance tests (#331, G1 walk item FL3): "Cancel reading" that arrives after the file's read
 * ended well is told in a toast, not hidden and not shown as an error.
 *
 * The ticket's seams: the cancel answers `409 {"code": "drawings.files.cancel_too_late", "params": {}}`;
 * the page shows the toast "This file finished reading before the cancel arrived, so nothing was undone.
 * Its row shows how it ended." in the `role="status"` region, no error bar, the row as the API now has
 * it, and the focus on the row's new act (m0-screens §8 item 7). Any other refusal stays in the error
 * bar. The words are the catalogue's (`web/src/messages/drawings/files/en.po`), with no code, path or
 * engine word in them (m0-screens §1.1).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeDrawingSet, file, msg, refusalOf } from '@/acceptance/t20b/drawings.fixture'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const TOO_LATE = 'This file finished reading before the cancel arrived, so nothing was undone. Its row shows how it ended.'
const NAME = 'KR-LFT-R1.dwg'

function rowOf(name: string): HTMLElement {
  const rows = [...document.querySelectorAll<HTMLElement>('tr, [role="row"]')].filter((r) => clean(r.textContent).includes(name))
  const inner = rows.filter((r) => !rows.some((o) => o !== r && r.contains(o)))
  expect(inner, `one row for ${name}`).toHaveLength(1)
  return inner[0]!
}

async function row(name: string): Promise<HTMLElement> {
  await waitFor(() => rowOf(name))
  return rowOf(name)
}

const toasts = () => [...document.querySelectorAll('[role="status"]')].map((s) => clean(s.textContent)).join(' ')
const errorBars = () => [...document.querySelectorAll('[role="alert"]')]

/**
 * A reading DWG whose cancel the API refuses with `status`/`code`; with `endsRead`, the files list
 * serves it read once the cancel has been asked (its read ended a moment before).
 */
async function readingFile(status: number, code: string, endsRead: boolean) {
  const api = new FakeApi()
  const set = new FakeDrawingSet(api, 'KR-01')
  const reading = file({ name: NAME, state: 'reading', status: msg('drawings.files.finishing') })
  set.files.push(reading)
  set.summary = msg('drawings.files.summary', { files: 1, sheets: 0, held_sheets: 0, reading: 1, failed: 0, held: 0, refused: 0 })
  api.failOnce((m, p) => m === 'POST' && p.endsWith(`/files/${reading.id}/cancel`), status, refusalOf(code))
  const handle = api.handle
  api.handle = async (request: Request) => {
    const path = new URL(request.url, location.origin).pathname
    if (endsRead && request.method === 'POST' && path.endsWith(`/files/${reading.id}/cancel`)) {
      set.files = [{ ...reading, state: 'read', status: msg('drawings.files.read'), sheets_found: 11 }]
      set.summary = msg('drawings.files.summary', { files: 1, sheets: 11, held_sheets: 0, reading: 0, failed: 0, held: 0, refused: 0 })
    }
    return handle(request)
  }
  await mountApp('/p/KR-01/drawing-set', { as: PEOPLE.qs, api })
  await screen.findByRole('heading', { name: 'Drawing Set' })
  return { api, set, reading }
}

describe('a cancel that arrives too late is a toast, not an error (#331)', () => {
  it('says so in a toast, shows no error bar, and the row shows the file read', async () => {
    await readingFile(409, 'drawings.files.cancel_too_late', true)
    await userEvent.click(within(await row(NAME)).getByRole('button', { name: 'Cancel reading' }))

    await waitFor(() => expect(toasts()).toContain(TOO_LATE))
    await waitFor(() => expect(clean(rowOf(NAME).textContent)).toContain('Read. Two readers agree'))
    expect(errorBars(), 'no error bar').toEqual([])
    expect(within(rowOf(NAME)).getByRole('button', { name: 'Open in Step 1' })).toBeVisible()
    expect(within(rowOf(NAME)).queryByRole('button', { name: 'Cancel reading' })).toBeNull()
  })

  it("moves the focus to the row's new act, never to the page", async () => {
    await readingFile(409, 'drawings.files.cancel_too_late', true)
    const cancel = within(await row(NAME)).getByRole('button', { name: 'Cancel reading' })
    cancel.focus()
    await userEvent.keyboard('{Enter}')

    await waitFor(() => expect(toasts()).toContain(TOO_LATE))
    await waitFor(() => expect(document.activeElement).toBe(within(rowOf(NAME)).getByRole('button', { name: 'Open in Step 1' })))
    expect(document.activeElement).not.toBe(document.body)
  })

  it('words the toast without a code, a status or an engine word', async () => {
    await readingFile(409, 'drawings.files.cancel_too_late', true)
    await userEvent.click(within(await row(NAME)).getByRole('button', { name: 'Cancel reading' }))
    await waitFor(() => expect(toasts()).toContain(TOO_LATE))
    expect(toasts()).not.toMatch(/cancel_too_late|drawings\.|409|\bjob\b|\bworker\b|\bqueue\b|\bAPI\b/)
  })
})

describe('other refusals stay where they were (the error bar)', () => {
  it.each([
    ['a 409 already_ended', 409, 'drawings.files.already_ended'],
    ['a 500', 500, 'platform.server_error'],
  ])('shows a cancel refused with %s in the error bar, with no toast', async (_, status, code) => {
    await readingFile(status, code, false)
    await userEvent.click(within(await row(NAME)).getByRole('button', { name: 'Cancel reading' }))
    await waitFor(() => expect(errorBars().length).toBeGreaterThan(0))
    expect(toasts()).not.toContain(TOO_LATE)
  })

  it('still shows a refused "Read again" (not_stopped) in the error bar, with no toast', async () => {
    const api = new FakeApi()
    const set = new FakeDrawingSet(api, 'KR-01')
    set.files.push(file({ name: NAME, state: 'cancelled', status: msg('drawings.files.cancelled_unnamed') }))
    api.failOnce((m, p) => m === 'POST' && p.endsWith('/restart'), 409, refusalOf('drawings.files.not_stopped'))
    await mountApp('/p/KR-01/drawing-set', { as: PEOPLE.qs, api })
    await userEvent.click(within(await row(NAME)).getByRole('button', { name: 'Read again' }))
    await waitFor(() => expect(errorBars().map((e) => clean(e.textContent)).join(' ')).toContain("This file's reading has not stopped, so it was not started again."))
    expect(toasts()).not.toContain(TOO_LATE)
  })
})

describe('the words are in the catalogue', () => {
  const catalogue = Object.values(
    import.meta.glob<string>('../../messages/drawings/files/en.po', { query: '?raw', import: 'default', eager: true }),
  )[0]!

  /** The catalogue's English for one code, its msgstr joined across continuation lines. */
  function english(code: string): string | null {
    const lines = catalogue.split('\n')
    const at = lines.indexOf(`msgid "${code}"`)
    if (at < 0) return null
    let text = ''
    for (const line of lines.slice(at + 1)) {
      const start = /^msgstr "(.*)"$/.exec(line)
      const more = /^"(.*)"$/.exec(line)
      if (start) text = start[1]!
      else if (more) text += more[1]!
      else break
    }
    return text.replace(/\\"/g, '"')
  }

  it('gives drawings.files.cancel_too_late its English, the toast word for word', () => {
    expect(english('drawings.files.cancel_too_late')).toBe(TOO_LATE)
  })

  it('words held_sheets in the summary', () => {
    expect(english('drawings.files.summary')).toContain('held_sheets')
  })
})
