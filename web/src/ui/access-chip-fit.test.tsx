/*
 * The AccessChip's end date is never cut (design gate 20a r1, must 3): given the room it has, the chip
 * names the projects, counts them, or says only the date, and never shows a cut sentence while a
 * shorter form would fit. The tooltip always says it all.
 */
import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { page } from 'vitest/browser'
import { I18nRoot } from '@/i18n/I18nRoot'
import { AccessChip, type AccessChipProps } from './AccessChip'
import { TooltipProvider } from './primitives/tooltip'

const plain = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩]/g, '').replace(/\s+/g, ' ').trim()

const ENGINEER: AccessChipProps = { vextrus: true, developer: 'Shapla Homes Ltd', projects: ['GT-09', 'KR-01'], until: '5 Nov 2026', daysLeft: 37 }

/** The chip in a flex row that gives it `room` px, as the top bar does. */
function inRoom(room: number, props: AccessChipProps = ENGINEER) {
  return render(
    <I18nRoot>
      <TooltipProvider>
        <div style={{ display: 'flex', width: room }}>
          <div className="flex min-w-0 flex-1">
            <AccessChip {...props} />
          </div>
        </div>
      </TooltipProvider>
    </I18nRoot>,
  )
}

/** The chip's words, and whether any of them is cut. */
function chipNow() {
  const chip = screen.getByTestId('access-chip')
  const words = chip.querySelector('.truncate') as HTMLElement
  return { text: plain(chip.textContent), cut: words.scrollWidth > words.clientWidth + 0.5 }
}

describe('the AccessChip in the room it has (m0-screens §3)', () => {
  it('names the projects and the date when the whole sentence fits', async () => {
    await page.viewport(1440, 900)
    inRoom(700)
    await waitFor(() => expect(chipNow()).toEqual({ text: 'Vextrus access to GT-09 and KR-01 at Shapla Homes Ltd until 5 Nov 2026', cut: false }))
  })

  it('counts the projects, keeping the date, when naming them does not fit', async () => {
    await page.viewport(1440, 900)
    inRoom(405)
    await waitFor(() => expect(chipNow()).toEqual({ text: 'Vextrus access to 2 projects at Shapla Homes Ltd until 5 Nov 2026', cut: false }))
  })

  it('says only the date when nothing longer fits, the rest in its tooltip', async () => {
    await page.viewport(1440, 900)
    inRoom(260)
    await waitFor(() => expect(chipNow()).toEqual({ text: 'Vextrus access until 5 Nov 2026', cut: false }))
  })

  it('says only the date for anyone else, too, and for access to every project', async () => {
    await page.viewport(1440, 900)
    inRoom(200, { vextrus: false, developer: 'Shapla Homes Ltd', projects: 'all', until: '26 Oct 2026', daysLeft: 28 })
    await waitFor(() => expect(chipNow()).toEqual({ text: 'Access until 26 Oct 2026', cut: false }))
  })

  it('grows back to the whole sentence when the room grows', async () => {
    await page.viewport(1440, 900)
    const view = inRoom(260)
    await waitFor(() => expect(chipNow().text).toBe('Vextrus access until 5 Nov 2026'))
    const row = view.container.querySelector('div[style]') as HTMLElement
    row.style.width = '700px'
    await waitFor(() => expect(chipNow()).toEqual({ text: 'Vextrus access to GT-09 and KR-01 at Shapla Homes Ltd until 5 Nov 2026', cut: false }))
  })
})
