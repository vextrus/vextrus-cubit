/*
 * Ticket S18-WALK1's acceptance test: G1's act timer records the answer of every act the server
 * answered, however fast and however busy the walk's process is.
 *
 * The defect (G1 walk of d0c53b48): `timedAct` in web/e2e/real/walk.spec.ts armed its wait for the
 * act's response only after it had seen the request, so a response that reached Playwright in the same
 * batch as the request was lost, and the act was recorded as never answered (status 0 at the act
 * timeout) though the server had answered 200 at once. Three G1 acts were recorded so.
 *
 * The seam (the builder extracts it from walk.spec.ts, which then imports it):
 *
 *   web/e2e/real/act-timer.ts
 *     export async function timedAct(
 *       page: Page,                                         // @playwright/test's Page
 *       api: { reading(projectId: string): Promise<boolean> },
 *       projectId: string,
 *       kind: string,
 *       keys: string[],
 *       options?: { timeoutMs?: number },                   // the act timeout; ACT_TIMEOUT_MS when absent
 *     ): Promise<{ kind: string; ms: number; read_running: boolean; status: number } | null>
 *
 * No product: a server on 127.0.0.1 in a worker thread answers each act's POST at once (or, for one
 * path, never), and a page posts the act on its key, as Step 1 does. The walk's process is made busy
 * when the act's request and answer arrive: the page logs a line on the key, the test's console
 * listener busy-loops for 50 ms in Playwright's own process, and the page posts meanwhile, so the
 * request and its answer reach Playwright together, as when the walk is busy parsing a large
 * Proposals list. On the timer as it is on main (extracted unchanged) 294 of 300 answers were lost.
 */
import { Worker } from 'node:worker_threads'
import { chromium, type Browser, type Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { timedAct } from '../../../e2e/real/act-timer'

const PROJECT = '0b5e7c1a-3f2d-4c8e-9a41-6d2f0e8b7c15'
const UNDO = `/api/projects/${PROJECT}/takeoff/step1/undo`
const EXCLUDE = `/api/projects/${PROJECT}/takeoff/step1/exclude`
const PRESSES = 300
const BUSY_MS = 50
const TIMEOUT_MS = 2000

// The page: `z` (Control+z, the walk's undo) posts the undo, `x` posts the exclude. Each logs first, so
// the walk's process is busy while the post leaves and its answer comes back.
const PAGE = `<!doctype html><title>acts</title><body><script>
addEventListener('keydown', (e) => {
  const path = e.key === 'z' ? ${JSON.stringify(UNDO)} : e.key === 'x' ? ${JSON.stringify(EXCLUDE)} : null
  if (!path) return
  console.log('act')
  setTimeout(() => fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }), 5)
})
</script></body>`

// The server, in its own thread so the busy test thread never delays its answer: the undo is answered
// 200 at once; the exclude is never answered (its socket is held open until the thread ends).
const SERVER = `
const http = require('node:http')
const { parentPort, workerData } = require('node:worker_threads')
const held = []
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === workerData.undo) {
    req.resume()
    req.on('end', () => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}') })
    return
  }
  if (req.method === 'POST' && req.url === workerData.exclude) { held.push(res); return }
  res.writeHead(200, { 'content-type': 'text/html' })
  res.end(workerData.page)
})
server.listen(0, '127.0.0.1', () => parentPort.postMessage(server.address().port))
`

const notReading = { reading: async (_projectId: string) => false }

let worker: Worker
let browser: Browser
let page: Page

beforeAll(async () => {
  worker = new Worker(SERVER, { eval: true, workerData: { undo: UNDO, exclude: EXCLUDE, page: PAGE } })
  const port = await new Promise<number>((resolve, reject) => {
    worker.once('message', resolve)
    worker.once('error', reject)
  })
  browser = await chromium.launch()
  page = await browser.newPage()
  page.on('console', () => {
    const end = performance.now() + BUSY_MS
    while (performance.now() < end) {
      // the walk's process, busy (a large Proposals list being parsed)
    }
  })
  await page.goto(`http://127.0.0.1:${port}/`)
}, 120_000)

afterAll(async () => {
  await browser?.close()
  await worker?.terminate()
})

describe("G1's act timer (S18-WALK1)", () => {
  it(
    'records every act the server answered at once with its 200, never as unanswered, over 300 presses while the walk is busy',
    async () => {
      const wrong = []
      let pressed = 0
      // Stops at the tenth wrong record: each lost answer costs the act timeout.
      while (pressed < PRESSES && wrong.length < 10) {
        pressed += 1
        const record = await timedAct(page, notReading, PROJECT, 'undo', ['Control+z'], { timeoutMs: TIMEOUT_MS })
        if (record === null || record.kind !== 'undo' || record.status !== 200) wrong.push({ press: pressed, record })
      }
      const unanswered = wrong.filter((w) => w.record?.status === 0).length
      expect(wrong, `${wrong.length} of ${pressed} presses not recorded as an answered undo (${unanswered} as status 0)`).toEqual([])
      expect(pressed).toBe(PRESSES)
    },
    300_000,
  )

  it('records an act the server never answers as no answer: status 0 at the act timeout', async () => {
    const record = await timedAct(page, notReading, PROJECT, 'exclude', ['x'], { timeoutMs: TIMEOUT_MS })
    expect(record).toEqual({ kind: 'exclude', ms: TIMEOUT_MS, read_running: false, status: 0 })
  }, 60_000)
})
