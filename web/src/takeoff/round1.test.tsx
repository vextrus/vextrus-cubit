/*
 * Ticket 22's review round 1 (design gate walk 2's musts): M12 the storeys a title states when the API
 * sent no keys; M13 a Structural legend goes to Step 2; M15 a sheet a Question holds is not "one
 * source"; M16 a click anywhere in a row focuses it; M17 Space works wherever focus lands on the
 * canvas; and 6.2's File column from a list 1000 px wide.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeStep1 } from '@/acceptance/t22/step1.fixture'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'

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

async function open(step1Setup?: (step1: FakeStep1) => void) {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  step1Setup?.(step1)
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
  return step1
}

function rowOf(text: string): HTMLElement {
  const rows = [...document.querySelectorAll<HTMLElement>('[role="row"]')].filter((r) => clean(r.textContent).includes(text))
  const inner = rows.filter((r) => !rows.some((o) => o !== r && r.contains(o)))
  expect(inner, `one row for ${text}`).toHaveLength(1)
  return inner[0]!
}

const inspector = () => screen.getByRole('complementary')
const plan = (id: string, over: Record<string, unknown> = {}) => ({ id, ordinal: 1, kind: 'plan', title: 'PLAN', stated_scale: '1:100', not_to_scale: false, storeys: [], storeys_as_stated: '', storeys_meaning: null, steps: [], part: null, proposed_exclusion: null, decision: null, excluded_reason: null, box: ['10', '10', '60', '50'], ...over })

describe('M12: the storeys a title states, when the API sent no keys', () => {
  it('shows "3rd, 5th, 7th", "typical (range from Step 3)" and "1st", never "not stated" beside a stated title', async () => {
    await open((step1) => {
      Object.assign(step1.proposals.find((p) => p.number === 'S-06')!, { storeys_as_stated: '3RD, 5TH & 7TH FLOOR', views: [plan('a')] })
      Object.assign(step1.proposals.find((p) => p.number === 'S-05')!, { storeys_as_stated: '', views: [plan('b', { storeys: ['not_stated'], storeys_as_stated: '1ST FLOOR' })] })
      Object.assign(step1.proposals.find((p) => p.number === 'S-04')!, { storeys_as_stated: 'GROUND FLOOR', views: [plan('c')] })
      Object.assign(step1.proposals.find((p) => p.number === 'S-08')!, { storeys_as_stated: 'PILE CAP TO 2ND FLOOR', views: [plan('d')] })
      for (const p of step1.proposals.filter((p) => p.number === 'S-07')) Object.assign(p, { storeys_as_stated: 'TYPICAL FLOOR', views: [plan(`e${p.revision_mark}`)] })
      Object.assign(step1.proposals.find((p) => p.number === 'S-03')!, { storeys_as_stated: '', views: [plan('f')] })
    })
    expect(clean(rowOf('S-06').textContent)).toContain('3rd, 5th, 7th')
    expect(clean(rowOf('S-06').textContent)).not.toContain('not stated')
    expect(clean(rowOf('S-05').textContent)).toContain('1st')
    expect(clean(rowOf('S-05').textContent)).not.toContain('not stated')
    expect(clean(rowOf('S-04').textContent)).toContain('Ground')
    expect(clean(rowOf('S-08').textContent)).toContain('Pile cap to 2nd')
    expect(clean(rowOf('S-07').textContent)).toContain('typical (range from Step 3)')
    // With neither keys nor stated words, the plan says so.
    expect(clean(rowOf('S-03').textContent)).toContain('not stated')
  })
})

describe('M13: a Structural or Architectural legend goes to Step 2', () => {
  it('reads "2 Notes" for S-01’s legend, and keeps "M3 onwards" for an MEP Part', async () => {
    await open((step1) => {
      Object.assign(step1.proposals.find((p) => p.number === 'S-01')!, { views: [plan('g', { kind: 'legend', part: 'structural' })] })
      Object.assign(step1.proposals.find((p) => p.number === 'E-01')!, { views: [plan('h', { kind: 'legend', part: 'electrical' })] })
    })
    await userEvent.click(within(rowOf('S-01')).getByText('S-01'))
    await waitFor(() => expect(clean(inspector().textContent)).toContain('2 Notes'))
    expect(clean(inspector().textContent)).not.toContain('Structural, M3 onwards')
    await userEvent.click(within(rowOf('E-01')).getByText('E-01'))
    await waitFor(() => expect(clean(inspector().textContent)).toContain('Electrical, M3 onwards'))
  })
})

describe('M15: a sheet an open Question holds', () => {
  it('says "held by Question Q4" for A-05, never "one source"', async () => {
    await open()
    await userEvent.click(within(rowOf('A-05')).getByText('A-05'))
    await waitFor(() => expect(clean(inspector().textContent)).toMatch(/Sources\s*held by Question Q\d/))
    expect(clean(inspector().textContent)).not.toMatch(/Sources\s*one source/)
  })
})

describe('M16: a click anywhere in a row focuses it', () => {
  it('opens S-04 with Space after a click on its Discipline cell, and S-06 after one on its Revision cell', async () => {
    await open()
    await userEvent.click(within(rowOf('S-04')).getByText('Structural'))
    expect((document.activeElement as HTMLElement).getAttribute('data-row')).toBe(rowOf('S-04').getAttribute('data-row'))
    await userEvent.keyboard(' ')
    await screen.findByRole('group', { name: /S-04/ })
    await userEvent.keyboard(' ')
    await waitFor(() => rowOf('S-06'))
    const revision = within(rowOf('S-06')).getAllByRole('gridcell')[4]!
    await userEvent.click(revision.firstElementChild as HTMLElement)
    await userEvent.keyboard(' ')
    await screen.findByRole('group', { name: /S-06/ })
  })
})

describe('M17: Space wherever focus lands on the canvas', () => {
  it('goes back to the list from the canvas area F6 lands on, and after the sheet picker closes', async () => {
    await open()
    await userEvent.click(within(rowOf('S-04')).getByText('S-04'))
    await userEvent.keyboard(' ')
    await screen.findByRole('group', { name: /S-04/ })
    // The sheet picker, closed by Esc: focus is back on the sheet, where Space goes back to the list.
    await userEvent.keyboard('s')
    await screen.findByRole('dialog', { name: /Sheets, in list order/ }).catch(() => screen.findByLabelText(/Sheets, in list order/))
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(document.activeElement?.closest('[data-key-region]')).not.toBeNull())
    await userEvent.keyboard(' ')
    await waitFor(() => rowOf('S-04'))
    // The frame's canvas area itself (where F6 lands): focus goes on in, and Space opens the row.
    await userEvent.keyboard(' ')
    await screen.findByRole('group', { name: /S-04/ })
    document.querySelector<HTMLElement>('[data-region="canvas"]')!.focus()
    await waitFor(() => expect(document.activeElement?.closest('[data-key-region]')).not.toBeNull())
    await userEvent.keyboard(' ')
    await waitFor(() => rowOf('S-04'))
  })
})

describe('6.2’s File column', () => {
  it('names each row’s file from a list 1000 px wide, with where in it as the tooltip', async () => {
    await open((step1) => Object.assign(step1.proposals.find((p) => p.number === 'S-05')!, { layout: null }))
    expect(screen.getAllByRole('columnheader').map((h) => clean(h.textContent))).toContain('File')
    expect(within(rowOf('S-05')).getByText('KR-STR-R0.dwg')).toBeVisible()
  })

  it('leaves it out on a narrower list', async () => {
    await page.viewport(1280, 800)
    await open()
    expect(screen.getAllByRole('columnheader').map((h) => clean(h.textContent))).not.toContain('File')
    const header = screen.getAllByRole('columnheader', { hidden: true }).find((h) => clean(h.textContent) === 'File')
    expect(header).not.toBeVisible()
  })
})
