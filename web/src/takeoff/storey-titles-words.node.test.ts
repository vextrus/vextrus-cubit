/*
 * The title-against-plans Question's title (engine.storey_titles.differs) is m0-screens §5's row,
 * verbatim (review 1 of #641, scored 55): "…do not agree with, for example S-11, which names …", no
 * comma after "example"; one sheet "namely" (review 2 of #641: never "for example" over one sheet), as
 * the row's one-sheet form. The row is read from the spec, so a change to either side fails here.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setupI18n } from '@lingui/core'
import { describe, expect, it } from 'vitest'
import { englishMessages } from '@/i18n/catalogues'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const i18n = setupI18n({ locale: 'en', messages: { en: englishMessages() } })

const said = (count: number, sheet = 'S-11', named = 'number') =>
  i18n._('engine.storey_titles.differs', {
    discipline: 'structural', count, sheet, named,
    stated: '3RD, 5TH & 7TH FLOOR', not_drawn: 1, not_named: 1,
  })

function specRow(): string {
  const spec = readFileSync(join(ROOT, 'docs', 'design', 'm0-screens.md'), 'utf8')
  const line = spec.split('\n').find((l) => l.startsWith('| Sheet titles and plans name different storeys'))
  if (!line) throw new Error('m0-screens §5 has no row for the title-against-plans Question')
  return line
}

/** The row's title for 3 sheets, and for one ("(one sheet: "…")"), as quoted. */
function specTitles(): { many: string; one: string } {
  const row = specRow()
  const many = /\| "([^"]+)"/.exec(row)?.[1]
  const one = /\(one sheet: "([^"]+)"\)/.exec(row)?.[1]
  if (many === undefined || one === undefined) throw new Error('the row quotes no title for 3 sheets and for one')
  return { many, one }
}

describe('engine.storey_titles.differs', () => {
  it('words three sheets exactly as m0-screens §5’s row', () => {
    expect(said(3)).toBe(specTitles().many)
  })
  it('words one sheet exactly as the row’s one-sheet form: "namely", never "for example" over one sheet', () => {
    expect(said(1)).toBe(specTitles().one)
    expect(said(1)).not.toContain('for example')
    expect(said(1)).toContain('agree with, namely S-11, which names')
  })
  it('puts no comma after "for example" or "namely"', () => {
    for (const n of [1, 2, 5]) expect(said(n)).not.toMatch(/(for example|namely),/)
  })
  it('names a sheet known by its title as the row does a number', () => {
    expect(said(2, 'SLAB LAYOUT', 'title')).toContain('for example the sheet titled “SLAB LAYOUT”, which names')
    expect(said(1, 'SLAB LAYOUT', 'title')).toContain('namely the sheet titled “SLAB LAYOUT”, which names')
  })
})
