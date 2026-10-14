/*
 * S27-G4 fix round 1 (finding 3 of review r1, #667): a one-source sheet whose number the QS typed and whose title
 * was read from its view says so; the bar never claims that title came from its title block.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { activateLanguage } from '@/i18n/activate'
import { englishMessages } from '@/i18n/catalogues'
import { ENGLISH } from '@/i18n/languages'
import { OneSourceWhat } from './Bar'
import type { ProposalOut } from './data'

beforeAll(() => activateLanguage(ENGLISH, englishMessages()))

const said = (sheet: Partial<ProposalOut>) => {
  const { container, unmount } = render(
    <I18nProvider i18n={i18n}>
      <p>
        <OneSourceWhat sheet={sheet as ProposalOut} name="E-01" />
      </p>
    </I18nProvider>,
  )
  const text = (container.textContent ?? '').replace(/\s+/g, ' ').trim()
  unmount()
  return text
}

describe('the bar names the title’s real source beside a typed number (#667)', () => {
  it('a typed number and a title from its view', () => {
    const text = said({ number: 'E-01', title: 'ELECTRICAL LEGEND', number_source: 'typed', title_source: 'view_title' })
    expect(text).toContain('its number as you typed it')
    expect(text).toContain('the title of its view')
    expect(text).not.toMatch(/title block/)
  })

  it('still says "from its title block" where the title is read from it', () => {
    expect(said({ number: 'E-01', title: 'X', number_source: 'typed', title_source: 'title_block_attribute' })).toContain('its title from its title block')
  })
})
