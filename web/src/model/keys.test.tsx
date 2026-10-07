/*
 * The 3D Live Model by keyboard (m0-screens §8 items 2 and 7; docs/design/m0-screens.md §2): Tab reaches the
 * canvas, arrows orbit and tilt it, + − 0 zoom and fit, Esc clears the pick, F6 lands on the canvas, the
 * storey controls take Enter; the key map stays sound and `?` lists the canvas's keys; the MD and a Guest
 * read the same view; an empty model and a refused Element say so.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page, userEvent as browserEvent } from 'vitest/browser'
import { PEOPLE, mountApp } from '@/app/testing'
import { expectKeyMapSound } from '@/ui'
import { C1_1F, C1_GF, C2_GF, seedModel } from '@/acceptance/ts16w2/model.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const canvas = async () => {
  let found: HTMLCanvasElement | null = null
  await waitFor(() => {
    found = document.querySelector('canvas')
    expect(found).not.toBeNull()
    expect(found!.dataset.view, 'the view has drawn once').toBeTruthy()
  })
  return found as unknown as HTMLCanvasElement
}
const view = (c: HTMLCanvasElement) => (c.dataset.view ?? '').split(' ').map(Number) as [number, number, number]

async function focusCanvas() {
  const c = await canvas()
  c.focus()
  expect(document.activeElement).toBe(c)
  return c
}

describe('the canvas keys', () => {
  it('orbits and tilts with the arrows, zooms with + and −, fits with 0', async () => {
    const { keyMap } = await mountApp('/p/KR-01/model', { as: PEOPLE.qs, api: seedModel().api })
    const c = await focusCanvas()
    const [az0, el0, half0] = view(c)
    await userEvent.keyboard('{ArrowLeft}')
    await waitFor(() => expect(view(c)[0]).toBeGreaterThan(az0))
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    await waitFor(() => expect(view(c)[0]).toBeLessThan(az0))
    await userEvent.keyboard('{ArrowUp}')
    await waitFor(() => expect(view(c)[1]).toBeGreaterThan(el0))
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    await waitFor(() => expect(view(c)[1]).toBeLessThan(el0))
    await userEvent.keyboard('+')
    await waitFor(() => expect(view(c)[2]).toBeLessThan(half0))
    await userEvent.keyboard('-{-}')
    await waitFor(() => expect(view(c)[2]).toBeGreaterThan(half0))
    await userEvent.keyboard('0')
    await waitFor(() => expect(view(c)).toEqual([az0, el0, half0]))
    expectKeyMapSound(keyMap)
  })

  it('leaves the view alone when focus is on a storey control, and the arrows are the page’s there', async () => {
    await mountApp('/p/KR-01/model', { as: PEOPLE.qs, api: seedModel().api })
    const c = await canvas()
    const before = view(c)
    const button = screen.getByRole('button', { name: 'GF' })
    button.focus()
    await userEvent.keyboard('{ArrowLeft}+')
    expect(view(c)).toEqual(before)
  })

  it('lists the canvas keys in ? while the canvas has focus', async () => {
    await mountApp('/p/KR-01/model', { as: PEOPLE.qs, api: seedModel().api })
    await focusCanvas()
    await userEvent.keyboard('?')
    const overlay = await screen.findByRole('dialog', { name: 'Keys' })
    const text = overlay.textContent ?? ''
    for (const word of [
      'Orbit left',
      'Orbit right',
      'Tilt up',
      'Tilt down',
      'Zoom in',
      'Zoom out',
      'Fit the Live Model',
      'Pick the next Element',
      'Pick the previous Element',
      'Clear the selection',
    ])
      expect(text).toContain(word)
    await userEvent.keyboard('{Escape}')
  })

  it('] and [ pick the next and previous element, so the keyboard reaches the inspector', async () => {
    const { api, seen } = seedModel()
    await mountApp('/p/KR-01/model', { as: PEOPLE.qs, api })
    await focusCanvas()
    await userEvent.keyboard(']')
    await waitFor(() => expect(seen.some((c) => c.endsWith(`/model/elements/${C1_GF}`))).toBe(true))
    await screen.findByText(/IfcColumn/)
    await userEvent.keyboard(']')
    await userEvent.keyboard('[[')
    await screen.findByText(/IfcColumn/)
    // Isolating 1F leaves only its own element to step to.
    await userEvent.keyboard('{Escape}')
    screen.getByRole('button', { name: '1F' }).click()
    await waitFor(() => expect(screen.getByRole('button', { name: '1F' }).getAttribute('aria-pressed')).toBe('true'))
    document.querySelector('canvas')!.focus()
    await userEvent.keyboard(']')
    await waitFor(() => expect(seen.some((c) => c.endsWith(`/model/elements/${C1_1F}`))).toBe(true))
  })

  it('Esc clears the pick and the inspector goes back to its line', async () => {
    const { api } = seedModel([C1_GF])
    await mountApp('/p/KR-01/model', { as: PEOPLE.qs, api })
    const c = await canvas()
    await browserEvent.click(c)
    await screen.findByText(/IfcColumn/)
    c.focus()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByText(/IfcColumn/)).toBeNull())
    await screen.findByText(/Click an Element/)
  })

  it('F6 lands on the canvas', async () => {
    await mountApp('/p/KR-01/model', { as: PEOPLE.qs, api: seedModel().api })
    const c = await canvas()
    let landed: Element | null = null
    for (let i = 0; i < 6 && landed !== c; i++) {
      await userEvent.keyboard('{F6}')
      landed = document.activeElement
    }
    expect(landed).toBe(c)
  })
})

describe('storey isolate by key', () => {
  it('Enter isolates a storey, Enter again shows them all', async () => {
    await mountApp('/p/KR-01/model', { as: PEOPLE.qs, api: seedModel().api })
    await canvas()
    const gf = screen.getByRole('button', { name: 'GF' })
    gf.focus()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(gf.getAttribute('aria-pressed')).toBe('true'))
    expect(screen.getByRole('button', { name: 'All storeys' }).getAttribute('aria-pressed')).toBe('false')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(gf.getAttribute('aria-pressed')).toBe('false'))
    expect(screen.getByRole('button', { name: 'All storeys' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('names the storeys top first', async () => {
    await mountApp('/p/KR-01/model', { as: PEOPLE.qs, api: seedModel().api })
    await canvas()
    const group = screen.getByRole('group', { name: 'Storeys' })
    expect(
      within(group)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['All storeys', '1F', 'GF'])
  })
})

describe('the view for everyone, and its empty and refused states', () => {
  it.each([PEOPLE.md, PEOPLE.guest])('opens for %s, with the canvas inside the left-to-right frame', async (who) => {
    await mountApp('/p/KR-01/model', { as: who, api: seedModel().api })
    const c = await canvas()
    expect(c.closest('[data-ltr-canvas]')).not.toBeNull()
  })

  it('says the model is empty when no element is drawn', async () => {
    const { api } = seedModel(['none'])
    await mountApp('/p/KR-01/model', { as: PEOPLE.qs, api })
    await screen.findByText(/has no Elements yet/)
    expect(document.querySelector('canvas')).toBeNull()
  })

  it('says why when the picked element cannot be opened, and keeps the view', async () => {
    const { api } = seedModel([C2_GF]) // the inspector answers 404 for it
    await mountApp('/p/KR-01/model', { as: PEOPLE.qs, api })
    const c = await canvas()
    await browserEvent.click(c)
    await screen.findByRole('alert')
    expect(document.querySelector('canvas')).toBe(c)
  })

  it('another Developer’s project is "Page not found"', async () => {
    await mountApp('/p/ZZ-99/model', { as: PEOPLE.qs, api: seedModel().api })
    await screen.findByText(/There is nothing at this address/)
  })
})
