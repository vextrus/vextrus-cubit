/*
 * A same storey Question's title (engine.conflicts.same_storey) names only the sheets it holds (review
 * 1 of #638): two or more held name the first two; one held names it alone, beside a sheet already
 * decided, never as "S-41 and S-44 both draw" over a Question holding S-47.
 */
import { setupI18n } from '@lingui/core'
import { describe, expect, it } from 'vitest'
import { englishMessages } from '@/i18n/catalogues'

const i18n = setupI18n({ locale: 'en', messages: { en: englishMessages() } })
const said = (sheets: number, first: string, second: string) =>
  i18n._('engine.conflicts.same_storey', {
    sheets, first, first_named: 'number', second, second_named: 'number',
    plan: '3RD FLOOR SLAB PLAN', other: '', titled: 'same', layer: 'none',
  })

describe('engine.conflicts.same_storey', () => {
  it('names the first two of three held sheets and counts the rest', () => {
    expect(said(3, 'S-41', 'S-44')).toBe('S-41, S-44 and 1 more sheet draw “3RD FLOOR SLAB PLAN”')
  })
  it('names the two held sheets', () => {
    expect(said(2, 'S-44', 'S-47')).toBe('S-44 and S-47 both draw “3RD FLOOR SLAB PLAN”')
  })
  it('names one held sheet alone, like a sheet already decided', () => {
    const words = said(1, 'S-47', 'S-41')
    expect(words).toBe('S-47 draws “3RD FLOOR SLAB PLAN”, like a sheet already decided')
    expect(words).not.toContain('S-41')
  })
})
