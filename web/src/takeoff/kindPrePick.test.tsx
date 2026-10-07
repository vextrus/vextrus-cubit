/* #228 (review 1, finding 1): the kind Question shows Jev's first kind pre-picked, its one source named, and Enter answers it. */
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { PEOPLE, mountApp } from '@/app/testing'
import { FakeAnswers } from '../acceptance/t156/answer.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)

describe("the kind Question's pre-pick (#228; m0-screens §5)", () => {
  it("shows Jev's first kind picked, names its source, and Enter answers it", async () => {
    const fake = new FakeAnswers()
    const question = fake.byKind().low_confidence!
    question.discipline = 'structural'
    question.options = ['slab_details', 'slab_layout', 'details', 'keep_open'].map((key, i) => ({ key, picked: i === 0 }))
    fake.questions = [question]
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api: fake.api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    await userEvent.keyboard('q')
    const card = await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q1' })
    const radio = (await screen.findAllByRole('radio', { name: (n: string) => clean(n).includes('Slab details') }))[0] as HTMLInputElement
    expect(radio.checked).toBe(true)
    expect(clean(card.textContent)).toMatch(/Picked for you: Vextrus’s reading of this sheet’s title and view titles/)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(fake.posted).toHaveLength(1))
    expect(fake.posted[0]!.body).toMatchObject({ option: 'slab_details' })
  })

  it('kept open, shows no pick and a second Enter answers nothing (review 2, finding 1)', async () => {
    const fake = new FakeAnswers()
    const question = fake.byKind().low_confidence!
    question.discipline = 'structural'
    question.options = ['slab_details', 'slab_layout', 'details', 'keep_open'].map((key, i) => ({ key, picked: i === 0 }))
    fake.questions = [question]
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api: fake.api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    await userEvent.keyboard('q')
    const card = await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q1' })
    await userEvent.keyboard('4')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(fake.posted).toHaveLength(1))
    expect(fake.posted[0]!.body).toMatchObject({ option: 'keep_open' })
    await waitFor(() => expect(clean(card.textContent)).toMatch(/Kept open/))
    const radio = (await screen.findAllByRole('radio', { name: (n: string) => clean(n).includes('Slab details') }))[0] as HTMLInputElement
    expect(radio.checked).toBe(false)
    expect(clean(card.textContent)).not.toMatch(/Picked for you/)
    expect(clean(card.textContent)).not.toMatch(/sets the kind of A-05 to Slab details/)
    await userEvent.keyboard('{Enter}')
    await new Promise((r) => setTimeout(r, 300))
    expect(fake.posted).toHaveLength(1)
  })
})
