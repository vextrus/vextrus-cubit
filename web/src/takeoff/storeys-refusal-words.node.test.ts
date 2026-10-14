/*
 * A storeys correction refused for a view the form sent wrongly (S24-B2, the design gate of #811): the
 * words end with an act the QS can take in the form they are in, never "reload and try again", which
 * reopens nothing.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const catalogue = readFileSync(
  fileURLToPath(new URL('../messages/drawings/sheets/en.po', import.meta.url)),
  'utf8',
)

function english(code: string): string | undefined {
  const found = new RegExp(`msgid "${code.replace(/\./g, '\\.')}"\\nmsgstr "(.*)"`).exec(catalogue)
  return found?.[1]
}

describe('a refused storeys correction', () => {
  it.each(['storeys_view_unknown', 'storeys_not_a_plan', 'storeys_view_twice'])('%s ends with the act the QS can take', (code) => {
    expect(english(`drawings.sheets.${code}`)).toMatch(/, so nothing was changed\. Cancel the correction and open it again with E\.$/)
  })
})
