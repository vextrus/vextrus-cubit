/*
 * S15-W3 (issue #547, superseding #220): a file set aside keeps its row on Step 1, marked, and its
 * report no longer says it is held.
 *
 * docs/design/m0-screens.md §6.13, "A held file (ruling 3)": "the file's chip and row stay marked:
 * "Held, read anyway" (its sheets listed, each marked "held") / "Set aside: waiting for the re-saved
 * file" / "Set aside: sent to Vextrus to check"". §6.3: "a held file whose Question is answered heads its
 * Discipline". #220: "The file's row leaves the Step 1 list; only the chip carries the state" and "The
 * file report still says "It is held, so nothing from it reaches the sheet list while it may be
 * misread." under the header "Set aside: waiting for the re-saved file"."
 *
 * The fakes are ../t206's arrangement: KR-01 (22's fake) with 21c's answers, its files band fed by
 * 20b's files list (the read file and the held one), the held file's report carrying the readers'
 * disagreement (`engine.decoders_agree.disagree`, the words that end "It is held, …").
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeDrawingSet, file, msg } from '@/acceptance/t20b/drawings.fixture'
import { FakeAnswers } from '../t156/answer.fixture'
import { answerByKeys, clean, open, sectionRows } from './w3.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-06T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const HELD_NAME = 'KR-STR-old.dwg'
const AWAITING = 'Set aside: waiting for the re-saved file'
const SENT = 'Set aside: sent to Vextrus to check'

/** KR-01 with its held file; `answered`: its Question already answered so, the file's status the API's code for it. */
function kr01(answered: 'await_resaved' | 'sent_to_vextrus' | null) {
  const fake = new FakeAnswers()
  fake.questions = fake.step1.questions.map((q) => ({ ...q, proposals: [] }))
  const held = fake.questions.find((q) => q.kind === 'file_misread')!
  fake.questions = [held]
  const set = new FakeDrawingSet(fake.api, 'KR-01')
  const heldFile = file({ id: held.subject_id!, name: HELD_NAME, state: 'held', status: msg(answered ? `drawings.files.${answered}` : 'drawings.files.held') })
  set.files = [file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read', { sheets: 13 }), sheets_found: 13 }), heldFile]
  set.reports.set(heldFile.id, {
    readers: [msg('engine.decoders_agree.disagree', { items: 312, only_first: 312, only_second: 0, kinds: 1, layers: 1, unread: 0 })],
  })
  if (answered) Object.assign(held, { status: 'answered', answer: { option: answered, by: 'Nusrat Jahan' }, answered_at: '2026-10-06T05:00:00Z' })
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
  return { fake, held, heldFile }
}

/** The list's rows (22's grid "Sheets"). */
async function rows(): Promise<HTMLElement[]> {
  const grid = await screen.findByRole('grid', { name: 'Sheets' })
  return within(grid).getAllByRole('row')
}

/** The list's row naming the held file, once it shows. */
async function fileRow(): Promise<HTMLElement> {
  let found: HTMLElement | undefined
  await waitFor(async () => {
    found = (await rows()).find((r) => clean(r.textContent).includes(HELD_NAME))
    expect(found, `a row of the list naming ${HELD_NAME}`).toBeDefined()
  })
  return found!
}

/** The held file's chip in the files band (as ../t206). */
async function chip(): Promise<HTMLElement> {
  const band = await screen.findByRole('list', { name: /files/ })
  let found: HTMLElement | undefined
  await waitFor(() => {
    found = within(band)
      .getAllByRole('button')
      .find((b) => clean(b.textContent).includes(HELD_NAME))
    expect(found, `the chip of ${HELD_NAME}`).toBeDefined()
  })
  return found!
}

describe('the set-aside file’s row stays in the list, marked (§6.13; #220)', () => {
  it('keeps a row naming the file, marked "Set aside: waiting for the re-saved file", once the QS sets it aside', async () => {
    const { fake, held } = kr01(null)
    await open(fake)
    await answerByKeys(held, 'await_resaved')
    await waitFor(() => expect(fake.posted).toHaveLength(1))
    await waitFor(async () => expect(clean((await chip()).textContent)).toContain(AWAITING))
    const row = await fileRow()
    await waitFor(() => expect(clean(row.textContent)).toContain(AWAITING))
  })

  it('shows the row marked "Set aside: sent to Vextrus to check" for a file the API sends so', async () => {
    const { fake } = kr01('sent_to_vextrus')
    await open(fake)
    const row = await fileRow()
    await waitFor(() => expect(clean(row.textContent)).toContain(SENT))
    expect(clean(row.textContent)).not.toMatch(/\bheld\b/i)
  })

  it('heads the Structural section with the set-aside file’s row (§6.3)', async () => {
    const { fake } = kr01('await_resaved')
    await open(fake)
    await fileRow()
    const structural = await sectionRows('Structural')
    expect(structural[0], 'the first row under the Structural heading').toContain(HELD_NAME)
  })
})

describe('the set-aside file’s report (#220)', () => {
  it('no longer says the file is held', async () => {
    const { fake } = kr01('await_resaved')
    await open(fake)
    await userEvent.click(await chip())
    // The report opens in the inspector (§6.2), headed with the file's state.
    await waitFor(() => expect(clean(document.querySelector('[data-region="inspector"]')?.textContent ?? document.body.textContent)).toContain(AWAITING))
    // The readers' finding is still reported (§4.5's words), only not as held.
    await waitFor(() => expect(clean(document.body.textContent)).toContain('The two readers found different contents in this file'))
    expect(clean(document.body.textContent)).not.toContain('It is held')
  })
})
