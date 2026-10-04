/*
 * Ticket 206's acceptance tests (issue #206, found in #203's walks): "After answering a held file's
 * Question with 'Set this file aside…' and a reload, the chip still reads '<file> held'; the API sends
 * `drawings.files.await_resaved`. §6.13 calls for 'Set aside: waiting for the re-saved file'."
 *
 * m0-screens §6.13, "A held file (ruling 3)": "the file's chip and row stay marked: "Held, read anyway"
 * (its sheets listed, each marked "held") / "Set aside: waiting for the re-saved file" / "Set aside:
 * sent to Vextrus to check"". The API's shapes are 14's `FileOut` (state `held`, its status the code
 * `drawings.files.await_resaved` or `drawings.files.sent_to_vextrus` once its Question is answered:
 * `vextrus/drawings/services/drawing_files.py`'s `_HELD`) and 21c's answer operation (../t156's fake).
 *
 * Also the issue's second part, on the screen (the orchestrator's ruling: amend the words to what 21c's
 * answer does, no new act): answering S-13's drawing-list Question "Not part of this set" only records
 * it (`vextrus/takeoff/services/step1.py`'s `_apply` does nothing for `not_in_set`), so neither its
 * option, nor the first line after the pick, nor the toast says the sheet is taken off the list.
 *
 * Chosen by the acceptance writer (the report lists them): the chip is the files band's button (22's
 * list named "…files"); it carries the file's name and §6.13's words, wherever they sit in it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeDrawingSet, file, msg } from '@/acceptance/t20b/drawings.fixture'
import { PEOPLE, mountApp } from '@/app/testing'
import { FakeAnswers, type Question21c } from '../t156/answer.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-04T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)
const PATH = '/p/KR-01/takeoff/1'
const HELD_NAME = 'KR-STR-old.dwg'
const AWAITING = 'Set aside: waiting for the re-saved file'
const SENT = 'Set aside: sent to Vextrus to check'

/**
 * KR-01 after reading (22's fake) with 21c's answer operation, its files band fed by 14's files list:
 * the read file and the held one (the held-file Question's subject). With `answered`, the held file's
 * Question is answered with that option and the file's status is the API's code for it, as a reload
 * reads them. Answering the held file's Question through the fake moves the file's status as 21c does.
 */
function kr01(answered: 'await_resaved' | 'sent_to_vextrus' | null, only: 'file_misread' | 'check' | null = null) {
  const fake = new FakeAnswers()
  fake.questions = fake.step1.questions.map((q) => ({ ...q, proposals: q.subject_id ? fake.step1.proposals.filter((p) => p.sheet_id === q.subject_id).map((p) => p.id) : [] }))
  const held = fake.questions.find((q) => q.kind === 'file_misread')!
  const set = new FakeDrawingSet(fake.api, 'KR-01')
  const heldFile = file({ id: held.subject_id!, name: HELD_NAME, state: 'held', status: msg(answered ? `drawings.files.${answered}` : 'drawings.files.held') })
  set.files = [file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read', { sheets: 13 }), sheets_found: 13 }), heldFile]
  if (answered) Object.assign(held, { status: 'answered', answer: { option: answered, by: 'Nusrat Jahan' }, answered_at: '2026-10-04T05:00:00Z' })
  if (only) fake.questions = fake.questions.filter((q) => q.kind === only)
  const handle = fake.api.handle
  fake.api.handle = async (request: Request) => {
    const response = await handle(request)
    const path = new URL(request.url, location.origin).pathname
    if (request.method === 'POST' && response.ok && path.endsWith(`/questions/${held.id}/answer`)) {
      const option = (held.answer as { option?: string } | null)?.option
      if (option === 'await_resaved' || option === 'sent_to_vextrus') heldFile.status = msg(`drawings.files.${option}`)
    }
    return response
  }
  return { fake, held, set }
}

async function open(fake: FakeAnswers) {
  await mountApp(PATH, { as: PEOPLE.qs, api: fake.api })
  await waitFor(() => expect(bodyText()).toMatch(/Confirmed 0 \/ \d+/))
}

/** The held file's chip in the files band (m0-screens §6.2): the band's button carrying its name. */
async function heldChip(): Promise<HTMLElement> {
  const band = await screen.findByRole('list', { name: /files/ })
  let chip: HTMLElement | undefined
  await waitFor(() => {
    chip = within(band)
      .getAllByRole('button')
      .find((b) => clean(b.querySelector('[data-notation="file-name"]')?.textContent ?? b.textContent).includes(HELD_NAME))
    expect(chip, `the chip of ${HELD_NAME}`).toBeDefined()
  })
  return chip!
}

/** `Q` to the one open Question, the digit of `key`'s option, then Enter (as ../t156). */
async function answerByKeys(question: Question21c, key: string) {
  await userEvent.keyboard('q')
  await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q1' })
  const digit = question.options.findIndex((o) => o.key === key) + 1
  expect(digit, `${key} is offered`).toBeGreaterThan(0)
  await userEvent.keyboard(String(digit))
  await userEvent.keyboard('{Enter}')
}

describe('a held file set aside keeps its §6.13 words on its chip (#206)', () => {
  it('shows "Set aside: waiting for the re-saved file" on the chip of a file the API sends as drawings.files.await_resaved', async () => {
    const { fake } = kr01('await_resaved')
    await open(fake)
    const chip = await heldChip()
    await waitFor(() => expect(clean(chip.textContent)).toContain(AWAITING))
    expect(clean(chip.textContent)).toContain(HELD_NAME)
  })

  it('never reads "<file> held" on the chip of a file set aside to be re-saved', async () => {
    const { fake } = kr01('await_resaved')
    await open(fake)
    const chip = await heldChip()
    await waitFor(() => expect(clean(chip.textContent)).toContain(AWAITING))
    expect(clean(chip.textContent)).not.toContain(`${HELD_NAME} held`)
    expect(clean(chip.textContent)).not.toMatch(/\bheld\b/i)
  })

  it('shows "Set aside: sent to Vextrus to check" on the chip of a file the API sends as drawings.files.sent_to_vextrus', async () => {
    const { fake } = kr01('sent_to_vextrus')
    await open(fake)
    const chip = await heldChip()
    await waitFor(() => expect(clean(chip.textContent)).toContain(SENT))
    expect(clean(chip.textContent)).not.toMatch(/\bheld\b/i)
  })

  it('still reads the held file as held before its Question is answered', async () => {
    const { fake } = kr01(null)
    await open(fake)
    const chip = await heldChip()
    expect(clean(chip.textContent)).toMatch(/\bheld\b/i)
    expect(clean(chip.textContent)).not.toContain('Set aside')
  })

  it('moves the chip to "Set aside: waiting for the re-saved file" when the QS answers it so, and keeps it after a reload', async () => {
    const { fake, held } = kr01(null, 'file_misread')
    await open(fake)
    await answerByKeys(held, 'await_resaved')
    await waitFor(() => expect(fake.posted).toHaveLength(1))
    expect(fake.posted[0]!.body).toMatchObject({ option: 'await_resaved' })
    // Without a reload: the band reads the file's new status.
    await waitFor(async () => expect(clean((await heldChip()).textContent)).toContain(AWAITING))
    // A reload: a fresh mount on the same API, nothing kept from the answer but what the API holds.
    cleanup()
    await open(fake)
    const chip = await heldChip()
    await waitFor(() => expect(clean(chip.textContent)).toContain(AWAITING))
    expect(clean(chip.textContent)).not.toMatch(/\bheld\b/i)
  })
})

describe('"Not part of this set" promises only what 21c’s answer does (#206; m0-screens §5, §6.7)', () => {
  /** S-13's drawing-list Question, alone and open. */
  async function s13() {
    const { fake } = kr01(null, 'check')
    await open(fake)
    const question = fake.questions[0]!
    await userEvent.keyboard('q')
    const card = await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q1' })
    await waitFor(() => expect(clean(card.textContent)).toContain('S-13 is on the drawing list but in no file'))
    return { fake, question, card }
  }

  it('offers "Not part of this set" without promising to take the sheet off the list', async () => {
    const { card } = await s13()
    const text = clean(card.textContent)
    expect(text).toContain('Not part of this set')
    expect(text).not.toMatch(/off the list/i)
  })

  it('words the first line after picking "Not part of this set" without taking S-13 off the list', async () => {
    const { question, card } = await s13()
    const digit = question.options.findIndex((o) => o.key === 'not_in_set') + 1
    await userEvent.keyboard(String(digit))
    await waitFor(() => expect(clean(card.textContent)).toMatch(/Answering .*not part of this set/))
    expect(clean(card.textContent)).not.toMatch(/off the list|takes S-13|sheets expected/i)
  })

  it('says, once answered "Not part of this set", that it was recorded, never that S-13 was taken off the list', async () => {
    const { fake, question } = await s13()
    await answerByKeys(question, 'not_in_set')
    await waitFor(() => expect(fake.posted).toHaveLength(1))
    await waitFor(() => expect(bodyText()).toContain('Q1 answered.'))
    const toast = bodyText().slice(bodyText().indexOf('Q1 answered.'))
    expect(toast).toMatch(/^Q1 answered\. Recorded/)
    expect(bodyText()).not.toMatch(/off the list|taken off/i)
  })
})
