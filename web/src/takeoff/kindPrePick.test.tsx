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

  it('on a group, names each sheet’s reading as its source, counts the sheets left open and sends what the QS saw (S15-Q1 review 2)', async () => {
    const fake = new FakeAnswers()
    const question = fake.byKind().low_confidence!
    const other = fake.step1.proposals.find((p) => p.number === 'A-06')!
    question.discipline = 'architectural'
    question.params = { sheet: '', named: 'group', sheets: 2, waiting: 1 }
    question.proposals = [...question.proposals, other.id]
    question.options = ['elevation', 'section', 'details', 'keep_open'].map((key, i) => ({ key, picked: i === 0 }))
    fake.questions = [question]
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api: fake.api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    await userEvent.keyboard('q')
    const card = await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q1' })
    expect(clean(card.textContent)).toMatch(/Picked for you: Vextrus’s reading of each sheet’s title and view titles/)
    expect(clean(card.textContent)).not.toMatch(/this sheet’s title/)
    expect(clean(card.textContent)).toMatch(/What kind of sheet are these 2 sheets\?/)
    expect(clean(card.textContent)).not.toMatch(/Your answer|ready/)
    expect(clean(card.textContent)).toMatch(/Answering confirms 1 of 2 sheets and cannot be undone\. 1 stays open: another Question about it comes first\./)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(fake.posted).toHaveLength(1))
    expect(fake.posted[0]!.body).toMatchObject({ option: 'elevation', held: question.proposals })
  })

  // Review 2 of #628: the title only asks; the band says what the answer does, by count, never by a
  // range from the first sheet to the last; the toast counts the sheets too.
  const group = async (waiting: number) => {
    const fake = new FakeAnswers()
    const question = fake.byKind().low_confidence!
    const other = fake.step1.proposals.find((p) => p.number === 'A-06')!
    question.discipline = 'architectural'
    question.params = { sheet: '', named: 'group', sheets: 2, waiting }
    question.proposals = [...question.proposals, other.id]
    question.options = ['elevation', 'section', 'details', 'keep_open'].map((key, i) => ({ key, picked: i === 0 }))
    fake.questions = [question]
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api: fake.api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    await userEvent.keyboard('q')
    const card = await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q1' })
    return { fake, card }
  }

  it('on a group none of whose sheets waits, says the answer sets the kind of all of them, by count', async () => {
    const { card } = await group(0)
    const text = clean(card.textContent)
    expect(text).toMatch(/Answering sets the kind of all 2 sheets and confirms them\. It cannot be undone\./)
    expect(text).not.toMatch(/A-05 to A-06|A-05–A-06/)
  })

  it('on a group whose every sheet waits, says the answer confirms no sheet now', async () => {
    const { card } = await group(2)
    expect(clean(card.textContent)).toMatch(/Answering confirms no sheet now: each of the 2 sheets waits on another Question first\./)
  })

  it('answered, the toast counts the group’s sheets and names their kind', async () => {
    const { fake } = await group(0)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(fake.posted).toHaveLength(1))
    await waitFor(() => expect(bodyText()).toMatch(/Q1 answered\. 2 sheets are /))
  })
})
