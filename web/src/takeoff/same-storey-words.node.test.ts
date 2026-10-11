/*
 * A same storey Question's title (engine.conflicts.same_storey) names only the sheets it holds (reviews
 * 1 and 3 of #638): two or more held name the first two; one held names it, like the sheet confirmed
 * or left out that the evidence names, never as "S-41 and S-44 both draw" over a Question holding
 * S-47. The product's words: "confirmed or left out", never "decided" (CONTEXT.md). Held sheets that lie
 * at one place (the copies of a number) are named once, like the sheet confirmed at another (`alone`).
 */
import { setupI18n } from '@lingui/core'
import { describe, expect, it } from 'vitest'
import { englishMessages } from '@/i18n/catalogues'

const i18n = setupI18n({ locale: 'en', messages: { en: englishMessages() } })
const said = (
  sheets: number,
  first: string,
  second: string,
  second_named = 'number',
  alone: string | undefined = undefined,
) =>
  i18n._('engine.conflicts.same_storey', {
    sheets, first, first_named: 'number', second, second_named,
    plan: '3RD FLOOR SLAB PLAN', other: '', titled: 'same', layer: 'none',
    ...(alone === undefined ? {} : { alone }),
  })

describe('engine.conflicts.same_storey', () => {
  it('names the first two of three held sheets and counts the rest', () => {
    expect(said(3, 'S-41', 'S-44')).toBe('S-41, S-44 and 1 more sheet draw “3RD FLOOR SLAB PLAN”')
  })
  it('names the two held sheets', () => {
    expect(said(2, 'S-44', 'S-47')).toBe('S-44 and S-47 both draw “3RD FLOOR SLAB PLAN”')
  })
  it('names one held sheet, like the sheet already confirmed or left out', () => {
    expect(said(1, 'S-47', 'S-41')).toBe(
      'S-47 draws “3RD FLOOR SLAB PLAN”, like S-41, already confirmed or left out',
    )
    expect(said(1, 'S-47', 'SLAB LAYOUT', 'title')).toBe(
      'S-47 draws “3RD FLOOR SLAB PLAN”, like the sheet titled “SLAB LAYOUT”, already confirmed or left out',
    )
    expect(said(1, 'S-47', '', 'none')).toBe(
      'S-47 draws “3RD FLOOR SLAB PLAN”, like a sheet already confirmed or left out',
    )
  })
})

describe('engine.conflicts.same_storey, the sheets held at one place (review 1 of #641)', () => {
  it('names the copies of S-41 once, like S-44 confirmed, however many it holds', () => {
    for (const n of [1, 2, 3]) {
      expect(said(n, 'S-41', 'S-44', 'number', 'yes')).toBe(
        'S-41 draws “3RD FLOOR SLAB PLAN”, like S-44, already confirmed or left out',
      )
    }
  })
  it('names two places as before', () => {
    expect(said(2, 'S-44', 'S-47', 'number', 'no')).toBe('S-44 and S-47 both draw “3RD FLOOR SLAB PLAN”')
    expect(said(1, 'S-47', 'S-41', 'number', 'no')).toBe(
      'S-47 draws “3RD FLOOR SLAB PLAN”, like S-41, already confirmed or left out',
    )
  })
  it('words a Question stored before `alone` as it was worded then', () => {
    expect(said(2, 'S-44', 'S-47')).toBe('S-44 and S-47 both draw “3RD FLOOR SLAB PLAN”')
    expect(said(1, 'S-47', 'S-41')).toBe(
      'S-47 draws “3RD FLOOR SLAB PLAN”, like S-41, already confirmed or left out',
    )
  })
})

describe('engine.conflicts.same_title', () => {
  const titled = (sheets: number) => i18n._('engine.conflicts.same_title', { title: 'NOTES', sheets })
  it('says the sheets may draw the same thing, never that nothing tells them apart', () => {
    expect(titled(2)).toBe('Two sheets are titled “NOTES” and may draw the same thing')
    expect(titled(3)).toBe('3 sheets are titled “NOTES” and may draw the same thing')
    expect(titled(1)).toBe(
      'One sheet is titled “NOTES” like a sheet already confirmed or left out, and may draw the same thing',
    )
    for (const n of [1, 2, 3]) expect(titled(n)).not.toMatch(/tells them|decided/)
  })
})
