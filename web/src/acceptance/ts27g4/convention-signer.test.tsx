/*
 * S27-G4, f-4 of session 26's G1 walk (#829): an answer the Dhaka convention settled is signed in words,
 * never by the raw code. The walk saw two boundary-storey answers under "Answered" signed "convention,
 * 14 Oct 2026, 07:30" where a person's name stands on every other answer.
 *
 * docs/design/m0-screens.md 6.6, Questions tab: "Answered": one line each, "Q3 Keep R1 (14 Sep 2026); leave R0
 * out as superseded. Rafiq Hasan, 26 Sep 2026, 10:50" (who, date, time). 6.7, the boundary storey: "two plans
 * meeting alone are settled by the Dhaka convention" (the owner, 9 Oct 2026, "Settle by convention
 * (Recommended)", docs/rulings.md). The service stores such an answer as `{option: "excludes_storey", by:
 * "convention"}` (`vextrus/takeoff/services/step1.py`, `settle_by_convention`).
 *
 * The sentence "Settled by the Dhaka convention, <date>, <time>" is the session's words proposal (S27-G4's
 * brief), built from 6.7's "settled by the Dhaka convention" and 6.6's "<date>, <time>"; it awaits a
 * ux-critic words review.
 *
 * Run at /p/KR-01/takeoff/1 on t156's in-memory answers (../t156/answer.fixture.ts).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { PEOPLE, mountApp } from '@/app/testing'
import { FakeAnswers } from '@/acceptance/t156/answer.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏⁠]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)
/** 07:30 in Dhaka on 14 Oct 2026, as the walk saw it. */
const AT = '2026-10-14T01:30:00.000Z'
const WHEN = '14 Oct 2026, 07:30'

/**
 * KR-01 with two answered Questions: S-08's boundary storey settled by the convention, and the register
 * check answered by Nusrat Jahan at the same time; the inspector on its Questions tab.
 */
async function answeredTab() {
  const fake = new FakeAnswers()
  const byKind = fake.byKind()
  const settled = Object.assign(byKind.convention!, { status: 'answered', answer: { option: 'excludes_storey', by: 'convention' }, answered_at: AT })
  const byPerson = Object.assign(byKind.check!, { status: 'answered', answer: { option: 'not_sent_yet', by: 'Nusrat Jahan' }, answered_at: AT })
  fake.questions = [settled, byPerson]
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api: fake.api })
  await waitFor(() => expect(bodyText()).toMatch(/Confirmed \d+ \/ 24/))
  await userEvent.click(screen.getByRole('tab', { name: /Questions/ }))
  await waitFor(() => expect(bodyText()).toContain('Answered'))
}

/** Each "Answered" line's signer: what the line shows after its "Qn <what>." sentence (6.6). */
function signers(): string[] {
  const inspector = screen.getByRole('complementary')
  const lines = [...inspector.querySelectorAll('li')].filter((li) => /^Q\d+ /.test(clean(li.textContent)))
  expect(lines, 'two Answered lines').toHaveLength(2)
  return lines.map((li) => {
    const sentence = [...li.children].find((c) => /^Q\d+ /.test(clean(c.textContent)))
    const all = clean(li.textContent)
    return sentence ? clean(all.slice(clean(sentence.textContent).length)) : all
  })
}

describe('an answer settled by the Dhaka convention is signed in words (m0-screens 6.6; f-4, #829)', () => {
  it('never signs an answer with the raw code "convention"', async () => {
    await answeredTab()
    await waitFor(() => expect(signers()).toContain(`Nusrat Jahan, ${WHEN}`))
    const raw = signers().filter((s) => /^convention\b/.test(s))
    expect(raw, 'no Answered line signed by the raw code').toEqual([])
  })

  it('signs it "Settled by the Dhaka convention, 14 Oct 2026, 07:30"', async () => {
    await answeredTab()
    await waitFor(() => expect(signers()).toContain(`Nusrat Jahan, ${WHEN}`))
    expect(signers(), 'the convention’s answer signed in words').toContain(`Settled by the Dhaka convention, ${WHEN}`)
  })
})
