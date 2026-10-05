/*
 * T-W332's acceptance, the words (the ticket's section 3 D; #332): a numbered sheet whose title block gives no
 * title takes the title of its one drawing view, and the API names that title's source `view_title`. The
 * inspector's "Proposal: where each was read" (m0-screens 6.6) says where each fact was read, so the new source
 * has its words, fixed by the ticket: "the title of its view". A title is a title: the sheet list and the
 * Question card name the sheet as for any titled one. On the t22 fixture; every title is invented.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FakeStep1 } from '@/acceptance/t22/step1.fixture'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)
const PATH = '/p/KR-01/takeoff/1'
const VIEW_WORDS = 'the title of its view'

afterEach(() => {
  document.body.innerHTML = ''
})

function project(): { api: FakeApi; step1: FakeStep1 } {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  return { api, step1 }
}

async function open(api: FakeApi) {
  await mountApp(PATH, { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
}

function rowOf(text: string): HTMLElement {
  const rows = [...document.querySelectorAll<HTMLElement>('[role="row"]')].filter((r) => clean(r.textContent).includes(text))
  const inner = rows.filter((r) => !rows.some((o) => o !== r && r.contains(o)))
  expect(inner, `one row for ${text}`).toHaveLength(1)
  return inner[0]!
}

async function focusRow(number: string) {
  await waitFor(() => rowOf(number))
  await userEvent.click(within(rowOf(number)).getByText(number))
}

const inspector = () => screen.getByRole('complementary')

/** The words of the inspector's fact under `label` ("Number", "Title"). */
function fact(label: string): string {
  const terms = [...inspector().querySelectorAll('dt')].filter((dt) => clean(dt.textContent) === label)
  expect(terms, `one ${label} fact`).toHaveLength(1)
  const value = terms[0]!.nextElementSibling
  expect(value?.tagName).toBe('DD')
  return clean(value!.textContent)
}

async function sheetFacts(api: FakeApi, number: string) {
  await open(api)
  await focusRow(number)
  await waitFor(() => expect(clean(inspector().textContent)).toContain('Proposal: where each was read'))
}

const card = (tag: RegExp) => (name: string) => tag.test(clean(name))

describe('W1: a title read from the sheet’s one view says so', () => {
  it('reads "the title of its view" after the title, and the number keeps its title-block source', async () => {
    const { api, step1 } = project()
    Object.assign(step1.proposals.find((p) => p.number === 'S-05')!, {
      title: 'Parapet beam detail',
      title_source: 'view_title',
      number_source: 'title_block_text',
    })

    await sheetFacts(api, 'S-05')

    expect(fact('Title')).toBe(VIEW_WORDS)
    expect(fact('Number')).toBe('S-05 text in the title block')
    expect(clean(inspector().textContent)).toContain('Parapet beam detail')
  })
})

describe('W2: the other sources keep their words', () => {
  it('reads "text in the title block" for a title-block title, never the new words', async () => {
    const { api, step1 } = project()
    Object.assign(step1.proposals.find((p) => p.number === 'S-05')!, { title: 'Parapet beam detail', title_source: 'title_block_text' })

    await sheetFacts(api, 'S-05')

    expect(fact('Title')).toBe('text in the title block')
    expect(clean(inspector().textContent)).not.toContain(VIEW_WORDS)
  })

  it('says nothing after a title whose source the API does not name', async () => {
    const { api, step1 } = project()
    Object.assign(step1.proposals.find((p) => p.number === 'S-05')!, { title: 'Parapet beam detail', title_source: null })

    await sheetFacts(api, 'S-05')

    expect(fact('Title')).toBe('')
    expect(clean(inspector().textContent)).not.toContain(VIEW_WORDS)
  })

  it('says nothing, and does not fail, for a source the screen does not know', async () => {
    const { api, step1 } = project()
    Object.assign(step1.proposals.find((p) => p.number === 'S-05')!, { title: 'Parapet beam detail', title_source: 'view_caption' })

    await sheetFacts(api, 'S-05')

    expect(fact('Title')).toBe('')
    expect(fact('Number')).toContain('S-05')
  })
})

describe('W3: the sheet list and the Question card name it as any titled sheet', () => {
  it('lists the title with no marker and words the kind Question by the title', async () => {
    const { api, step1 } = project()
    Object.assign(step1.proposals.find((p) => p.number === 'A-05')!, { title: 'LOUVRE SCREEN DETAIL', title_source: 'view_title' })

    await open(api)

    const row = clean(rowOf('A-05').textContent)
    expect(row).toContain('LOUVRE SCREEN DETAIL')
    expect(row).not.toContain(VIEW_WORDS)
    await focusRow('A-05')
    const cards = await screen.findAllByRole('region', { name: card(/^Question Q\d+$/) })
    const kind = cards.map((c) => clean(c.textContent)).find((t) => t.includes('which kind of sheet A-05 is'))
    expect(kind).toBeDefined()
    expect(kind).toContain('Its title, “LOUVRE SCREEN DETAIL”, does not say which kind of sheet A-05 is.')
    expect(kind).not.toContain('It has no title')
    expect(kind).not.toContain(VIEW_WORDS)
  })
})
