/*
 * The Correct act on Step 1 (takeoff.step1.corrected, read in the event log by Members and access' acts
 * panel) is the record of a storeys correction too (S24-B2): its words name the storeys beside the number
 * and title, so a QS who corrected only a plan view's storeys is not shown as having changed a number or
 * title (review 1 of #780).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const catalogue = readFileSync(
  fileURLToPath(new URL('../messages/takeoff/step1/en.po', import.meta.url)),
  'utf8',
)

function english(code: string): string | undefined {
  const found = new RegExp(`msgid "${code.replace(/\./g, '\\.')}"\\nmsgstr "(.*)"`).exec(catalogue)
  return found?.[1]
}

describe('the Correct act in the event log', () => {
  it('names a sheet’s number, title or storeys', () => {
    expect(english('takeoff.step1.corrected')).toBe('{actor} corrected a sheet’s number, title or storeys on Step 1')
  })
})
