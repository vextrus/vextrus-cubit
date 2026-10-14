/*
 * S27-G4, f-9 of session 26's G1 walk (#666): Coverage on the status bar opens its panel whichever tab the
 * inspector shows. docs/design/m0-screens.md 6.11: "**Coverage panel** (a click on it; in the inspector,
 * 4.1): "Coverage, every view on every sheet read"". 4.1: panels "that open over the canvas elsewhere
 * (Coverage, the font list) open **in the inspector** instead". The walk found the click did nothing while
 * the inspector showed its Questions tab, and worked from Selection.
 *
 * Run at /p/KR-01/takeoff/1 on t22's in-memory API (../t22/step1.fixture.ts).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '@/acceptance/t22/step1.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)
const PANEL = 'Coverage, every view on every sheet read'

/** KR-01 opened, with the inspector on its Questions tab; the status bar's Coverage. */
async function onQuestionsTab(): Promise<HTMLElement> {
  const api = new FakeApi()
  new FakeStep1(api)
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
  await userEvent.click(screen.getByRole('tab', { name: /Questions/ }))
  await waitFor(() => expect(screen.getByRole('tab', { name: /Questions/ })).toHaveAttribute('aria-selected', 'true'))
  const coverage = screen.getAllByRole('button').find((b) => clean(b.textContent).startsWith('Coverage 70 views'))
  expect(coverage, 'the status bar’s Coverage').toBeDefined()
  return coverage!
}

/** The panel's heading, shown: present and visible to the eye. */
async function panelShown() {
  await waitFor(() => {
    const shown = screen.queryAllByText(PANEL).filter((e) => e.checkVisibility())
    expect(shown, `the Coverage panel shown: "${PANEL}"`).toHaveLength(1)
  })
}

describe('Coverage on the status bar opens its panel from the Questions tab (m0-screens 6.11; f-9, #666)', () => {
  it('shows "Coverage, every view on every sheet read" when Coverage is clicked while the Questions tab is shown', async () => {
    const coverage = await onQuestionsTab()
    await userEvent.click(coverage)
    await panelShown()
  })

  it('shows the panel when Enter is pressed on Coverage while the Questions tab is shown', async () => {
    const coverage = await onQuestionsTab()
    coverage.focus()
    await userEvent.keyboard('{Enter}')
    await panelShown()
  })
})
