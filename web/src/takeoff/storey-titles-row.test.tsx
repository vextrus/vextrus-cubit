/*
 * m0-screens §5's storey-titles row words its options and answered lines as the product ships them
 * (review 2 of #641, scored 40): the spec once promised a storey edit ("I’ll correct the plans’ storeys
 * in the list") the product does not have (S15-E3). The shipped words are rendered here and found in
 * the row, so a change to either side fails.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { activateLanguage } from '@/i18n/activate'
import { englishMessages } from '@/i18n/catalogues'
import { ENGLISH } from '@/i18n/languages'
import spec from '../../../docs/design/m0-screens.md?raw'
import { STOREY_TITLE_OPTIONS, StoreyTitlesAnswered } from './storeyTitles'

beforeAll(() => activateLanguage(ENGLISH, englishMessages()))

function words(node: ReactNode): string {
  const { container, unmount } = render(<I18nProvider i18n={i18n}><p>{node}</p></I18nProvider>)
  const said = (container.textContent ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
  unmount()
  return said
}

function row(): string {
  const line = spec.split('\n').find((l) => l.startsWith('| Sheet titles and plans name different storeys'))
  if (!line) throw new Error('m0-screens §5 has no row for the title-against-plans Question')
  return line
}

describe('the storey-titles row of m0-screens §5', () => {
  it('quotes each option as shipped', () => {
    for (const option of Object.values(STOREY_TITLE_OPTIONS)) expect(row()).toContain(`"${i18n._(option)}"`)
  })
  it('quotes each answered line as shipped', () => {
    for (const option of ['plans_right', 'title_right']) {
      expect(row()).toContain(`"${words(<StoreyTitlesAnswered tag="Q4" option={option} />)}"`)
    }
  })
  it('promises no storey edit', () => {
    expect(row()).not.toMatch(/correct (the|each) plan/)
  })
})
