/*
 * platform.acts.busy, the refusal of an act that waited on a lock past its time (S15-A2; review 1 of
 * #641 sends it on the last try too): a file is read, it does not read (review 2 of #641, scored 20).
 */
import { setupI18n } from '@lingui/core'
import { describe, expect, it } from 'vitest'
import { englishMessages } from '@/i18n/catalogues'

const i18n = setupI18n({ locale: 'en', messages: { en: englishMessages() } })

describe('platform.acts.busy', () => {
  it('says a file still being read, never a file still reading', () => {
    const said = i18n._('platform.acts.busy')
    expect(said).toContain('a file still being read')
    expect(said).not.toContain('a file still reading')
  })
})
