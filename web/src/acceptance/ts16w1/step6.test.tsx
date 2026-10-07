/*
 * Ticket S16-W1's acceptance test, Step 6 (Columns) at `/p/$code/takeoff/6`, on session 16's contract
 * fixture. The brief's showing script: "columns grouped by band and mark, Enter confirms the agreeing,
 * E types a size, X excludes, 'shear walls and core on allowance'". Keys go through the key map
 * (m0-screens §2): typing wins in a field, so X typed in the size editor excludes nothing.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { waitFor, within } from '@testing-library/react'
import testingUserEvent from '@testing-library/user-event'
import { page, userEvent as realKeys } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeFrame, bodyText, namedIds } from './frame.fixture'

const userEvent = testingUserEvent

beforeEach(async () => {
  await page.viewport(1440, 900)
})

async function open() {
  const api = new FakeApi()
  const frame = new FakeFrame(api)
  await mountApp('/p/KR-01/takeoff/6', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain('Ground · C1'), { timeout: 5000 })
  return frame
}

const canvas = () => document.querySelector<HTMLElement>('[data-region="canvas"]')!
const groupLabel = (label: string) => within(canvas()).getAllByText(label, { exact: false })[0]!

describe('Step 6, columns', () => {
  it('groups the columns by band and mark, as the server groups them', async () => {
    const frame = await open()
    expect(frame.calls().some((c) => c.call.startsWith('GET steps/columns/proposals'))).toBe(true)
    expect(groupLabel('Ground · C1')).toBeDefined()
    expect(groupLabel('Ground · C2')).toBeDefined()
  })

  it('says "shear walls and core on allowance"', async () => {
    await open()
    expect(bodyText()).toContain('shear walls and core on allowance')
  })

  it('Enter confirms the focused group’s agreeing proposals', async () => {
    const frame = await open()
    await userEvent.click(groupLabel('Ground · C1'))
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(frame.acts().length).toBeGreaterThan(0))
    const act = frame.acts()[0]!
    expect(act.act).toBe('confirm')
    expect(act.step).toBe('columns')
    expect(namedIds(act, frame.groups.columns)).toEqual(frame.groups.columns[0]!.proposals.map((p) => p.id).sort())
  })

  it('X excludes the focused group', async () => {
    const frame = await open()
    await userEvent.click(groupLabel('Ground · C1'))
    await userEvent.keyboard('x')
    // An exclusion may ask its reason first; the first offered reason is taken.
    await waitFor(
      async () => {
        if (!frame.acts().length) {
          const reason = document.querySelector<HTMLElement>('[role="dialog"] [role="radio"], [role="dialog"] [role="option"], [role="menu"] [role="menuitem"], [role="menu"] [role="menuitemradio"]')
          if (reason) {
            await userEvent.click(reason)
            await userEvent.keyboard('{Enter}')
          }
        }
        expect(frame.acts().length).toBeGreaterThan(0)
      },
      { timeout: 5000 },
    )
    const act = frame.acts()[0]!
    expect(act.act).toBe('exclude')
    expect(act.step).toBe('columns')
    expect(namedIds(act, frame.groups.columns)).toEqual(frame.groups.columns[0]!.proposals.map((p) => p.id).sort())
  })

  it('E opens a size editor whose Enter posts edit with section_b and section_d', async () => {
    const frame = await open()
    await userEvent.click(groupLabel('Ground · C2'))
    await userEvent.keyboard('e')
    const fields = await waitFor(() => {
      const inputs = [...document.querySelectorAll<HTMLInputElement>('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])')].filter((i) => !i.disabled && i.offsetParent !== null)
      expect(inputs.length, 'the size editor’s two fields').toBeGreaterThanOrEqual(2)
      return inputs
    })
    await userEvent.clear(fields[0]!)
    await userEvent.type(fields[0]!, '12')
    await userEvent.clear(fields[1]!)
    await userEvent.type(fields[1]!, '24{Enter}')
    await waitFor(() => expect(frame.acts().length).toBeGreaterThan(0))
    const act = frame.acts()[0]!
    expect(act.act).toBe('edit')
    expect(act.step).toBe('columns')
    expect(namedIds(act, frame.groups.columns)).toEqual(frame.groups.columns[1]!.proposals.map((p) => p.id).sort())
    expect(Number(act.values?.section_b)).toBe(12)
    expect(Number(act.values?.section_d)).toBe(24)
  })

  it('X typed in the size editor types, and excludes nothing', async () => {
    const frame = await open()
    await userEvent.click(groupLabel('Ground · C2'))
    await userEvent.keyboard('e')
    const field = await waitFor(() => {
      const el = document.activeElement
      expect(el instanceof HTMLInputElement, 'E puts focus in the size editor').toBe(true)
      return el as HTMLInputElement
    })
    await userEvent.type(field, 'x')
    expect(frame.acts().filter((a) => a.act === 'exclude')).toEqual([])
  })

  it('keeps focus visible on the list as the arrow keys move it', async () => {
    await open()
    await userEvent.click(groupLabel('Ground · C1'))
    await realKeys.keyboard('{ArrowDown}')
    const el = document.activeElement as HTMLElement | null
    expect(el && el !== document.body && canvas().contains(el), 'focus is on the list').toBe(true)
    const style = getComputedStyle(el!)
    const ring = (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none'
    expect(ring, `a visible focus ring (outline ${style.outlineStyle} ${style.outlineWidth}, shadow ${style.boxShadow})`).toBe(true)
  })

  it('with nothing read, shows no rows and posts nothing on Enter', async () => {
    const api = new FakeApi()
    const frame = new FakeFrame(api, { empty: true })
    await mountApp('/p/KR-01/takeoff/6', { as: PEOPLE.qs, api })
    await waitFor(() => expect(frame.calls().some((c) => c.call.startsWith('GET steps/columns/proposals')), 'the screen reads the column proposals').toBe(true), { timeout: 5000 })
    await userEvent.keyboard('{Enter}')
    expect(frame.acts()).toEqual([])
    expect(within(canvas()).queryAllByRole('row').length + within(canvas()).queryAllByRole('option').length, 'no rows').toBe(0)
  })
})
