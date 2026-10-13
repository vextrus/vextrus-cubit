/*
 * Ticket S25-D4's acceptance tests, the save state's words after the connection comes back (G1 item M0-FL13).
 *
 * docs/design/m0-screens.md §4.1: "then on the right Coverage and the save state: "All changes saved" /
 * "Saving…" / "Not saved: the connection dropped. Trying again."" The owner's ruling (13 Oct 2026): after
 * an act was lost offline, once the connection is back the save state reads exactly "Not saved: your last
 * change did not reach Vextrus. Do it again." (no automatic retry); while still offline it keeps "Not saved:
 * the connection dropped. Trying again." only while the connection probe is running.
 *
 * "The connection is back" is what the frame already shows (§4.1, "Server unreachable"): the ErrorBar
 * "Vextrus can't be reached. Check your connection; this page keeps trying." goes once the probe's read of
 * /api/me answers (app/connectivity.ts). The lost act is Step 1's bulk Confirmation (Enter in list mode).
 *
 * Run at /p/KR-01/takeoff/1 through t22's in-memory API (../t22/step1.fixture.ts).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '../t22/step1.fixture'
import { statusBar } from '../ts15w2/keys.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)
const barText = () => clean(statusBar().textContent)

const LOST = 'Not saved: your last change did not reach Vextrus. Do it again.'
const DROPPED = 'Not saved: the connection dropped. Trying again.'
const SAVED = 'All changes saved'
const UNREACHABLE = 'Vextrus can’t be reached. Check your connection; this page keeps trying.'
/** The probe waits a growing while between its asks (query-policy.ts `backoff`, 1 s first). */
const PROBE = { timeout: 8000 }

const pathOf = (request: Request) => new URL(request.url, location.origin).pathname
const isConfirm = (request: Request) => request.method === 'POST' && pathOf(request).endsWith('/takeoff/step1/confirm')
const isMe = (request: Request) => request.method === 'GET' && pathOf(request) === '/api/me'

/**
 * KR-01's Step 1 behind a connection the test cuts and restores. While cut, every act and the probe's
 * /api/me fail as a dropped connection does (a TypeError from fetch); reads of Step 1 still answer, so the
 * one thing down is the lost act.
 */
function kr01() {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  const line = { cut: false, confirms: 0, meAsked: 0 }
  const inner = api.handle
  api.handle = async (request: Request) => {
    if (isConfirm(request)) line.confirms++
    if (isMe(request)) line.meAsked++
    if (line.cut && (isMe(request) || !['GET', 'HEAD', 'OPTIONS'].includes(request.method))) throw new TypeError('Failed to fetch')
    return inner(request)
  }
  return { api, step1, line }
}

async function open(api: FakeApi) {
  const app = await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
  return app
}

/** The QS's bulk Confirmation, sent while the connection is cut: lost. */
async function loseAnAct(line: { cut: boolean }) {
  line.cut = true
  await userEvent.keyboard('{Enter}')
  await waitFor(() => expect(barText()).toContain(DROPPED))
}

describe('the save state after an act was lost offline (§4.1; the owner, 13 Oct 2026)', () => {
  it('reads "Not saved: your last change did not reach Vextrus. Do it again." once the connection is back', async () => {
    const { api, line } = kr01()
    await open(api)
    await loseAnAct(line)
    await waitFor(() => expect(bodyText()).toContain(UNREACHABLE))
    line.cut = false
    await waitFor(() => expect(barText()).toContain(LOST), PROBE)
    expect(bodyText()).not.toContain(UNREACHABLE)
    expect(barText()).not.toContain('Trying again')
    expect(barText()).not.toContain(SAVED)
  })

  it('keeps "Not saved: the connection dropped. Trying again." while the connection is still down and the probe asks', async () => {
    const { api, line } = kr01()
    await open(api)
    const before = line.meAsked
    await loseAnAct(line)
    await waitFor(() => expect(bodyText()).toContain(UNREACHABLE))
    // "Trying again." is the probe's: it asks while the words show.
    await waitFor(() => expect(line.meAsked).toBeGreaterThan(before), PROBE)
    expect(barText()).toContain(DROPPED)
    expect(barText()).not.toContain(LOST)
    expect(barText()).not.toContain(SAVED)
  })

  it('never sends the lost change again by itself once the connection is back', async () => {
    const { api, line } = kr01()
    await open(api)
    await loseAnAct(line)
    expect(line.confirms).toBe(1)
    line.cut = false
    await waitFor(() => expect(barText()).toContain(LOST), PROBE)
    expect(line.confirms).toBe(1)
    expect(bodyText()).toContain('Confirmed 0 / 24')
  })

  it('reads "All changes saved" once the QS does it again and Vextrus answers', async () => {
    const { api, line } = kr01()
    await open(api)
    await loseAnAct(line)
    line.cut = false
    await waitFor(() => expect(barText()).toContain(LOST), PROBE)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).toContain('Confirmed 16 / 24'))
    await waitFor(() => expect(barText()).toContain(SAVED))
    expect(barText()).not.toContain('Not saved')
  })
})
