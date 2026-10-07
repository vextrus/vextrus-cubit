/*
 * Ticket S15-W0's acceptance test, every split catalogue reaches the screen: the app's English table
 * (`englishMessages()` in `web/src/i18n/catalogues.ts`, every message the web can show) holds each
 * message of every takeoff catalogue, worded as that catalogue words it. A catalogue the app never loads
 * would leave Step 1 showing message ids where its words should be.
 */
import { compileMessage } from '@lingui/message-utils/compileMessage'
import { generateMessageId } from '@lingui/message-utils/generateMessageId'
import { describe, expect, it } from 'vitest'
import { englishMessages } from '@/i18n/catalogues'
import { takeoffCatalogues } from './po'

describe('every takeoff catalogue reaches the app (S15-W0)', () => {
  it('gives the app every takeoff message’s English', () => {
    const english = englishMessages()
    const catalogues = takeoffCatalogues()
    expect(catalogues, 'takeoff catalogues on disk').not.toEqual([])
    const unshown: string[] = []
    for (const catalogue of catalogues) {
      for (const entry of catalogue.entries) {
        const id = generateMessageId(entry.id, entry.context)
        const want = JSON.stringify(compileMessage(entry.english))
        if (JSON.stringify(english[id]) !== want) unshown.push(`${catalogue.path}: ${entry.id}`)
      }
    }
    expect(unshown, 'takeoff messages the app has no English for').toEqual([])
  })
})
