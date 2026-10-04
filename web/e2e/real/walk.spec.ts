/*
 * G1's scripted walk (docs/specs/factory.md 5 "G1"): signs in as the seed's QS on the served head,
 * uploads each Development Set's files through the Drawing Set page one after another, and makes three
 * measured checks, recorded raw into walk.json (walk.schema.json) for scripts/walk/verdict.py to judge:
 *
 *   1. every file's read completes (each file's end state and read time);
 *   2. act time while a later file is still reading: confirm, undo, exclude, undo and answer on Step 1,
 *      by its keys, each timed from the key to the act's answer (where D1 lived). An act counts as
 *      during a read only if the API showed a file reading both before and after it;
 *   3. Questions per Discipline by kind (D2), with the burden counts beside them (one-source and
 *      bulk-confirmable Sheets, continuation Questions), from the API the screen reads.
 *
 * It judges nothing (no limit is written here; they live in the private expectation files) and records
 * no page text: ordinals, the product's enum codes and numbers only, never a file name, Sheet title or
 * Question text. Selectors are roles, labels and attributes, never text or a title. Run only by
 * `python -m scripts.walk.run <sha40>` (playwright.config.ts here says what it sets).
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const QS = 'nusrat@shapla-homes.example' // the seed's QS (docs/design/m0-screens.md §7)
const MOVING = new Set(['waiting', 'reading', 'stopping', 'retrying'])
const FILE_TIMEOUT_MS = 45 * 60 * 1000
const ACT_TIMEOUT_MS = 3 * 60 * 1000
const ROUNDS_PER_FILE = 3
const POLL_MS = 3000

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is set by scripts/walk/run.py`)
  return value
}

type FileRecord = { id: number; state: string; read_seconds: number | null }
type ActRecord = { kind: string; ms: number; read_running: boolean; status: number }
type Burden = { sheets: number; one_source: number; bulk_confirmable: number; continuation_questions: number; false_continuation_questions: number | null }
type SetRecord = {
  project: string
  files: FileRecord[]
  acts: ActRecord[]
  questions: Record<string, Record<string, number>>
  burden: Record<string, Burden>
}

type ApiFile = { id: string; state: string }
type ApiQuestion = { id: string; kind: string; status: string; code: string; check_code: string | null; discipline: string | null }
type ApiProposal = { discipline: string | null; agrees: boolean; held: boolean }

/** A Discipline's key as a code (a Library key already is one); none becomes `none`. */
function disciplineCode(key: string | null): string {
  const code = (key ?? 'none').toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 24)
  return /^[a-z][a-z0-9_]{1,24}$/.test(code) ? code : 'none'
}

/** A product enum code as a code, or `other`. */
function kindCode(kind: string): string {
  return /^[a-z][a-z0-9_]{0,39}$/.test(kind) ? kind : 'other'
}

/** The walk.json, written whole by a rename so a reader never sees half of it. */
function writeWalk(path: string, record: unknown) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(`${path}.tmp`, `${JSON.stringify(record, null, 2)}\n`)
  renameSync(`${path}.tmp`, path)
}

class Api {
  constructor(
    private readonly page: Page,
    private readonly origin: string,
  ) {}

  private async headers(): Promise<Record<string, string>> {
    const cookies = await this.page.context().cookies()
    const token = cookies.find((c) => c.name === 'csrftoken')?.value ?? ''
    return { 'X-CSRFToken': token, Origin: this.origin, Referer: `${this.origin}/` }
  }

  async get<T>(path: string): Promise<T> {
    const response = await this.page.request.get(path)
    expect(response.status(), `GET ${path.replace(/[0-9a-f-]{36}/g, ':id')}`).toBeLessThan(400)
    return (await response.json()) as T
  }

  async post<T>(path: string, data: unknown): Promise<T> {
    await this.page.request.get('/api/auth/csrf')
    const response = await this.page.request.post(path, { data, headers: await this.headers() })
    expect(response.status(), `POST ${path}`).toBeLessThan(400)
    return (await response.json()) as T
  }

  async files(projectId: string): Promise<ApiFile[]> {
    return (await this.get<{ files: ApiFile[] }>(`/api/projects/${projectId}/drawings/files`)).files
  }

  async reading(projectId: string): Promise<boolean> {
    return (await this.files(projectId)).some((f) => MOVING.has(f.state))
  }
}

async function signIn(page: Page, password: string) {
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(QS)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 60_000 })
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 60_000 })
}

/** Uploads one file through the Drawing Set page; the API's id for it. */
async function upload(page: Page, project: { id: string; code: string }, file: string): Promise<string> {
  await page.goto(`/p/${project.code}/drawing-set`)
  const answered = page.waitForResponse(
    (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === `/api/projects/${project.id}/drawings/files`,
    { timeout: 10 * 60 * 1000 },
  )
  await page.locator('input[type="file"]').first().setInputFiles(file)
  const response = await answered
  expect(response.status(), 'the upload').toBeLessThan(400)
  const body = (await response.json()) as { file: { id: string } }
  return body.file.id
}

/** Waits for one file's read to end; its end state (`done` once read) and how long it took. */
async function readEnd(api: Api, projectId: string, fileId: string, since: number): Promise<{ state: string; seconds: number | null }> {
  const deadline = since + FILE_TIMEOUT_MS
  for (;;) {
    const file = (await api.files(projectId)).find((f) => f.id === fileId)
    const state = file?.state ?? 'missing'
    if (!MOVING.has(state)) return { state: state === 'read' ? 'done' : kindCode(state), seconds: Math.round((Date.now() - since) / 1000) }
    if (Date.now() > deadline) return { state: 'timeout', seconds: null }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }
}

const ACT_PATHS: Record<string, RegExp> = {
  confirm: /\/takeoff\/step1\/confirm$/,
  undo: /\/takeoff\/step1\/undo$/,
  exclude: /\/takeoff\/step1\/exclude$/,
  answer: /\/takeoff\/step1\/questions\/[0-9a-f-]{36}\/answer$/,
}

/**
 * One act by its keys, timed from the last key to the act's answer. Null when the screen made no such
 * request (nothing to act on): it is not recorded. A request that never answers is recorded at the
 * act timeout, which fails any sane limit.
 */
async function timedAct(page: Page, api: Api, projectId: string, kind: string, keys: string[], answered: Set<string>): Promise<ActRecord | null> {
  const before = await api.reading(projectId)
  const pattern = ACT_PATHS[kind]!
  const sent = page.waitForRequest((r) => r.method() === 'POST' && pattern.test(new URL(r.url()).pathname), { timeout: 4000 }).catch(() => null)
  let started = Date.now()
  for (const [i, key] of keys.entries()) {
    if (i > 0) await page.waitForTimeout(400) // the screen settles between keys (a sheet opening)
    started = Date.now()
    await page.keyboard.press(key)
  }
  let request = await sent
  if (!request && kind === 'answer') {
    // An option picked by its number may wait for Enter (the card's own key).
    const again = page.waitForRequest((r) => r.method() === 'POST' && pattern.test(new URL(r.url()).pathname), { timeout: 4000 }).catch(() => null)
    started = Date.now()
    await page.keyboard.press('Enter')
    request = await again
  }
  if (!request) return null
  // Never answered within the act timeout: recorded at the timeout (status 0), which fails any sane limit.
  let status = 0
  let ms = ACT_TIMEOUT_MS
  const response = await page.waitForResponse((r) => r.request() === request, { timeout: ACT_TIMEOUT_MS }).catch(() => null)
  if (response) {
    ms = Date.now() - started
    status = response.status()
  }
  if (kind === 'answer' && status > 0 && status < 400) {
    const id = /questions\/([0-9a-f-]{36})\/answer/.exec(new URL(request.url()).pathname)?.[1]
    if (id) answered.add(id)
  }
  const after = await api.reading(projectId)
  return { kind, ms, read_running: before && after, status }
}

/** Focuses the first sheet row of Step 1's list (by its row attribute, never its words). */
async function focusFirstRow(page: Page): Promise<boolean> {
  const grid = page.getByRole('grid', { name: 'Sheets' })
  const row = grid.locator('[data-row]').first()
  if ((await row.count()) === 0) return false
  await row.click()
  return true
}

/** Acts on Step 1 while a later file reads: up to ROUNDS_PER_FILE rounds of the four acts. */
async function actWhileReading(page: Page, api: Api, project: { id: string; code: string }, acts: ActRecord[], answered: Set<string>) {
  await page.goto(`/p/${project.code}/takeoff/1`)
  const grid = page.getByRole('grid', { name: 'Sheets' })
  try {
    await grid.waitFor({ state: 'visible', timeout: 60_000 })
  } catch {
    return // no sheet list yet: nothing read to act on
  }
  for (let round = 0; round < ROUNDS_PER_FILE; round++) {
    if (!(await api.reading(project.id))) return
    const record = async (kind: string, keys: string[]) => {
      const act = await timedAct(page, api, project.id, kind, keys, answered)
      if (act) acts.push(act)
      return act
    }
    if (await focusFirstRow(page)) {
      // The bulk confirmation when the bar offers one (where D1 lived); else one sheet, opened.
      let confirmed = await record('confirm', ['Escape', 'Enter'])
      if (!confirmed && (await focusFirstRow(page))) confirmed = await record('confirm', ['Space', 'Enter'])
      if (confirmed) await record('undo', ['Control+z'])
      await page.keyboard.press('Escape')
    }
    if (await focusFirstRow(page)) {
      if (await record('exclude', ['x', '1'])) await record('undo', ['Control+z'])
      else await page.keyboard.press('Escape')
    }
    await record('answer', ['q', '1'])
  }
}

/** Questions per Discipline by kind, and the burden counts, from the API the screen reads. */
async function countBurden(api: Api, projectId: string, answered: Set<string>, record: SetRecord) {
  const { questions } = await api.get<{ questions: ApiQuestion[] }>(`/api/projects/${projectId}/takeoff/step1/questions`)
  const { proposals } = await api.get<{ proposals: ApiProposal[] }>(`/api/projects/${projectId}/takeoff/step1/proposals`)
  const burden = (discipline: string): Burden =>
    (record.burden[discipline] ??= { sheets: 0, one_source: 0, bulk_confirmable: 0, continuation_questions: 0, false_continuation_questions: null })
  for (const q of questions) {
    // Open, or answered by this walk's own acts (an act must not lower the count it is judged by).
    if (q.status !== 'open' && !answered.has(q.id)) continue
    const discipline = disciplineCode(q.discipline)
    const kinds = (record.questions[discipline] ??= {})
    const kind = kindCode(q.kind)
    kinds[kind] = (kinds[kind] ?? 0) + 1
    if (/continu/.test(`${q.code} ${q.check_code ?? ''}`)) burden(discipline).continuation_questions += 1
  }
  for (const p of proposals) {
    const row = burden(disciplineCode(p.discipline))
    row.sheets += 1
    if (p.agrees && !p.held) row.bulk_confirmable += 1
    if (!p.agrees) row.one_source += 1
  }
}

test('G1: reads complete, acts while reading, Questions per Discipline', async ({ page }) => {
  const password = required('VEXTRUS_DEMO_PASSWORD')
  const out = required('WALK_JSON')
  const sets = JSON.parse(readFileSync(required('WALK_SETS'), 'utf8')) as Record<string, string[]>
  const origin = new URL(required('WALK_URL')).origin
  const walk = {
    schema: 1,
    sha: required('WALK_SHA'),
    started_at: required('WALK_STARTED_AT'),
    ...(process.env.WALK_SMOKE ? { smoke: true } : {}),
    urls: { web: origin, api: required('WALK_API_URL') },
    sets: {} as Record<string, SetRecord>,
  }
  const api = new Api(page, origin)
  try {
    await signIn(page, password)
    let n = 0
    for (const [slug, files] of Object.entries(sets)) {
      n += 1
      const code = `WK-${String(n).padStart(2, '0')}`
      const record: SetRecord = { project: code, files: [], acts: [], questions: {}, burden: {} }
      walk.sets[slug] = record
      const project = await api.post<{ id: string; code: string }>('/api/projects', { code, name: `Walk set ${n}` })
      const answered = new Set<string>()
      for (const [i, file] of files.entries()) {
        const since = Date.now()
        const fileId = await upload(page, project, file)
        if (i > 0) await actWhileReading(page, api, project, record.acts, answered)
        const end = await readEnd(api, project.id, fileId, since)
        record.files.push({ id: i + 1, state: end.state, read_seconds: end.seconds })
      }
      await countBurden(api, project.id, answered, record)
      await page.goto(`/p/${project.code}/takeoff/1`)
    }
  } finally {
    writeWalk(out, walk)
  }
})
