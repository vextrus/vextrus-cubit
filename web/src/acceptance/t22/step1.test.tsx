/*
 * Ticket 22's acceptance tests: Step 1 on layout A, "List ⇄ Sheet" (docs/plans/M0.md "22 Step 1 screen
 * and the browser smoke test"; docs/design/m0-screens.md §4.7, §5, §6, §7's KR-01 after reading, §8),
 * at /p/KR-01/takeoff/1 through the in-memory API with 19a's Step 1 operations laid over it
 * (step1.fixture.ts). Every sentence the machine sends is a code; these pin the English the reader sees.
 *
 * Chosen by the acceptance writer (the report lists them): the Proposal's `agrees` field; a sheet row
 * is focused by a click on its number; the exclusion picker's digits are pressed with focus on a row.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { expectKeyMapSound, notationProblems } from '@/ui'
import { FakeStep1, LONGEST_TITLE } from './step1.fixture'

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
const PATH = '/p/KR-01/takeoff/1'

function kr01(code = 'KR-01', empty = false): { api: FakeApi; step1: FakeStep1 } {
  const api = new FakeApi()
  return { api, step1: new FakeStep1(api, code, empty) }
}

async function open(api: FakeApi, as: string = PEOPLE.qs, path = PATH) {
  const app = await mountApp(path, { as, api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
  return app
}

async function shows(words: string) {
  await waitFor(() => expect(bodyText()).toContain(words))
}

/** The smallest row-like element holding `text` (its number cell's words). */
function rowOf(text: string): HTMLElement {
  const rows = [...document.querySelectorAll<HTMLElement>('tr, [role="row"], [role="option"]')].filter((r) => clean(r.textContent).includes(text))
  const inner = rows.filter((r) => !rows.some((o) => o !== r && r.contains(o)))
  expect(inner, `one row for ${text}`).toHaveLength(1)
  return inner[0]!
}

async function focusRow(number: string) {
  await waitFor(() => rowOf(number))
  await userEvent.click(within(rowOf(number)).getByText(number))
}

/** m0-screens §1.1's words, §1.9's Market and currency, §1.10's Building, and raw CAD codes (§8 3, 4, 10). */
function gateGreps() {
  const text = clean(document.body.textContent)
  for (const word of ['handle', 'entity', 'entities', 'SDF', 'DXF', 'LibreDWG', 'ACadSharp', 'JSON', 'worker', 'queue', 'hash', 'tenant', 'API', 'null', 'undefined', 'NaN', 'UUID', 'Engine', 'model space', 'decoder', 'Building 1', 'Bangladesh', 'BDT', '৳']) {
    expect(text, word).not.toMatch(new RegExp(`\\b${word}\\b`))
  }
  expect(text, 'no message key').not.toMatch(/\b[a-z_]+\.[a-z_0-9]+\.[a-z_0-9]+\b/)
  for (const code of ['%%', '\\P', '\\f', '\\S', '^J', '{\\']) expect(text).not.toContain(code)
  expect(text, 'no perf readout without ?perf (§6.16)').not.toMatch(/perf:/)
  expect(notationProblems(document.body)).toEqual([])
}

describe('the list at §7’s state (§4.7, §6.2, §6.3)', () => {
  it('shows "Step 1", "Sheets" and the Count "Confirmed 0 / 24"', async () => {
    const { api } = kr01()
    const { keyMap } = await open(api)
    expect(bodyText()).toContain('Step 1')
    expect(bodyText()).toContain('Sheets')
    expect(bodyText()).toContain('Confirmed 0 / 24')
    expectKeyMapSound(keyMap)
    gateGreps()
  })

  it('groups the sheets by Discipline: Structural, then Architectural, then Electrical, each with n / N settled', async () => {
    const { api } = kr01()
    await open(api)
    const text = bodyText()
    const s = text.indexOf('Structural 13 found')
    const a = text.indexOf('Architectural 8 found')
    const e = text.indexOf('Electrical 3 found')
    expect(s, 'Structural heading').toBeGreaterThanOrEqual(0)
    expect(a).toBeGreaterThan(s)
    expect(e).toBeGreaterThan(a)
    expect(text).toContain('0 / 13 settled')
    expect(text).toContain('0 / 8 settled')
    expect(text).toContain('0 / 3 settled')
  })

  it('says "no drawing list; numbering runs A-01–A-07 without a gap" where a Discipline has none (Q4)', async () => {
    const { api } = kr01()
    await open(api)
    expect(bodyText()).toContain('Architectural 8 found; no drawing list; numbering runs A-01–A-07 without a gap')
    expect(bodyText()).toContain('Electrical 3 found; no drawing list; numbering runs E-01–E-03 without a gap')
  })

  it('names the "Disciplines not yet received" (Q6)', async () => {
    const { api } = kr01()
    await open(api)
    expect(bodyText()).toContain('Plumbing and sanitary · Fire (a building of 7 storeys or more) · Lift')
    expect(bodyText()).toContain('Each stays on its allowance until its drawings arrive.')
  })

  it('lists sheets in natural order with the revision mark from the file name ("R0, from the file name")', async () => {
    const { api } = kr01()
    await open(api)
    const text = bodyText()
    expect(text.indexOf('S-02')).toBeLessThan(text.indexOf('S-10'))
    const row = rowOf('S-02')
    expect(clean(row.textContent)).toContain('R0')
    // The revision mark is its own element holding exactly "R0", so the File column's name (KR-STR-R0.dwg) may sit in the row too.
    const mark = within(row).getByText('R0')
    const tip = clean(mark.closest('[title]')?.getAttribute('title') ?? mark.closest('[aria-describedby]')?.textContent ?? '')
    await userEvent.hover(mark)
    await waitFor(() => expect(clean(tip + ' ' + bodyText())).toContain('R0, from the file name KR-STR-R0.dwg'))
  })

  it('shows continuation sheets as one row: "E-02–E-03", "2 sheets" (Q3)', async () => {
    const { api } = kr01()
    await open(api)
    const row = rowOf('E-02–E-03')
    expect(clean(row.textContent)).toContain('2 sheets')
  })

  it('shows the one-source sheets as "Proposal, one source"', async () => {
    const { api } = kr01()
    await open(api)
    expect(clean(rowOf('E-01').textContent)).toContain('Proposal, one source')
  })

  it('shows Coverage on the status bar: "Coverage 70 views: 0 assigned, 0 excluded, 68 proposed, 2 unaccounted"', async () => {
    const { api } = kr01()
    await open(api)
    expect(bodyText()).toContain('Coverage 70 views: 0 assigned, 0 excluded, 68 proposed, 2 unaccounted')
  })

  it('orders the Questions: "Answer 5 Questions: the held file first, then those holding the most sheets"', async () => {
    const { api } = kr01()
    await open(api)
    expect(bodyText()).toContain('Answer 5 Questions: the held file first, then those holding the most sheets')
  })
})

describe('the Confirmation bar and the bulk act (§6.4, ruling 1)', () => {
  it('offers "Confirm 16, leave out 1 ↵" with nothing focused', async () => {
    const { api } = kr01()
    await open(api)
    expect(screen.getByRole('button', { name: /Confirm 16, leave out 1/ })).toBeVisible()
    expect(bodyText()).toContain('Confirm 16 sheets that agree, and leave out 1: for information')
  })

  it('confirms 16 and leaves out 1 on Enter, toasting "Confirmed 16 sheets; left out 1, each with its reason."', async () => {
    const { api, step1 } = kr01()
    await open(api)
    await userEvent.keyboard('{Enter}')
    await shows('Confirmed 16 sheets; left out 1, each with its reason.')
    await shows('Confirmed 16 / 24, 1 excluded')
    const confirmed = step1.proposals.filter((p) => p.decision === 'confirmed').map((p) => p.number)
    expect(confirmed).toHaveLength(16)
    expect(confirmed).not.toContain('E-01')
    expect(step1.proposals.find((p) => p.number === 'A-07')!.excluded_reason).toBe('for_information')
  })

  it('undoes the bulk act with Ctrl Z, naming what it undid ("Undone: confirmed 16 sheets")', async () => {
    const { api, step1 } = kr01()
    await open(api)
    await userEvent.keyboard('{Enter}')
    await shows('Confirmed 16 / 24, 1 excluded')
    await userEvent.keyboard('{Control>}z{/Control}')
    await shows('Undone: confirmed 16 sheets')
    await shows('Confirmed 0 / 24')
    expect(step1.calls()).toContain('POST /undo')
    expect(step1.proposals.every((p) => p.decision === null)).toBe(true)
  })

  it('words the refusal when nothing is left to undo', async () => {
    const { api } = kr01()
    await open(api)
    await userEvent.keyboard('{Control>}z{/Control}')
    await shows('You have nothing left to undo on Step 1')
  })
})

describe('exclusion (§6.9; Q9, U1)', () => {
  it('opens the picker on X: "Exclude S-02. Why?" and the seven reasons', async () => {
    const { api } = kr01()
    await open(api)
    await focusRow('S-02')
    await userEvent.keyboard('x')
    await shows('Exclude S-02. Why?')
    await shows('Coverage keeps the reason. Esc cancels')
    for (const reason of ['Superseded', 'Duplicate or another Discipline’s copy', 'Cover or index (its drawing list kept)', 'Presentation, 3D or for information', 'By others (not in this Estimate)', 'Blank: base plan only', 'Other']) {
      expect(bodyText().replace(/'/g, '’')).toContain(reason)
    }
  })

  it('claims every digit while the picker is open: 8, 9 and 0 do nothing', async () => {
    const { api, step1 } = kr01()
    await open(api)
    await focusRow('S-02')
    await userEvent.keyboard('x')
    await shows('Exclude S-02. Why?')
    await userEvent.keyboard('890')
    expect(step1.calls().filter((c) => c.startsWith('POST'))).toEqual([])
    expect(bodyText()).toContain('Exclude S-02. Why?')
  })

  it('excludes with 1 and toasts "S-02 excluded: superseded. It stays in the count."', async () => {
    const { api, step1 } = kr01()
    await open(api)
    await focusRow('S-02')
    await userEvent.keyboard('x')
    await shows('Exclude S-02. Why?')
    await userEvent.keyboard('1')
    await shows('S-02 excluded: superseded. It stays in the count.')
    const s02 = step1.proposals.find((p) => p.number === 'S-02')!
    expect(step1.seen.find((s) => s.call === 'POST /exclude')?.body).toMatchObject({ proposals: [s02.id], reason: 'superseded' })
    await shows('Confirmed 0 / 24, 1 excluded')
  })

  it('cancels the picker with Esc, excluding nothing', async () => {
    const { api, step1 } = kr01()
    await open(api)
    await focusRow('S-02')
    await userEvent.keyboard('x')
    await shows('Exclude S-02. Why?')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(bodyText()).not.toContain('Exclude S-02. Why?'))
    expect(step1.calls()).not.toContain('POST /exclude')
  })

  it('offers no "Assign steps" in M0 (Q10)', async () => {
    const { api } = kr01()
    await open(api)
    expect(screen.queryByRole('button', { name: /Assign/ })).toBeNull()
  })
})

describe('the drawing list, pasted or typed, shown parsed before it is used (§6.10; Q4)', () => {
  it('reads a typed range back — "Read as a range: 8 sheets, A-01 to A-08, no titles." — before anything is kept', async () => {
    const { api, step1 } = kr01()
    await open(api)
    const heading = await screen.findByText('Architectural 8 found', { exact: false })
    const section = heading.closest('section, [role="rowgroup"], [role="group"], div')!.parentElement!
    await userEvent.click(within(section).getAllByText('Paste the drawing list')[0]!)
    const dialog = await screen.findByRole('dialog', { name: 'The architectural drawing list' })
    await userEvent.type(within(dialog).getByRole('textbox'), 'A-01–A-08')
    await waitFor(() => expect(clean(dialog.textContent)).toContain('Read as a range: 8 sheets, A-01 to A-08, no titles.'))
    expect(step1.calls()).toContain('POST /drawing-list/read')
    expect(step1.calls()).not.toContain('POST /drawing-list')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Use as the drawing list' }))
    await shows('Drawing list set: 8 architectural sheets.')
    expect(step1.seen.find((s) => s.call === 'POST /drawing-list')?.body).toMatchObject({ discipline: 'architectural', text: 'A-01–A-08' })
  })

  it('counts a pasted list\'s lines: "3 sheet lines found; other lines are ignored."', async () => {
    const { api } = kr01()
    await open(api)
    const heading = await screen.findByText('Electrical 3 found', { exact: false })
    const section = heading.closest('section, [role="rowgroup"], [role="group"], div')!.parentElement!
    await userEvent.click(within(section).getAllByText('Paste the drawing list')[0]!)
    const dialog = await screen.findByRole('dialog', { name: 'The electrical drawing list' })
    await userEvent.click(within(dialog).getByRole('textbox'))
    await userEvent.paste('Transmittal 12\nE-01  LEGEND\nE-02  LIGHTING\nE-03  POWER\nRegards')
    await waitFor(() => expect(clean(dialog.textContent)).toContain('3 sheet lines found; other lines are ignored.'))
    for (const n of ['E-01', 'E-02', 'E-03']) expect(clean(dialog.textContent)).toContain(n)
  })
})

describe('progress per Discipline (§5, Q6)', () => {
  it('reads "Structural confirmed · Architectural confirmed · Electrical 3 to confirm" once two Parts are settled', async () => {
    const { api, step1 } = kr01()
    step1.settleAllBut('electrical')
    await mountApp(PATH, { as: PEOPLE.qs, api })
    await shows('Structural confirmed · Architectural confirmed · Electrical 3 to confirm')
    await shows('✓ confirmed')
  })
})

describe('List ⇄ Sheet and the sheet viewer (§6.1, §6.5; U1)', () => {
  it('opens the focused sheet on Space, with the viewer drawing its render, and Space returns to the list', async () => {
    const { api, step1 } = kr01()
    await open(api)
    await focusRow('S-02')
    await userEvent.keyboard(' ')
    const canvas = await screen.findByRole('group', { name: /Sheet\s*⁨?S-02⁩?/ })
    expect(canvas).toBeVisible()
    const s02 = step1.proposals.find((p) => p.number === 'S-02')!
    expect(step1.calls()).toContain(`GET /drawings/sheets/${s02.sheet_id}/render`)
    expect(document.activeElement && canvas.contains(document.activeElement) || document.activeElement === canvas, 'focus in the canvas').toBe(true)
    await userEvent.keyboard(' ')
    await waitFor(() => expect(screen.queryByRole('group', { name: /Sheet\s*⁨?S-02⁩?/ })).toBeNull())
    expect(rowOf('S-02').contains(document.activeElement) || rowOf('S-02') === document.activeElement, 'focus back on S-02').toBe(true)
  })

  it('does not select a row with Space (the list’s Space-to-select is off)', async () => {
    const { api } = kr01()
    await open(api)
    await focusRow('S-03')
    await userEvent.keyboard(' ')
    await screen.findByRole('group', { name: /S-03/ })
    expect(document.querySelectorAll('[aria-selected="true"][aria-multiselectable], [aria-checked="true"]').length).toBe(0)
  })
})

describe('roles (§6.12, §1.4; U4)', () => {
  it('shows the MD "Read only: MD", "You are reading this as the MD." and no Confirm', async () => {
    const { api } = kr01()
    await open(api, PEOPLE.md)
    expect(bodyText()).toContain('Read only: MD')
    expect(bodyText()).toContain('You are reading this as the MD.')
    expect(screen.queryByRole('button', { name: /Confirm 16/ })).toBeNull()
  })

  it('answers the MD’s Enter with "As MD you can look at the Takeoff but not change it." and acts on nothing', async () => {
    const { api, step1 } = kr01()
    await open(api, PEOPLE.md)
    await userEvent.keyboard('{Enter}')
    await shows('As MD you can look at the Takeoff but not change it.')
    expect(step1.calls().filter((c) => c.startsWith('POST'))).toEqual([])
  })

  it('shows a Guest "Read only: Guest", "You are reading this as a Guest." and refuses X in words', async () => {
    const { api, step1 } = kr01()
    await open(api, PEOPLE.guest)
    expect(bodyText()).toContain('Read only: Guest')
    expect(bodyText()).toContain('You are reading this as a Guest.')
    await focusRow('S-02')
    await userEvent.keyboard('x')
    await shows('As a Guest you can look at the Takeoff but not change it.')
    expect(step1.calls().filter((c) => c.startsWith('POST'))).toEqual([])
  })

  it('shows who confirmed a sheet: "Confirmed by Nusrat Jahan, 26 Sep 2026"', async () => {
    const { api, step1 } = kr01()
    step1.settleAllBut('electrical')
    await mountApp(PATH, { as: PEOPLE.md, api })
    await focusRow('S-02')
    await shows('Confirmed by Nusrat Jahan, 26 Sep 2026')
  })
})

describe('the Question card (§5, §6.7)', () => {
  it('shows Q2 with "Answer once", its title, and "Keep open, ask the consultant" last', async () => {
    const { api } = kr01()
    await open(api)
    await focusRow('S-07')
    await shows('Question Q2')
    expect(bodyText()).toContain('Answer once')
    expect(bodyText()).toContain('Two sheets are numbered S-07')
    const radios = screen.getAllByRole('radio')
    expect(clean(radios.at(-1)!.closest('label')?.textContent ?? radios.at(-1)!.getAttribute('aria-label'))).toContain('Keep open, ask the consultant')
  })
})

describe('states (§4.7, §6.13)', () => {
  it('shows SG-03 empty: "No sheets yet. Add the Drawing Set\'s files first." with a way to the Drawing Set', async () => {
    const { api } = kr01('SG-03', true)
    await mountApp('/p/SG-03/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText().replace(/’/g, "'")).toContain("No sheets yet. Add the Drawing Set's files first."))
    expect(screen.getByRole('link', { name: 'Go to the Drawing Set' })).toHaveAttribute('href', '/p/SG-03/drawing-set')
  })
})

describe('the toolbar at 1280 (§8 item 6; U7)', () => {
  it('keeps the toolbar on one line in sheet mode with the longest seeded title', async () => {
    await page.viewport(1280, 800)
    const { api } = kr01()
    await open(api)
    await focusRow('S-08')
    await userEvent.keyboard(' ')
    await screen.findByRole('group', { name: /S-08/ })
    const title = await screen.findByText(LONGEST_TITLE, { exact: false })
    const bar = title.closest('header, [role="toolbar"]') as HTMLElement
    expect(bar, 'the sheet label sits in the toolbar').not.toBeNull()
    const tops = new Set([...bar.querySelectorAll<HTMLElement>('button, [role="radio"], [role="tab"]')].filter((b) => b.offsetParent).map((b) => Math.round(b.getBoundingClientRect().top / 8)))
    expect(tops.size, 'one line').toBe(1)
  })
})
