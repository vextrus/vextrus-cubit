/*
 * Ticket 228 (issue #228; the owner's ruling, session 11: "'Slab details' is added to the structural
 * kinds"): the Question "What kind of sheet is N?" words the new kind "Slab details" on screen, as it
 * words every other kind (web/src/takeoff/words.tsx's SHEET_KIND_NAMES). The fake is ticket 156's.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { PEOPLE, mountApp } from '@/app/testing'
import { FakeAnswers } from '../t156/answer.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)

describe('"Slab details" among the structural kinds (#228)', () => {
  it('words the kind slab_details "Slab details" in the kind Question', async () => {
    const fake = new FakeAnswers()
    const question = fake.byKind().low_confidence!
    question.discipline = 'structural'
    question.options = ['slab_details', 'slab_layout', 'details', 'keep_open'].map((key) => ({ key, picked: false }))
    fake.questions = [question]
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api: fake.api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    await userEvent.click(screen.getByRole('tab', { name: /Questions/ }))

    const radio = await screen.findByRole('radio', { name: (n: string) => clean(n).includes('Slab details') })

    expect(radio.getAttribute('value')).toBe('slab_details')
  })
})
