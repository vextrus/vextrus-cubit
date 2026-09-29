/*
 * A held file's readers line (engine.decoders_agree.disagree) and its "read anyway" line
 * (drawings.reports.read_anyway), for every case the second reader's check can send: an item it could
 * not read is always a disagreement, even with no item found by one reader only (items 0, unread 1).
 */
import { setupI18n } from '@lingui/core'
import { describe, expect, it } from 'vitest'
import { englishMessages } from '@/i18n/catalogues'

const i18n = setupI18n({ locale: 'en', messages: { en: englishMessages() } })
const params = (items: number, unread: number, layers = 0) => ({ items, only_first: items, only_second: 0, kinds: 0, layers, unread })

describe.each(['engine.decoders_agree.disagree', 'drawings.reports.read_anyway'])('%s', (code) => {
  it('never says the readers found the same items when the second could not read one', () => {
    const said = i18n._(code, params(0, 1))
    expect(said).toContain('found different contents in this file: the second reader could not read 1 item.')
    expect(said).not.toContain('the same items')
  })

  it('says the same items only when every item was read by both', () => {
    expect(i18n._(code, params(0, 0))).toContain('they found the same items but disagree on what some of them are.')
  })

  it('counts the items found by one reader, their layers and the unread ones', () => {
    expect(i18n._(code, params(2, 1, 3))).toContain(
      '2 items were found by only one of them, on 3 layers; the second reader could not read 1 item.',
    )
  })
})

it('says who chose to read the held file, and what to do next', () => {
  const said = i18n._('drawings.reports.read_anyway', params(1, 0))
  expect(said).toContain('Its Question was answered "Read it anyway", so its sheets are in the sheet list, each marked "held"')
  expect(said).toContain('Check each sheet against its plot before you confirm it.')
})
