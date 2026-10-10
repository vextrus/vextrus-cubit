/*
 * The title-against-plans Question's title (engine.storey_titles.differs) is m0-screens §5's row,
 * verbatim (review 1 of #641, scored 55): "…do not agree with, for example S-11, which names …", no
 * comma after "example", and the singular branch in the row's form, not a colon of its own. The row
 * is read from the spec, so a change to either side fails here.
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
  const quoted = /\| "([^"]+)" Trace:/.exec(line)?.[1]
  if (quoted === undefined) throw new Error('the row quotes no title')
  return quoted
}

describe('engine.storey_titles.differs', () => {
  it('words three sheets exactly as m0-screens §5’s row', () => {
    expect(said(3)).toBe(specRow())
  })
  it('puts no comma after "for example"', () => {
    for (const n of [1, 2, 5]) expect(said(n)).not.toMatch(/for example,/)
  })
  it('words one sheet in the row’s form, no colon of its own', () => {
    expect(said(1)).toBe(
      'The title of 1 sheet names storeys its plans do not agree with, for example S-11, which names ' +
        '“3RD, 5TH & 7TH FLOOR” (1 storey in the title has no plan, and 1 storey on a plan is not in the ' +
        'title). Vextrus takes the storeys from the plans.',
    )
    expect(said(1)).not.toContain(':')
  })
  it('names a sheet known by its title as the row does a number', () => {
    expect(said(2, 'SLAB LAYOUT', 'title')).toContain('for example the sheet titled “SLAB LAYOUT”, which names')
  })
})
