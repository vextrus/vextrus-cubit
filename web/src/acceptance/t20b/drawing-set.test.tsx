/*
 * Ticket 20b's acceptance tests: the Drawing Set page (docs/design/m0-screens.md §4.5, §8; docs/plans/
 * M0.md "20b Screens: the Drawing Set"), at /p/KR-01/drawing-set, through the in-memory API with 14's
 * and 21a's operations laid over it (drawings.fixture.ts). Every sentence the machine sends is a code;
 * these pin the English the reader sees, never the code.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { expectKeyMapSound, notationProblems } from '@/ui'
import { neverShownIn } from '@/test/never-shown'
import { FakeDrawingSet, file, msg, refusalOf, type FileOut } from './drawings.fixture'

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
const PATH = '/p/KR-01/drawing-set'

function drawingSet(): { api: FakeApi; set: FakeDrawingSet } {
  const api = new FakeApi()
  return { api, set: new FakeDrawingSet(api, 'KR-01') }
}

async function open(api: FakeApi, as: string = PEOPLE.qs) {
  const app = await mountApp(PATH, { as, api })
  await screen.findByRole('heading', { name: 'Drawing Set' })
  return app
}

/** The smallest row-like element (a table row or a list option) that holds `name`. */
function rowOf(name: string): HTMLElement {
  const rows = [...document.querySelectorAll<HTMLElement>('tr, [role="row"], [role="option"]')].filter((r) =>
    clean(r.textContent).includes(name),
  )
  const inner = rows.filter((r) => !rows.some((o) => o !== r && r.contains(o)))
  expect(inner, `one row for ${name}`).toHaveLength(1)
  return inner[0]!
}

async function row(name: string): Promise<HTMLElement> {
  await waitFor(() => rowOf(name))
  return rowOf(name)
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')
  expect(input, 'a file input behind "Add files"').not.toBeNull()
  return input!
}

const dwg = (name: string) => new File([new Uint8Array([0x41, 0x43, 0x31, 0x30, 0x33, 0x32])], name)

/** m0-screens §1.1's words, §1.3's CAD codes and §1.7's message keys never in the DOM. */
function gateGreps() {
  const text = bodyText()
  // Amended by S15-W7: §1.1's words come from the one list (web/src/test/never-shown.json).
  expect(neverShownIn(text), 'm0-screens §1.1').toEqual([])
  for (const word of ['Building', 'Bangladesh', 'BDT']) {
    expect(text, word).not.toMatch(new RegExp(`\\b${word}\\b`))
  }
  expect(text, 'a message key').not.toMatch(/\b(drawings|takeoff|platform)\.[a-z_]+\.[a-z_]+\b/)
  for (const code of ['%%', '\\P', '\\f', '\\S', '^J', '{\\']) expect(text).not.toContain(code)
  expect(notationProblems(document.body)).toEqual([])
}

/** The discipline select's option names on a row, a native select or a popup list alike. */
async function disciplineOptions(r: HTMLElement): Promise<{ combo: HTMLElement; names: string[] }> {
  const combo = within(r).getByRole('combobox')
  const native = within(combo).queryAllByRole('option')
  if (native.length) return { combo, names: native.map((o) => clean(o.textContent)) }
  await userEvent.click(combo)
  const lists = await screen.findAllByRole('listbox')
  const popup = lists[lists.length - 1]!
  return { combo, names: within(popup).getAllByRole('option').map((o) => clean(o.textContent)) }
}

async function choose(combo: HTMLElement, name: string) {
  if (combo instanceof HTMLSelectElement) {
    await userEvent.selectOptions(combo, name)
    return
  }
  const lists = screen.queryAllByRole('listbox')
  if (!lists.length) await userEvent.click(combo)
  const popups = await screen.findAllByRole('listbox')
  await userEvent.click(within(popups[popups.length - 1]!).getByRole('option', { name }))
}

describe('the page states (§4.5 "Page states")', () => {
  it('shows the empty Drawing Set in its words, with "Choose files"', async () => {
    const { api } = drawingSet()
    await open(api)
    const text = bodyText()
    expect(text).toContain('No drawings yet.')
    expect(text).toContain("Drop the Drawing Set's DWG files here, with the PDFs plotted from them if you have them.")
    expect(text).toContain('Vextrus reads DWG and PDF files. Scanned drawings cannot be read.')
    expect(screen.getByRole('button', { name: 'Choose files' })).toBeVisible()
    gateGreps()
  })

  it('shows the header, "Add files", the drop strip and the columns File, Discipline, Status, Sheets found', async () => {
    const { api, set } = drawingSet()
    set.files.push(file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read'), sheets_found: 8 }))
    const { keyMap } = await open(api)
    await row('KR-STR-R0.dwg')
    expect(screen.getByRole('button', { name: 'Add files' })).toBeVisible()
    expect(bodyText()).toContain('Drop DWG and PDF files here to add them, or choose files.')
    for (const column of ['File', 'Discipline', 'Status', 'Sheets found']) {
      expect(screen.getByRole('columnheader', { name: column })).toBeVisible()
    }
    expect(clean(rowOf('KR-STR-R0.dwg').textContent)).toContain('8')
    expectKeyMapSound(keyMap)
    gateGreps()
  })

  it("shows the overlay \"Drop to add to Kadam Residence's Drawing Set\" while files are dragged over", async () => {
    const { api, set } = drawingSet()
    set.files.push(file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read') }))
    await open(api)
    await row('KR-STR-R0.dwg')
    const data = new DataTransfer()
    data.items.add(dwg('KR-ARC-R0.dwg'))
    fireEvent.dragEnter(screen.getByRole('heading', { name: 'Drawing Set' }), { dataTransfer: data })
    fireEvent.dragOver(screen.getByRole('heading', { name: 'Drawing Set' }), { dataTransfer: data })
    await waitFor(() => expect(bodyText()).toContain("Drop to add to Kadam Residence's Drawing Set"))
  })
})

describe('the summary line (§4.5 "Layout"; 14\'s rulings)', () => {
  it('shows the summary the API counts, word for word, not a count of the rows', async () => {
    const { api, set } = drawingSet()
    // 14's rulings: the summary counts only files being read; the page shows the API's, never its own.
    set.summary = msg('drawings.files.summary', { files: 7, sheets: 21, reading: 1, failed: 0, held: 1, refused: 1 })
    set.files.push(
      file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read'), sheets_found: 21 }),
      file({ name: 'KR-ARC-R0.dwg', state: 'waiting', status: msg('drawings.files.waiting', { ahead: 0 }) }),
    )
    await open(api)
    await row('KR-STR-R0.dwg')
    expect(bodyText()).toContain('7 files: 21 sheets read, 1 file reading, 1 held, 1 refused')
  })
})

describe("a file's life in its words (§4.5's table)", () => {
  const cases: [string, Partial<FileOut> & Pick<FileOut, 'state' | 'status'>, string, string[]][] = [
    ['waiting, next', { state: 'waiting', status: msg('drawings.files.waiting', { ahead: 0 }) }, 'Waiting to be read (next)', ['Cancel reading']],
    ['waiting, behind two', { state: 'waiting', status: msg('drawings.files.waiting', { ahead: 2 }) }, 'Waiting to be read (2 files ahead)', ['Cancel reading']],
    ['reading a DWG', { state: 'reading', status: msg('drawings.files.reading_sheet', { position: 12, total: 38 }) }, 'Reading sheet 12 of 38', ['Cancel reading']],
    ['reading, with time left', { state: 'reading', status: msg('drawings.files.reading_sheet_left', { position: 12, total: 38, minutes: 3 }) }, 'Reading sheet 12 of 38, about 3 min left', ['Cancel reading']],
    ['reading a PDF', { name: 'KR-ARC-R0.pdf', state: 'reading', status: msg('drawings.files.reading_page', { position: 12, total: 57 }) }, 'Reading page 12 of 57', ['Cancel reading']],
    ['stopping', { state: 'stopping', status: msg('drawings.files.stopping') }, 'Stopping…', []],
    ['interrupted, retrying', { state: 'retrying', status: msg('drawings.files.retrying', { attempt: 2, tries: 3 }) }, 'Reading was interrupted. Trying again by itself (try 2 of 3).', ['Cancel reading']],
    ['cancelled', { state: 'cancelled', status: msg('drawings.files.cancelled', { actor: 'Nusrat Jahan', vextrus: 'no', cancelled_date: '2026-09-26T05:00:00Z' }) }, 'Cancelled by Nusrat Jahan, 26 Sep 2026. Nothing from it is in the sheet list.', ['Read again']],
    ['failed', { state: 'failed', status: msg('drawings.files.failed', { tries: 3 }) }, 'Could not be read after 3 tries. The file is kept.', ['Try again']],
    ['old AutoCAD', { state: 'unreadable', status: msg('drawings.files.old_version') }, 'Saved by a version of AutoCAD that Vextrus cannot read yet. Save it from AutoCAD as a 2018 DWG and add it again.', []],
    ['read, readers agree', { state: 'read', status: msg('drawings.files.read') }, 'Read. Two readers agree', ['Open in Step 1']],
    ['read, with the Bangla flag', { state: 'read', status: msg('drawings.files.read_bangla') }, 'Read. Two readers agree. 1 flag: Bangla text', ['Open in Step 1']],
    ['held', { state: 'held', status: msg('drawings.files.held') }, 'Held: the two readers disagree, so it may be misread', []],
    ['a PDF matched', { name: 'KR-ARC-R0.pdf', state: 'read', status: msg('drawings.files.plot_matched', { matched: 11, pages: 12 }) }, 'Plot: 11 of 12 pages matched', []],
    ['a PDF before its DWG', { name: 'KR-ARC-R0.pdf', state: 'read', status: msg('drawings.files.plot_waiting') }, 'Plot: waiting for its DWG. Its pages are matched when the DWG is read.', []],
    ['a refused scan', { name: 'scan.pdf', state: 'refused', status: msg('drawings.files.refused_scan') }, 'Refused: a scan, not a drawing', []],
  ]

  it.each(cases)('shows a file %s in its words, with its actions', async (_, over, words, actions) => {
    const { api, set } = drawingSet()
    const name = over.name ?? 'KR-STR-R0.dwg'
    set.files.push(file({ ...over, name }))
    await open(api)
    const r = await row(name)
    expect(clean(r.textContent)).toContain(words)
    for (const action of actions) expect(within(r).getByRole('button', { name: action })).toBeVisible()
    gateGreps()
  })

  it('offers no "Cancel reading" on a file already read', async () => {
    const { api, set } = drawingSet()
    set.files.push(file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read') }))
    await open(api)
    expect(within(await row('KR-STR-R0.dwg')).queryByRole('button', { name: 'Cancel reading' })).toBeNull()
  })
})

describe('cancel and restart (plan: "cancel and restart"; §4.5 design gate: "Cancel then Read again")', () => {
  it('cancels a reading file through its own row and shows it cancelled, then reads it again', async () => {
    const { api, set } = drawingSet()
    const reading = file({ name: 'KR-STR-R0.dwg', state: 'reading', status: msg('drawings.files.reading_drawing') })
    set.files.push(reading)
    set.afterCancel.set(reading.id, { ...reading, state: 'cancelled', status: msg('drawings.files.cancelled', { actor: 'Nusrat Jahan', vextrus: 'no', cancelled_date: '2026-09-28T06:00:00Z' }) })
    set.afterRestart.set(reading.id, { ...reading, state: 'waiting', status: msg('drawings.files.waiting', { ahead: 0 }) })
    await open(api)
    await userEvent.click(within(await row('KR-STR-R0.dwg')).getByRole('button', { name: 'Cancel reading' }))
    await waitFor(() => expect(clean(rowOf('KR-STR-R0.dwg').textContent)).toContain('Cancelled by Nusrat Jahan, 28 Sep 2026. Nothing from it is in the sheet list.'))
    expect(set.seen.map((s) => s.call)).toContain(`POST /files/${reading.id}/cancel`)
    await userEvent.click(within(rowOf('KR-STR-R0.dwg')).getByRole('button', { name: 'Read again' }))
    await waitFor(() => expect(clean(rowOf('KR-STR-R0.dwg').textContent)).toContain('Waiting to be read (next)'))
    expect(set.seen.map((s) => s.call)).toContain(`POST /files/${reading.id}/restart`)
  })

  it("shows a refused restart's reason in words", async () => {
    const { api, set } = drawingSet()
    const cancelled = file({ name: 'KR-STR-R0.dwg', state: 'cancelled', status: msg('drawings.files.cancelled_unnamed') })
    set.files.push(cancelled)
    api.failOnce((m, p) => m === 'POST' && p.endsWith('/restart'), 409, refusalOf('drawings.files.not_stopped'))
    await open(api)
    await userEvent.click(within(await row('KR-STR-R0.dwg')).getByRole('button', { name: 'Read again' }))
    await waitFor(() => expect(bodyText()).toContain("This file's reading has not stopped, so it was not started again. Its row shows where it is."))
    gateGreps()
  })
})

describe("the Discipline (plan: \"among the Market's Disciplines\"; §4.5 \"Discipline\")", () => {
  it("offers the Market's Disciplines, one name each, from the Library", async () => {
    const { api, set } = drawingSet()
    set.files.push(file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read') }))
    await open(api)
    const { names } = await disciplineOptions(await row('KR-STR-R0.dwg'))
    expect(names).toEqual(['Structural', 'Architectural', 'Electrical', 'Plumbing and sanitary', 'Fire', 'Mechanical (HVAC)', 'Lift', 'Gas'])
  })

  it('offers exactly the Library\'s Disciplines, never a list of its own', async () => {
    const { api, set } = drawingSet()
    set.disciplines = [
      { key: 'structural', labels: { en: 'Structural' } },
      { key: 'electrical', labels: { en: 'Electrical' } },
    ]
    set.files.push(file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read') }))
    await open(api)
    const { names } = await disciplineOptions(await row('KR-STR-R0.dwg'))
    expect(names).toEqual(['Structural', 'Electrical'])
  })

  it("shows an MEP file's Discipline like any other, and changes a file's Discipline by its key", async () => {
    const { api, set } = drawingSet()
    const mep = file({ name: 'KR-ELE-R0.dwg', discipline: 'electrical', state: 'read', status: msg('drawings.files.read') })
    set.files.push(mep)
    await open(api)
    const r = await row('KR-ELE-R0.dwg')
    expect(clean(r.textContent)).toContain('Read. Two readers agree')
    const { combo } = await disciplineOptions(r)
    await choose(combo, 'Plumbing and sanitary')
    await waitFor(() =>
      expect(set.seen).toContainEqual({ call: `PUT /files/${mep.id}/discipline`, body: { discipline: 'plumbing' } }),
    )
  })

  it("shows a refused Discipline change's reason in words", async () => {
    const { api, set } = drawingSet()
    const f = file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read') })
    set.files.push(f)
    api.failOnce((m, p) => m === 'PUT' && p.endsWith('/discipline'), 409, refusalOf('drawings.files.discipline_unnumbered_decided'))
    await open(api)
    const { combo } = await disciplineOptions(await row('KR-STR-R0.dwg'))
    await choose(combo, 'Architectural')
    await waitFor(() =>
      expect(bodyText()).toContain('A sheet from this file is already confirmed or left out in Step 1, so the file\'s Discipline was not changed. To change it, undo that decision in Step 1 first.'),
    )
    gateGreps()
  })
})

describe("adding files: 21a's upload and its answers (§4.5's messages)", () => {
  async function add(api: FakeApi, ...names: string[]) {
    await open(api)
    await userEvent.upload(fileInput(), names.map(dwg))
  }

  it('sends each file on its own as the multipart part "file", and shows the added file waiting', async () => {
    const { api, set } = drawingSet()
    set.files.push(file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read') }))
    await add(api, 'KR-ARC-R0.dwg', 'KR-ELE-R0.dwg')
    await waitFor(() => expect(clean(rowOf('KR-ARC-R0.dwg').textContent)).toContain('Waiting to be read (next)'))
    await row('KR-ELE-R0.dwg')
    expect(set.seen.filter((s) => s.call === 'POST /files').map((s) => s.body)).toEqual([{ file: 'KR-ARC-R0.dwg' }, { file: 'KR-ELE-R0.dwg' }])
  })

  it('says the same file again added nothing, in its words', async () => {
    const { api, set } = drawingSet()
    const here = file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read') })
    set.files.push(here)
    set.answerUpload('KR-STR-R0.dwg', 200, {
      file: here,
      outcome: 'already_here',
      message: msg('drawings.uploads.already_here', { file: 'KR-STR-R0.dwg', added_date: '2026-09-26T05:00:00Z', actor: 'Nusrat Jahan', vextrus: 'no' }),
    })
    await add(api, 'KR-STR-R0.dwg')
    await waitFor(() => expect(bodyText()).toContain('KR-STR-R0.dwg is already in this Drawing Set (added 26 Sep 2026 by Nusrat Jahan). Nothing was added.'))
    expect(document.querySelectorAll('tr, [role="row"], [role="option"]').length).toBeGreaterThan(0)
    rowOf('KR-STR-R0.dwg') // still one row
  })

  it('keeps both files of one name and different contents, with its line', async () => {
    const { api, set } = drawingSet()
    set.files.push(file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read') }))
    const second = file({ name: 'KR-STR-R0.dwg', state: 'waiting', status: msg('drawings.files.waiting', { ahead: 0 }) })
    set.answerUpload('KR-STR-R0.dwg', 201, { file: second, outcome: 'added', message: msg('drawings.uploads.same_name_kept') })
    await add(api, 'KR-STR-R0.dwg')
    await waitFor(() => expect(bodyText()).toContain('A file with this name is already here. This one is different, so both are kept.'))
  })

  it("says Vextrus's damaged copy was replaced, in its words", async () => {
    const { api, set } = drawingSet()
    const here = file({ name: 'KR-STR-R0.dwg', state: 'waiting', status: msg('drawings.files.waiting', { ahead: 0 }) })
    set.files.push(here)
    set.answerUpload('KR-STR-R0.dwg', 200, { file: here, outcome: 'replaced', message: msg('drawings.uploads.replaced_reading', { file: 'KR-STR-R0.dwg' }) })
    await add(api, 'KR-STR-R0.dwg')
    await waitFor(() =>
      expect(bodyText()).toContain("KR-STR-R0.dwg is already in this Drawing Set, but Vextrus's copy of it was missing or damaged. This one replaces that copy, and its reading starts again."),
    )
  })

  const refusals: [string, string, number, string, Record<string, string | number>, string][] = [
    ['not a DWG or PDF', 'site-plan.jpg', 415, 'drawings.uploads.not_a_drawing', { file: 'site-plan.jpg' }, 'site-plan.jpg is not a DWG or a PDF, so it was not added. Vextrus reads DWG and PDF files.'],
    ['a zip', 'drawings.zip', 415, 'drawings.uploads.zip', { file: 'drawings.zip' }, 'drawings.zip is a zip file. Unzip it and drop the DWG and PDF files inside.'],
    ['too large', 'KR-ARC-R0.dwg', 413, 'drawings.uploads.too_large', { file: 'KR-ARC-R0.dwg', megabytes: 500 }, 'KR-ARC-R0.dwg is larger than 500 MB, so it was not added. Tell Vextrus if your drawings need more.'],
    ['empty', 'KR-ARC-R0.dwg', 400, 'drawings.uploads.empty', { file: 'KR-ARC-R0.dwg' }, 'KR-ARC-R0.dwg is empty, so it was not added. Copy it again from where it was saved and add it again.'],
    ['cut short', 'KR-ARC-R0.dwg', 400, 'drawings.uploads.stopped', {}, 'Upload stopped: the connection dropped.'],
    ['not started', 'KR-ARC-R0.dwg', 503, 'takeoff.read_file.not_started', { file: 'KR-ARC-R0.dwg' }, 'KR-ARC-R0.dwg was not added: Vextrus could not start reading it just now. Add it again in a minute, and tell Vextrus if this keeps happening.'],
  ]

  it.each(refusals)('shows the refusal of a file %s in words, never its code', async (_, name, status, code, params, words) => {
    const { api, set } = drawingSet()
    set.files.push(file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read') }))
    set.answerUpload(name, status, refusalOf(code, params))
    await add(api, name)
    await waitFor(() => expect(bodyText()).toContain(words))
    gateGreps()
  })

  it('says "3 files added; 1 was already here." for several files at once', async () => {
    const { api, set } = drawingSet()
    const here = file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read') })
    set.files.push(here)
    set.answerUpload('KR-STR-R0.dwg', 200, {
      file: here,
      outcome: 'already_here',
      message: msg('drawings.uploads.already_here', { file: 'KR-STR-R0.dwg', added_date: '2026-09-26T05:00:00Z', actor: 'Nusrat Jahan', vextrus: 'no' }),
    })
    await add(api, 'KR-ARC-R0.dwg', 'KR-STR-R0.dwg', 'KR-ELE-R0.dwg', 'KR-PLB-R0.dwg')
    await waitFor(() => expect(bodyText()).toContain('3 files added; 1 was already here.'))
  })
})

describe("a file's report (§4.5 \"The report panel\"; 21a's \"not read in full\")", () => {
  function readFile(set: FakeDrawingSet, finding: FileOut['finding'] = null): FileOut {
    const f = file({ name: 'KR-ARC-R0.dwg', discipline: 'architectural', state: 'read', status: msg('drawings.files.read'), sheets_found: 8, finding })
    set.files.unshift(f)
    set.reports.set(f.id, {
      readers: [msg('drawings.reports.readers_agree')],
      sheets: [msg('drawings.reports.sheets_found', { sheets: 8, drawn: 6, layouts: 2 })],
    })
    return f
  }

  it('opens by keyboard: Tab reaches the file, Enter opens its report, Esc closes it', async () => {
    const { api, set } = drawingSet()
    readFile(set)
    set.files.push(file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read') }))
    const { keyMap } = await open(api)
    const target = await row('KR-ARC-R0.dwg')
    const rowLike = (el: Element | null) => !!el && (el === target || el.matches('tr, [role="row"], [role="option"], [role="listbox"], [role="grid"], table'))
    ;(document.activeElement as HTMLElement | null)?.blur()
    for (let i = 0; i < 60 && !rowLike(document.activeElement); i++) await userEvent.tab()
    expect(rowLike(document.activeElement), 'Tab reaches the file list').toBe(true)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).toContain('✓ Read twice, by two independent readers, and they agree. Nothing in the file was skipped.'))
    expect(bodyText()).toContain('8 sheets found: 6 laid out in the drawing, 2 on layout tabs.')
    expect(bodyText()).toContain('Architectural. Added 26 Sep 2026 by Nusrat Jahan')
    expect(screen.getByRole('button', { name: /Close/ })).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(bodyText()).not.toContain('Read twice, by two independent readers'))
    expectKeyMapSound(keyMap)
  })

  it('keeps the table at least 752 px wide with the report open at 1280', async () => {
    await page.viewport(1280, 800)
    const { api, set } = drawingSet()
    readFile(set)
    await open(api)
    await userEvent.click(await row('KR-ARC-R0.dwg'))
    await waitFor(() => expect(bodyText()).toContain('✓ Read twice'))
    const table = rowOf('KR-ARC-R0.dwg').closest('table, [role="grid"], [role="table"], [role="listbox"]') as HTMLElement
    expect(table.getBoundingClientRect().width).toBeGreaterThanOrEqual(752)
  })

  it('says a file not read in full in its words, from 21a\'s code and its limit', async () => {
    const { api, set } = drawingSet()
    const f = readFile(set, msg('takeoff.read_file.not_read_in_full', { limit: 'sheets_capped' }))
    await open(api)
    await userEvent.click(await row(f.name))
    await waitFor(() =>
      expect(bodyText()).toContain('This file holds more sheets than Vextrus lists from one file, so some of its sheets are not in the sheet list. Mark it for Vextrus so the rest can be listed.'),
    )
    gateGreps()
  })

  it('shows a refused scan\'s reason in the report, in words', async () => {
    const { api, set } = drawingSet()
    const scan = file({ name: 'scan.pdf', state: 'refused', status: msg('drawings.files.refused_scan') })
    set.files.push(scan)
    set.reports.set(scan.id, { pages: [msg('engine.pdf_report.scan')] })
    await open(api)
    await userEvent.click(await row('scan.pdf'))
    await waitFor(() =>
      expect(bodyText()).toContain(
        'This PDF is a scan: its pages are pictures, with no lines or text to read. Vextrus reads drawings, not scans. Ask the Developer or the consultant for the DWG files, or for a PDF plotted from AutoCAD.',
      ),
    )
    gateGreps()
  })
})

describe('roles (§4.5 "MD or Guest"; §1.4)', () => {
  it.each([
    ['MD', PEOPLE.md, 'Read only: MD'],
    ['Guest', PEOPLE.guest, 'Read only: Guest'],
  ])('shows the %s the files read only: the chip, no adding, no cancel, no Discipline select', async (_, who, chip) => {
    const { api, set } = drawingSet()
    set.files.push(
      file({ name: 'KR-STR-R0.dwg', state: 'reading', status: msg('drawings.files.reading_drawing') }),
      file({ name: 'KR-ARC-R0.dwg', state: 'cancelled', status: msg('drawings.files.cancelled_unnamed') }),
    )
    await open(api, who)
    const r = await row('KR-STR-R0.dwg')
    expect(screen.getByText(chip)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Add files' })).toBeNull()
    expect(bodyText()).not.toContain('Drop DWG and PDF files here')
    expect(document.querySelector('input[type="file"]')).toBeNull()
    expect(within(r).queryByRole('button', { name: 'Cancel reading' })).toBeNull()
    expect(within(rowOf('KR-ARC-R0.dwg')).queryByRole('button', { name: 'Read again' })).toBeNull()
    expect(within(r).queryByRole('combobox')).toBeNull()
    expect(clean(r.textContent)).toContain('Reading the drawing')
  })
})
