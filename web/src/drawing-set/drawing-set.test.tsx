/*
 * The Drawing Set page's own tests, beside ticket 20b's acceptance tests: the refusals the acceptance
 * fake cannot send (its drawings answers never reach `FakeApi.failOnce`), and what several files at once
 * came to when some are refused.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { sessionChanged } from '@/auth/actions'
import { FakeDrawingSet, file, msg } from '@/acceptance/t20b/drawings.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)

/** The acceptance fake, with a refusal put before its own answer, once, for a request that matches. */
function drawingSet() {
  const api = new FakeApi()
  const set = new FakeDrawingSet(api, 'KR-01')
  const refusals: { method: string; ends: string; status: number; body: unknown }[] = []
  const inner = api.handle
  api.handle = async (request: Request) => {
    const path = new URL(request.url, location.origin).pathname
    const i = refusals.findIndex((r) => r.method === request.method && path.endsWith(r.ends))
    if (i < 0) return inner(request)
    const [r] = refusals.splice(i, 1)
    return new Response(JSON.stringify(r!.body), { status: r!.status, headers: { 'Content-Type': 'application/json' } })
  }
  const refuse = (method: string, ends: string, status: number, body: unknown) => refusals.push({ method, ends, status, body })
  return { api, set, refuse }
}

function rowOf(name: string): HTMLElement {
  const rows = [...document.querySelectorAll<HTMLElement>('tbody tr')].filter((r) => clean(r.textContent).includes(name))
  expect(rows).toHaveLength(1)
  return rows[0]!
}

async function open(api: FakeApi) {
  await mountApp('/p/KR-01/drawing-set', { as: PEOPLE.qs, api })
  await screen.findByRole('heading', { name: 'Drawing Set' })
}

describe('a refused act, in its words', () => {
  it('says why a file was not read again, and leaves its row as the API has it', async () => {
    const { api, set, refuse } = drawingSet()
    set.files.push(file({ name: 'KR-STR-R0.dwg', state: 'cancelled', status: msg('drawings.files.cancelled_unnamed') }))
    refuse('POST', '/restart', 409, msg('drawings.files.not_stopped'))
    await open(api)
    await waitFor(() => rowOf('KR-STR-R0.dwg'))
    await userEvent.click(within(rowOf('KR-STR-R0.dwg')).getByRole('button', { name: 'Read again' }))
    await waitFor(() => expect(bodyText()).toContain("This file's reading has not stopped, so it was not started again. Its row shows where it is."))
    expect(within(rowOf('KR-STR-R0.dwg')).getByRole('button', { name: 'Read again' })).toBeVisible()
  })

  it("says why a file's Discipline was not changed, and shows the Discipline it kept", async () => {
    const { api, set, refuse } = drawingSet()
    set.files.push(file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read') }))
    refuse('PUT', '/discipline', 409, msg('drawings.files.discipline_unnumbered_decided'))
    await open(api)
    await waitFor(() => rowOf('KR-STR-R0.dwg'))
    const select = within(rowOf('KR-STR-R0.dwg')).getByRole('combobox', { name: /^Discipline of .*KR-STR-R0\.dwg/ })
    await userEvent.selectOptions(select, 'Architectural')
    await waitFor(() =>
      expect(bodyText()).toContain(
        "A sheet from this file is already confirmed or left out in Step 1, so the file's Discipline was not changed. To change it, undo that decision in Step 1 first.",
      ),
    )
    await waitFor(() => expect((within(rowOf('KR-STR-R0.dwg')).getByRole('combobox') as HTMLSelectElement).value).toBe('structural'))
  })
})

describe('several files at once', () => {
  it('counts what was added, what was already here and what was not, and says why each refused one was not', async () => {
    const { api, set } = drawingSet()
    const here = file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read') })
    set.files.push(here)
    set.answerUpload('KR-STR-R0.dwg', 200, { file: here, outcome: 'already_here', message: msg('drawings.uploads.already_here', { file: 'KR-STR-R0.dwg', added_date: '2026-09-26T05:00:00Z', actor: 'Nusrat Jahan', vextrus: 'no' }) })
    set.answerUpload('site-plan.jpg', 415, msg('drawings.uploads.not_a_drawing', { file: 'site-plan.jpg' }))
    await open(api)
    await waitFor(() => rowOf('KR-STR-R0.dwg'))
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    await userEvent.upload(input, ['KR-ARC-R0.dwg', 'KR-STR-R0.dwg', 'site-plan.jpg'].map((n) => new File([new Uint8Array([0x41])], n)))
    await waitFor(() => expect(bodyText()).toContain('1 file added; 1 was already here; 1 was not added.'))
    expect(screen.getByRole('alert').textContent).toContain('is not a DWG or a PDF, so it was not added.')
    // Only the line counts the file already here: its own sentence is for a file added on its own.
    expect(bodyText()).not.toContain('Nothing was added.')
  })
})

describe('a batch across a change of session', () => {
  it('sends no more files once the session has changed, and says nothing of them', async () => {
    const { api, set } = drawingSet()
    set.files.push(file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read') }))
    // The first file's answer arrives after the session has changed (signed out, switched, another person).
    let afterFirstPost: (() => void) | null = null
    const inner = api.handle
    api.handle = async (request: Request) => {
      const answer = await inner(request)
      if (request.method === 'POST' && afterFirstPost) {
        afterFirstPost()
        afterFirstPost = null
      }
      return answer
    }
    const app = await mountApp('/p/KR-01/drawing-set', { as: PEOPLE.qs, api })
    await screen.findByRole('heading', { name: 'Drawing Set' })
    await waitFor(() => rowOf('KR-STR-R0.dwg'))
    afterFirstPost = () => sessionChanged(app.queryClient)
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    await userEvent.upload(input, ['KR-ARC-R0.dwg', 'KR-ELE-R0.dwg', 'KR-PLB-R0.dwg'].map((n) => new File([new Uint8Array([0x41])], n)))
    await waitFor(() => expect(bodyText()).not.toContain('Uploading'))
    expect(set.seen.filter((s) => s.call === 'POST /files').map((s) => s.body)).toEqual([{ file: 'KR-ARC-R0.dwg' }])
    expect(bodyText()).not.toMatch(/files? added/)
  })
})
