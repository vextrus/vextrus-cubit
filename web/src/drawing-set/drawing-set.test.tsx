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

describe('the words gate, round 1', () => {
  it('says a held file\'s reason once in its report, and 21a\'s finding as the top line only', async () => {
    const { api, set } = drawingSet()
    const disagree = msg('engine.decoders_agree.disagree', { items: 212, layers: 3 })
    const held = file({ name: 'KR-STR-R0.dwg', state: 'held', status: msg('drawings.files.held'), finding: disagree })
    set.files.push(held)
    set.reports.set(held.id, { readers: [disagree] })
    await open(api)
    await waitFor(() => rowOf('KR-STR-R0.dwg'))
    await userEvent.click(rowOf('KR-STR-R0.dwg'))
    const panel = await screen.findByRole('region', { name: /KR-STR-R0\.dwg/ })
    await waitFor(() => expect(within(panel).getByRole('heading', { name: 'Readers' })).toBeVisible())
    const readersText = within(panel).getByRole('heading', { name: 'Readers' }).parentElement!.textContent!
    const text = clean(panel.textContent)
    expect(text.split(clean(readersText.replace('Readers', ''))).length - 1).toBe(1)
  })

  it('says nothing of a status twice: an old AutoCAD file reads its reason in the header only', async () => {
    const { api, set } = drawingSet()
    const old = msg('drawings.files.old_version')
    const f = file({ name: 'KR-STR-R0.dwg', state: 'unreadable', status: old, finding: old })
    set.files.push(f)
    set.reports.set(f.id, { readers: [old] })
    await open(api)
    await waitFor(() => rowOf('KR-STR-R0.dwg'))
    await userEvent.click(rowOf('KR-STR-R0.dwg'))
    const panel = await screen.findByRole('region', { name: /KR-STR-R0\.dwg/ })
    await waitFor(() => expect(clean(panel.textContent)).toContain('Saved by a version of AutoCAD'))
    expect(clean(panel.textContent).split('Saved by a version of AutoCAD').length - 1).toBe(1)
    expect(within(panel).queryByRole('heading', { name: 'Readers' })).toBeNull()
  })

  it("files a PDF's report under §4.5's headings, never all under Made by", async () => {
    const { api, set } = drawingSet()
    const pdf = file({ name: 'KR-ARC-R0.pdf', state: 'read', status: msg('drawings.files.plot_waiting') })
    set.files.push(pdf)
    set.reports.set(pdf.id, { made_by: [msg('engine.pdf_report.made_by_autocad'), msg('engine.pdf_report.layers_kept'), msg('engine.pdf_report.no_pictures')] })
    await open(api)
    await waitFor(() => rowOf('KR-ARC-R0.pdf'))
    await userEvent.click(rowOf('KR-ARC-R0.pdf'))
    const panel = await screen.findByRole('region', { name: /KR-ARC-R0\.pdf/ })
    await waitFor(() => expect(within(panel).getByRole('heading', { name: 'Layers' })).toBeVisible())
    const under = (h: string) => clean(within(panel).getByRole('heading', { name: h }).parentElement!.textContent)
    expect(under('Made by')).toBe("Made byMade by AutoCAD's PDF plotter.")
    expect(under('Layers')).toContain("The drawing's layers are kept in the PDF.")
    expect(under('Pictures')).toContain('No pictures.')
  })

  it("never counts a replaced copy as added, and says no count when nothing was added or already here", async () => {
    const { api, set } = drawingSet()
    const here = file({ name: 'KR-STR-R0.dwg', state: 'waiting', status: msg('drawings.files.waiting', { ahead: 0 }) })
    set.files.push(here)
    set.answerUpload('KR-STR-R0.dwg', 200, { file: here, outcome: 'replaced', message: msg('drawings.uploads.replaced_reading', { file: 'KR-STR-R0.dwg' }) })
    set.answerUpload('a.jpg', 415, msg('drawings.uploads.not_a_drawing', { file: 'a.jpg' }))
    set.answerUpload('b.jpg', 415, msg('drawings.uploads.not_a_drawing', { file: 'b.jpg' }))
    await open(api)
    await waitFor(() => rowOf('KR-STR-R0.dwg'))
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    await userEvent.upload(input, ['KR-ARC-R0.dwg', 'KR-STR-R0.dwg'].map((n) => new File([new Uint8Array([0x41])], n)))
    await waitFor(() => expect(bodyText()).toContain("1 file added; 1 replaced Vextrus's damaged copy."))
    await userEvent.upload(input, ['a.jpg', 'b.jpg'].map((n) => new File([new Uint8Array([0x41])], n)))
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2))
    expect(bodyText()).not.toContain('No files added')
  })

  it('names the file an unnamed refusal was about', async () => {
    const { api, set } = drawingSet()
    set.files.push(file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read') }))
    set.answerUpload('KR-ARC-R0.dwg', 400, msg('drawings.uploads.stopped'))
    await open(api)
    await waitFor(() => rowOf('KR-STR-R0.dwg'))
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    await userEvent.upload(input, ['KR-ARC-R0.dwg', 'KR-ELE-R0.dwg'].map((n) => new File([new Uint8Array([0x41])], n)))
    await waitFor(() => expect(clean(screen.getByRole('alert').textContent)).toBe('KR-ARC-R0.dwg was not added. Upload stopped: the connection dropped. Add it again.'))
  })

  it("refuses the MD's drop with the read-only words, sending nothing", async () => {
    const { api, set } = drawingSet()
    set.files.push(file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read') }))
    await mountApp('/p/KR-01/drawing-set', { as: PEOPLE.md, api })
    await screen.findByRole('heading', { name: 'Drawing Set' })
    await waitFor(() => rowOf('KR-STR-R0.dwg'))
    const data = new DataTransfer()
    data.items.add(new File([new Uint8Array([0x41])], 'KR-ARC-R0.dwg'))
    const drop = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data })
    document.querySelector('h1')!.dispatchEvent(drop)
    expect(drop.defaultPrevented).toBe(true)
    await waitFor(() => expect(bodyText()).toContain('As MD you can look at the Takeoff but not change it.'))
    expect(bodyText()).not.toContain('Drop to add')
    expect(set.seen.filter((s) => !s.call.startsWith('GET'))).toEqual([])
  })
})

describe('a drop queued behind another (refuter, round 1)', () => {
  /** The fake with the first upload held until `release()`, and a hook run when it is answered. */
  function held() {
    const { api, set } = drawingSet()
    let release = () => {}
    const gate = new Promise<void>((r) => (release = r))
    let first = true
    let onFirstAnswered: (() => void) | null = null
    const inner = api.handle
    api.handle = async (request: Request) => {
      const isPost = request.method === 'POST' && new URL(request.url, location.origin).pathname.endsWith('/files')
      if (isPost && first) {
        first = false
        await gate
        const answer = await inner(request)
        onFirstAnswered?.()
        return answer
      }
      return inner(request)
    }
    return { api, set, release: () => release(), whenFirstAnswered: (f: () => void) => (onFirstAnswered = f) }
  }
  const files = (...names: string[]) => names.map((n) => new File([new Uint8Array([0x41])], n))

  it('never sends a queued drop for the session that follows the one it was dropped in', async () => {
    const { api, set, release, whenFirstAnswered } = held()
    set.files.push(file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read') }))
    const app = await mountApp('/p/KR-01/drawing-set', { as: PEOPLE.qs, api })
    await screen.findByRole('heading', { name: 'Drawing Set' })
    await waitFor(() => rowOf('KR-STR-R0.dwg'))
    whenFirstAnswered(() => sessionChanged(app.queryClient))
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    await userEvent.upload(input, files('A-1.dwg', 'A-2.dwg'))
    await userEvent.upload(input, files('B-1.dwg', 'B-2.dwg'))
    release()
    await waitFor(() => expect(bodyText()).not.toContain('Uploading'))
    await new Promise((r) => setTimeout(r, 300))
    expect(set.seen.filter((s) => s.call === 'POST /files').map((s) => s.body)).toEqual([{ file: 'A-1.dwg' }])
    expect(bodyText()).not.toMatch(/files? added/)
  })

  it("keeps the first drop's refusals in view while a queued drop uploads, and after", async () => {
    const { api, set, release } = held()
    set.files.push(file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read') }))
    set.answerUpload('site.jpg', 415, msg('drawings.uploads.not_a_drawing', { file: 'site.jpg' }))
    await open(api)
    await waitFor(() => rowOf('KR-STR-R0.dwg'))
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    await userEvent.upload(input, files('A.dwg', 'site.jpg'))
    await userEvent.upload(input, files('C.dwg'))
    release()
    await waitFor(() => expect(set.seen.filter((s) => s.call === 'POST /files')).toHaveLength(3))
    await waitFor(() => expect(bodyText()).not.toContain('Uploading'))
    expect(bodyText()).toContain('site.jpg is not a DWG or a PDF, so it was not added.')
  })

  it("counts a replaced copy in the line for several files", async () => {
    const { api, set } = drawingSet()
    const here = file({ name: 'KR-STR-R0.dwg', state: 'waiting', status: msg('drawings.files.waiting', { ahead: 0 }) })
    set.files.push(here)
    set.answerUpload('KR-STR-R0.dwg', 200, { file: here, outcome: 'replaced', message: msg('drawings.uploads.replaced_reading', { file: 'KR-STR-R0.dwg' }) })
    await open(api)
    await waitFor(() => rowOf('KR-STR-R0.dwg'))
    await userEvent.upload(document.querySelector<HTMLInputElement>('input[type="file"]')!, files('KR-ARC-R0.dwg', 'KR-STR-R0.dwg'))
    await waitFor(() => expect(bodyText()).toContain("1 file added; 1 replaced Vextrus's damaged copy."))
    // The count says it; the file's own line ("…nothing else was added") would contradict "1 file added".
    expect(bodyText()).not.toContain('This one replaces that copy')
  })

  it('says a file whose answer could not be read may or may not be added, rather than nothing', async () => {
    const { api, set } = drawingSet()
    set.files.push(file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read') }))
    const inner = api.handle
    api.handle = async (request: Request) =>
      request.method === 'POST' ? new Response('<html>proxy</html>', { status: 200, headers: { 'Content-Type': 'application/json' } }) : inner(request)
    await open(api)
    await waitFor(() => rowOf('KR-STR-R0.dwg'))
    await userEvent.upload(document.querySelector<HTMLInputElement>('input[type="file"]')!, files('KR-ARC-R0.dwg'))
    await waitFor(() =>
      expect(bodyText()).toContain('Vextrus could not tell whether KR-ARC-R0.dwg was added. If it is not in the list in a minute, add it again.'),
    )
  })
})

describe('a batch that outlives its page (review round 1, finding 1)', () => {
  /** KR-01's Drawing Set with its first upload held until `release()`, and BP-02's beside it. */
  function heldKr() {
    const api = new FakeApi()
    const kr = new FakeDrawingSet(api, 'KR-01')
    new FakeDrawingSet(api, 'BP-02')
    kr.files.push(file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read') }))
    kr.answerUpload('site.jpg', 415, msg('drawings.uploads.not_a_drawing', { file: 'site.jpg' }))
    let release = () => {}
    const gate = new Promise<void>((r) => (release = r))
    let first = true
    const inner = api.handle
    api.handle = async (request: Request) => {
      if (first && request.method === 'POST' && new URL(request.url, location.origin).pathname.endsWith('/files')) {
        first = false
        await gate
      }
      return inner(request)
    }
    return { api, kr, release: () => release() }
  }
  const files = (...names: string[]) => names.map((n) => new File([new Uint8Array([0x41])], n))

  it("says in one line, naming the project, what a batch came to after its page was left, and shows why on reopening it", async () => {
    const { api, kr, release } = heldKr()
    const app = await mountApp('/p/KR-01/drawing-set', { as: PEOPLE.qs, api })
    await screen.findByRole('heading', { name: 'Drawing Set' })
    await waitFor(() => rowOf('KR-STR-R0.dwg'))
    await userEvent.upload(document.querySelector<HTMLInputElement>('input[type="file"]')!, files('KR-ARC-R0.dwg', 'site.jpg'))
    await app.router.navigate({ to: '/p/$code/takeoff/$step', params: { code: 'BP-02', step: '1' } })
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Drawing Set' })).toBeNull())
    release()
    await waitFor(() => expect(kr.seen.filter((s) => s.call === 'POST /files')).toHaveLength(2))
    await waitFor(() => expect(bodyText()).toContain('Kadam Residence’s Drawing Set: 1 file added; 1 was not added. Open it to see why.'))
    // The reason is not in the toast (it spills and vanishes): it waits for the project's Drawing Set.
    expect(bodyText()).not.toContain('site.jpg is not a DWG')
    await app.router.navigate({ to: '/p/$code/drawing-set', params: { code: 'KR-01' } })
    await screen.findByRole('heading', { name: 'Drawing Set' })
    await waitFor(() =>
      expect(screen.getAllByRole('alert').map((a) => clean(a.textContent))).toContain('site.jpg is not a DWG or a PDF, so it was not added. Vextrus reads DWG and PDF files.'),
    )
    // Shown once: leaving and opening it again does not bring the bar back.
    await app.router.navigate({ to: '/p/$code/takeoff/$step', params: { code: 'KR-01', step: '1' } })
    await app.router.navigate({ to: '/p/$code/drawing-set', params: { code: 'KR-01' } })
    await screen.findByRole('heading', { name: 'Drawing Set' })
    await waitFor(() => rowOf('KR-STR-R0.dwg'))
    expect(screen.queryAllByRole('alert').filter((a) => clean(a.textContent).includes('site.jpg'))).toEqual([])
  })

  it("starts another project's Drawing Set afresh: none of the first project's upload, bars or toast on it", async () => {
    const { api, release } = heldKr()
    const app = await mountApp('/p/KR-01/drawing-set', { as: PEOPLE.qs, api })
    await screen.findByRole('heading', { name: 'Drawing Set' })
    await waitFor(() => rowOf('KR-STR-R0.dwg'))
    await userEvent.upload(document.querySelector<HTMLInputElement>('input[type="file"]')!, files('KR-ARC-R0.dwg', 'site.jpg'))
    await waitFor(() => expect(bodyText()).toContain('Uploading'))
    await app.router.navigate({ to: '/p/$code/drawing-set', params: { code: 'BP-02' } })
    await waitFor(() => expect(bodyText()).toContain('No drawings yet.'))
    expect(bodyText()).not.toContain('Uploading')
    release()
    await waitFor(() => expect(bodyText()).toContain('Kadam Residence’s Drawing Set: 1 file added; 1 was not added. Open it to see why.'))
    // Its reason is never in a bar on Bokul Place's page; it shows on Kadam Residence's.
    expect(screen.queryAllByRole('alert').filter((a) => clean(a.textContent).includes('site.jpg'))).toEqual([])
    await app.router.navigate({ to: '/p/$code/drawing-set', params: { code: 'KR-01' } })
    await waitFor(() => expect(screen.getAllByRole('alert').some((a) => clean(a.textContent).includes('site.jpg is not a DWG'))).toBe(true))
  })

  it("never shows a held reason to the next person signed in", async () => {
    const { api, release } = heldKr()
    const app = await mountApp('/p/KR-01/drawing-set', { as: PEOPLE.qs, api })
    await screen.findByRole('heading', { name: 'Drawing Set' })
    await waitFor(() => rowOf('KR-STR-R0.dwg'))
    await userEvent.upload(document.querySelector<HTMLInputElement>('input[type="file"]')!, files('KR-ARC-R0.dwg', 'site.jpg'))
    await app.router.navigate({ to: '/p/$code/takeoff/$step', params: { code: 'BP-02', step: '1' } })
    release()
    await waitFor(() => expect(bodyText()).toContain('Open it to see why.'))
    sessionChanged(app.queryClient)
    await app.router.navigate({ to: '/p/$code/drawing-set', params: { code: 'KR-01' } })
    await waitFor(() => rowOf('KR-STR-R0.dwg'))
    expect(screen.queryAllByRole('alert').filter((a) => clean(a.textContent).includes('site.jpg'))).toEqual([])
  })
})

describe('the count for several files never says "not added" of a file that may be here (finding 2)', () => {
  it('leaves out an answer that could not be read and a file already here whose reading could not start', async () => {
    const { api, set } = drawingSet()
    const here = file({ name: 'KR-STR-R0.dwg', state: 'waiting', status: msg('drawings.files.waiting', { ahead: 0 }) })
    set.files.push(here)
    set.answerUpload('KR-STR-R0.dwg', 503, msg('takeoff.read_file.not_started_waiting', { file: 'KR-STR-R0.dwg' }))
    const inner = api.handle
    api.handle = async (request: Request) => {
      if (request.method === 'POST' && request.headers.get('Content-Type')?.includes('multipart')) {
        const name = ((await request.clone().formData()).get('file') as File).name
        if (name === 'B.dwg') return new Response('<html>proxy</html>', { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return inner(request)
    }
    await open(api)
    await waitFor(() => rowOf('KR-STR-R0.dwg'))
    await userEvent.upload(
      document.querySelector<HTMLInputElement>('input[type="file"]')!,
      ['A.dwg', 'B.dwg', 'KR-STR-R0.dwg'].map((n) => new File([new Uint8Array([0x41])], n)),
    )
    await waitFor(() => expect(bodyText()).toContain('1 file added.'))
    expect(bodyText()).not.toContain('was not added;')
    expect(bodyText()).not.toMatch(/\d+ (was|were) not added/)
    expect(bodyText()).toContain('Vextrus could not tell whether B.dwg was added.')
  })
})

describe("the design gate's walk (review round 2)", () => {
  async function openReport(api: FakeApi, name: string) {
    await open(api)
    await waitFor(() => rowOf(name))
    await userEvent.click(rowOf(name))
    return screen.findByRole('region', { name: new RegExp(name.replace('.', '\\.')) })
  }

  it('M3: shows the Fonts table as §4.5 heads it, with the font Vextrus draws each with', async () => {
    const { api, set } = drawingSet()
    const f = file({ name: 'KR-ARC-R0.dwg', state: 'read', status: msg('drawings.files.read') })
    set.files.push(f)
    set.reports.set(f.id, {
      fonts: [msg('engine.font_report.summary', { fonts: 1 })],
      font_rows: [{ asked: msg('engine.font_report.asked', { asked: 'Romans', kind: 'shx' }), how_close: msg('engine.font_report.how_close', { how_close: 'single_stroke', drawn_with: 'Relief SingleLine' }), texts: 12 }],
    })
    const panel = await openReport(api, 'KR-ARC-R0.dwg')
    const table = await within(panel).findByRole('table', { name: 'Fonts' })
    expect(within(table).getAllByRole('columnheader').map((h) => clean(h.textContent))).toEqual(['The drawing asks for', 'Vextrus draws it with', 'How close', 'Texts'])
    expect(within(table).getAllByRole('cell').map((c) => clean(c.textContent))).toEqual(['Romans (AutoCAD lettering)', 'Relief SingleLine', 'Single-stroke, like the plot', '12'])
  })

  it('M6: closes the report by a button that says "Close" and its key', async () => {
    const { api, set } = drawingSet()
    set.files.push(file({ name: 'KR-ARC-R0.dwg', state: 'read', status: msg('drawings.files.read') }))
    const panel = await openReport(api, 'KR-ARC-R0.dwg')
    const close = within(panel).getByRole('button', { name: /Close/ })
    expect(clean(close.textContent)).toBe('CloseEsc')
  })

  it("M7: never says a scan's lines are the plot's", async () => {
    const { api, set } = drawingSet()
    const scan = file({ name: 'scan.pdf', state: 'refused', status: msg('drawings.files.refused_scan') })
    set.files.push(scan)
    set.reports.set(scan.id, { made_by: [msg('engine.pdf_report.made_by_other', { producer: 'PDF Merge Tool' }), msg('engine.pdf_report.scan')] })
    const panel = await openReport(api, 'scan.pdf')
    await waitFor(() => expect(clean(panel.textContent)).toContain('This PDF is a scan'))
    expect(clean(panel.textContent)).toContain('Made by PDF Merge Tool, not AutoCAD.')
    expect(clean(panel.textContent)).not.toContain("Its lines are still the plot's")
  })

  it('M8: after "Cancel reading" by keyboard, focus is on the row\'s "Read again", never lost', async () => {
    const { api, set } = drawingSet()
    const reading = file({ name: 'KR-STR-R0.dwg', state: 'reading', status: msg('drawings.files.reading_drawing') })
    set.files.push(reading)
    set.afterCancel.set(reading.id, { ...reading, state: 'cancelled', status: msg('drawings.files.cancelled_unnamed') })
    await open(api)
    await waitFor(() => rowOf('KR-STR-R0.dwg'))
    within(rowOf('KR-STR-R0.dwg')).getByRole('button', { name: 'Cancel reading' }).focus()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(within(rowOf('KR-STR-R0.dwg')).getByRole('button', { name: 'Read again' })).toHaveFocus())
  })

  it('M9: shows each status whole at 1280 with the report open, never cut', async () => {
    await page.viewport(1280, 800)
    const { api, set } = drawingSet()
    set.files.push(
      file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read_bangla') }),
      file({ name: 'KR-ARC-R0.dwg', state: 'waiting', status: msg('drawings.files.waiting', { ahead: 2 }) }),
    )
    await openReport(api, 'KR-STR-R0.dwg')
    for (const name of ['KR-STR-R0.dwg', 'KR-ARC-R0.dwg']) {
      const status = rowOf(name).querySelectorAll('td')[2]!
      // Nothing in the cell cuts its words: no element holds more than it shows.
      for (const el of [status, ...status.querySelectorAll<HTMLElement>('*')].filter((e) => e.clientWidth > 0)) {
        expect(el.scrollWidth, `${name}'s status: <${el.tagName.toLowerCase()} class="${el.className}"> cuts it`).toBeLessThanOrEqual(el.clientWidth)
      }
    }
    const words = rowOf('KR-STR-R0.dwg').querySelectorAll('td')[2]!
    expect(clean(words.textContent)).toBe('Read. Two readers agree. 1 flag: Bangla text')
  })

  it('mays: a refused file has no Discipline to choose, and each act names its file', async () => {
    const { api, set } = drawingSet()
    set.files.push(
      file({ name: 'scan.pdf', state: 'refused', status: msg('drawings.files.refused_scan') }),
      file({ name: 'KR-STR-R0.dwg', state: 'reading', status: msg('drawings.files.reading_drawing') }),
    )
    await open(api)
    await waitFor(() => rowOf('scan.pdf'))
    expect(within(rowOf('scan.pdf')).queryByRole('combobox')).toBeNull()
    expect(within(rowOf('KR-STR-R0.dwg')).getByRole('button', { name: 'Cancel reading' })).toHaveAccessibleDescription(/KR-STR-R0\.dwg/)
  })
})

describe("21a's reading_started among several files (review round 2, addendum)", () => {
  it('keeps "its reading has started" beside the count', async () => {
    const { api, set } = drawingSet()
    const here = file({ name: 'KR-STR-R0.dwg', state: 'waiting', status: msg('drawings.files.waiting', { ahead: 0 }) })
    set.files.push(here)
    set.answerUpload('KR-STR-R0.dwg', 200, { file: here, outcome: 'already_here', message: msg('takeoff.read_file.reading_started', { file: 'KR-STR-R0.dwg' }) })
    await open(api)
    await waitFor(() => rowOf('KR-STR-R0.dwg'))
    await userEvent.upload(document.querySelector<HTMLInputElement>('input[type="file"]')!, ['KR-ARC-R0.dwg', 'KR-STR-R0.dwg'].map((n) => new File([new Uint8Array([0x41])], n)))
    await waitFor(() => expect(bodyText()).toContain('1 file added; 1 was already here.'))
    expect(bodyText()).toContain('KR-STR-R0.dwg is already in this Drawing Set, so nothing was added. Its reading has started.')
  })
})
