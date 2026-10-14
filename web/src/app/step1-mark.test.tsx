/*
 * S27-G4 (#833), ruling 1: Step 1 is confirmed by one rule, m0-screens 6.11's: every sheet confirmed or
 * excluded AND Coverage with no view unaccounted. The toolbar's Count and the rail's mark both follow it,
 * so a settled set with one view unaccounted draws neither the toolbar's ✓ nor the rail's "Confirmed" mark.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { waitFor } from '@testing-library/react'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '@/acceptance/t22/step1.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏⁠]/g, '').replace(/\s+/g, ' ').trim()
const toolbar = () => document.querySelector<HTMLElement>('[role="toolbar"][aria-label="The step\'s tools"]')
const rail = () => document.querySelector<HTMLElement>('[data-region="rail"]')
const marks = (el: Element | null) => (el ? el.querySelectorAll('svg.text-confirmed').length : -1)

async function settled(unaccounted: number) {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  step1.settleAllBut('no discipline')
  step1.coverage = { ...step1.coverage, unaccounted }
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(clean(toolbar()?.textContent)).toMatch(/Confirmed 22 \/ 24, 2 excluded/))
  await waitFor(() => expect(clean(document.body.textContent)).toMatch(/Coverage 70 views/))
}

describe('Step 1 confirmed by 6.11’s rule on the toolbar and the rail (S27-G4, #833)', () => {
  it('draws the confirmed mark on both when no view is unaccounted', async () => {
    await settled(0)
    await waitFor(() => expect(marks(toolbar())).toBe(1))
    expect(marks(rail())).toBe(1)
  })

  it('draws it on neither while a view is unaccounted, though every sheet is confirmed or excluded', async () => {
    await settled(1)
    expect(marks(toolbar())).toBe(0)
    expect(marks(rail())).toBe(0)
  })
})
