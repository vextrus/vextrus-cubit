/*
 * A calendar day the API sends as an ISO date (a sheet's issue date, the design gate's M1): "12 Sep
 * 2026" in every browser zone, since a day is not an instant; and nothing but ISO is read, so a
 * title block's "12.09.2026" can never come out as 9 Dec (the browser's month-first guess).
 */
import { describe, expect, it } from 'vitest'
import { i18n } from '@lingui/core'
import { BANGLADESH } from '@/app/seed/demo.fixture'
import { activateLanguage } from '@/i18n/activate'
import { englishMessages } from '@/i18n/catalogues'
import { ENGLISH } from '@/i18n/languages'
import { createFormat } from './Format'
import { formatDay } from './dates'

const month = (index: number) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][index]!

describe('a calendar day (f.day)', () => {
  it('shows the ISO date the API sends in 1.2’s form, whatever the browser’s zone', () => {
    expect(formatDay('2026-09-12', BANGLADESH, month)).toBe('12 Sep 2026')
    expect(formatDay('2026-01-01', BANGLADESH, month)).toBe('1 Jan 2026')
    activateLanguage(ENGLISH, englishMessages())
    expect(createFormat(BANGLADESH, BANGLADESH.unitSystems.default, i18n).day('2026-09-12')).toBe('12 Sep 2026')
  })

  it('reads nothing but an ISO date: a drawing’s own writing, an instant or no day at all is empty', () => {
    for (const written of ['12.09.2026', '12/09/2026', '2026-09-12T00:00:00Z', '2026-02-31', '', null, undefined]) {
      expect(formatDay(written, BANGLADESH, month)).toBe('—')
    }
  })
})
