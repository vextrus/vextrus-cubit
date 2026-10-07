/*
 * S16-W1's own tests on Steps 3, 4 and 6, beside the acceptance tests (which pin the brief's promises):
 * Ctrl Z, what Enter leaves to a Question, a typed level the QS gets wrong, the MD's read-only keys,
 * Esc out of the size editor, a Trace button, and the key map's soundness. On the contract's fixture.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { expectKeyMapSound } from '@/ui'
import { FakeFrame, SHEET_COLS, bodyText, clean } from '@/acceptance/ts16w1/frame.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const canvas = () => document.querySelector<HTMLElement>('[data-region="canvas"]')!
const inspector = () => document.querySelector<HTMLElement>('[data-region="inspector"]')!
const label = (text: string) => within(canvas()).getAllByText(text, { exact: false })[0]!

async function openColumns(as: string = PEOPLE.qs) {
  const api = new FakeApi()
  const frame = new FakeFrame(api)
  const app = await mountApp('/p/KR-01/takeoff/6', { as, api })
  await waitFor(() => expect(bodyText()).toContain('Ground · C1'), { timeout: 5000 })
  return { frame, ...app }
}

describe('Step 6', () => {
  it('Enter on a group with a proposal a Question holds confirms the others and not the held one', async () => {
    const api = new FakeApi()
    const frame = new FakeFrame(api)
    const held = frame.groups.columns[0]!.proposals[1]!
    held.questions = [{ code: 'engine.column.size_not_read', params: {} }]
    await mountApp('/p/KR-01/takeoff/6', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Ground · C1'), { timeout: 5000 })
    await userEvent.click(label('Ground · C1'))
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(frame.acts().length).toBe(1))
    expect(frame.acts()[0]!.proposal_ids).toEqual([frame.groups.columns[0]!.proposals[0]!.id])
  })

  it('Enter on a group held wholly by a Question posts nothing and says why', async () => {
    const { frame } = await openColumns()
    await userEvent.click(label('Ground · C2'))
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).toContain('waits for its Question'))
    expect(frame.acts()).toEqual([])
  })

  it('Ctrl Z takes the last confirmation back, with the same proposals', async () => {
    const { frame } = await openColumns()
    await userEvent.click(label('Ground · C1'))
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(frame.acts().length).toBe(1))
    await userEvent.keyboard('{Control>}z{/Control}')
    await waitFor(() => expect(frame.acts().length).toBe(2))
    const [confirm, undo] = frame.acts()
    expect(undo!.act).toBe('unconfirm')
    expect(undo!.step).toBe('columns')
    expect(undo!.proposal_ids).toEqual(confirm!.proposal_ids)
  })

  it('Esc closes the size editor without posting and gives the focus back to the row', async () => {
    const { frame } = await openColumns()
    await userEvent.click(label('Ground · C2'))
    await userEvent.keyboard('e')
    await waitFor(() => expect(inspector().querySelector('[data-size-editor]')).not.toBeNull())
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(inspector().querySelector('[data-size-editor]')).toBeNull())
    expect(frame.acts()).toEqual([])
    expect(document.activeElement?.getAttribute('data-row-key')).toBe('ground/C2')
  })

  it('refuses a size that is not above zero, under its field, and posts nothing', async () => {
    const { frame } = await openColumns()
    await userEvent.click(label('Ground · C2'))
    await userEvent.keyboard('e')
    const fields = await waitFor(() => {
      const f = [...inspector().querySelectorAll<HTMLInputElement>('[data-size-editor] input')]
      expect(f.length).toBe(2)
      return f
    })
    await userEvent.clear(fields[0]!)
    await userEvent.type(fields[0]!, '0')
    await userEvent.clear(fields[1]!)
    await userEvent.type(fields[1]!, '24{Enter}')
    await waitFor(() => expect(clean(inspector().textContent)).toContain('Type a size above zero'))
    expect(frame.acts()).toEqual([])
  })

  it('opens the sheet on the inspector’s Trace button and goes back on Space', async () => {
    const { frame } = await openColumns()
    await userEvent.click(label('Ground · C1'))
    await userEvent.click(within(inspector()).getAllByRole('button', { name: /Trace/ })[0]!)
    await waitFor(() => expect(frame.calls().some((c) => c.call === `GET /drawings/sheets/${SHEET_COLS}/render`)).toBe(true))
    await waitFor(() => expect(within(canvas()).queryAllByRole('option').length).toBe(0))
    await userEvent.keyboard(' ')
    await waitFor(() => expect(within(canvas()).queryAllByRole('option').length).toBe(2))
    expect(frame.acts()).toEqual([])
  })

  it('keeps the key map sound: no key bound twice in a scope, every key labelled', async () => {
    const { keyMap } = await openColumns()
    await userEvent.click(label('Ground · C1'))
    expectKeyMapSound(keyMap)
  })

  it('the MD sees everything and Enter, X and E change nothing, and say so', async () => {
    const { frame } = await openColumns(PEOPLE.md)
    await userEvent.click(label('Ground · C1'))
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('x')
    await userEvent.keyboard('e')
    await waitFor(() => expect(bodyText()).toContain('As MD you can look at the Takeoff but not change it.'))
    expect(frame.acts()).toEqual([])
    expect(inspector().querySelector('[data-size-editor]')).toBeNull()
  })
})

describe('Step 3', () => {
  async function openStoreys(as: string = PEOPLE.qs) {
    const api = new FakeApi()
    const frame = new FakeFrame(api)
    await mountApp('/p/KR-01/takeoff/3', { as, api })
    await waitFor(() => expect(bodyText()).toContain('Basement'), { timeout: 5000 })
    return frame
  }
  const levelField = (name: string) => within(canvas()).getByRole('textbox', { name: new RegExp(name) }) as HTMLInputElement

  it('refuses a level that is not a number, puts nothing, and says so on the field', async () => {
    const frame = await openStoreys()
    const field = levelField('1st')
    await userEvent.clear(field)
    await userEvent.type(field, 'three{Enter}')
    await waitFor(() => expect(field.getAttribute('aria-invalid')).toBe('true'))
    expect(frame.calls().some((c) => c.call === 'PUT storeys/levels')).toBe(false)
    expect(frame.acts()).toEqual([])
  })

  it('Enter in a level field puts the level and moves to the next storey’s field, and never confirms', async () => {
    const frame = await openStoreys()
    const first = levelField('1st')
    await userEvent.clear(first)
    await userEvent.type(first, '3.5{Enter}')
    await waitFor(() => expect(document.activeElement).toBe(levelField('2nd')))
    expect(frame.acts()).toEqual([])
  })

  it('names the Trace of the focused storey in the inspector', async () => {
    await openStoreys()
    await userEvent.click(within(canvas()).getAllByText('Ground')[0]!)
    await waitFor(() => expect(within(inspector()).getAllByRole('button', { name: /Trace/ }).length).toBeGreaterThan(0))
  })

  it('X leaves out the focused storey only', async () => {
    const frame = await openStoreys()
    await userEvent.click(within(canvas()).getAllByText('1st')[0]!)
    await userEvent.keyboard('x')
    await waitFor(() => expect(frame.acts().length).toBe(1))
    const first = frame.storeys.find((s) => s.name === '1st')!
    const proposal = frame.groups.storeys[0]!.proposals.find((p) => p.mark === first.name)!
    expect(frame.acts()[0]).toMatchObject({ act: 'exclude', step: 'storeys', proposal_ids: [proposal.id] })
  })

  it('adds a storey to a view’s placement with one more tick', async () => {
    const frame = await openStoreys()
    const basement = frame.storeys.find((s) => s.name === 'Basement')!
    await userEvent.click(within(canvas()).getAllByText((_, node) => !!node && clean(node.textContent).startsWith('S-03') && node.children.length === 0)[0]!)
    await userEvent.click(within(canvas()).getAllByRole('checkbox', { name: /Basement/ })[0]!)
    await waitFor(() => expect(frame.calls().some((c) => c.call.startsWith('PUT view-placements/'))).toBe(true))
    const put = frame.calls().find((c) => c.call.startsWith('PUT view-placements/'))!
    expect((put.body as { storey_ids: string[] }).storey_ids).toContain(basement.id)
  })

  it('keeps the key map sound', async () => {
    const api = new FakeApi()
    new FakeFrame(api)
    const { keyMap } = await mountApp('/p/KR-01/takeoff/3', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Basement'), { timeout: 5000 })
    expectKeyMapSound(keyMap)
  })
})

describe('Step 4', () => {
  it('shows an empty route as a sentence and a way to read, and posts nothing but the read', async () => {
    const api = new FakeApi()
    const frame = new FakeFrame(api, { empty: true })
    await mountApp('/p/KR-01/takeoff/4', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('No grid lines read yet'), { timeout: 5000 })
    await userEvent.click(within(canvas()).getByRole('button', { name: 'Read the grid' }))
    await waitFor(() => expect(frame.calls().some((c) => c.call === 'POST steps/grid/read')).toBe(true))
    expect(frame.acts()).toEqual([])
  })
})
