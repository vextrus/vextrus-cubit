/*
 * G1's scripted walk (docs/specs/factory.md 5 "G1"): signs in as the seed's QS on the served head and,
 * per Development Set, makes two Projects with the same files:
 *
 *   - the first (WK-nn, `project`) is uploaded file by file through the Drawing Set page with no act;
 *     when its last read ends, the walk takes the burden snapshot from the API the screen reads
 *     (`/step1/proposals` and `/step1/questions`) and writes it to WALK_SNAPSHOT (snapshot.json, private,
 *     never in git): every Sheet's file, number, title, Discipline, layout, proposed exclusion, held,
 *     agrees and storeys (its Views' union, and the as-titled `storeys_titled` where the API has them),
 *     every Question's kind, status, codes, Discipline and Sheets, and `acts_before_snapshot` (0: no act
 *     came before it). Then, in this Project and before any other act, the walk answers each
 *     numbering-gap Question still open with its first option and counts, per Discipline, the Sheets
 *     that agree and are not held: `bulk_after_gaps` (Sheets beside a gap join the bulk act once it is
 *     answered), with `acts_before_bulk` (0: no other act came first; an answer cannot be undone, so a
 *     count read after other answers would be inflated). The agent layer walks this Project, which no
 *     act but those gap answers touched;
 *   - the second (WK-Ann, `acts_project`) takes the same files and the acts: confirm, undo, exclude,
 *     undo and answer on Step 1 by their keys while a later file reads, in rounds until each kind has
 *     five samples or the files run out, each timed from its key to its answer and recorded with the
 *     answer's status. An act counts as during a read only if the API showed a file reading both
 *     before and after it.
 *
 * walk.json (walk.schema.json) records each file's end state and read time (the first Project), the
 * acts (the second), and Questions per Discipline by kind with the burden counts (the snapshot). Beside
 * it, conflicts.json (WALK_CONFLICTS) keeps each conflict Question of the snapshot with its Proposals'
 * keys. scripts/walk/measures.py and verdict.py judge them against the private expectations.
 *
 * It judges nothing (no limit is written here) and records no page text in walk.json: ordinals, the
 * product's enum codes and numbers only, never a file name, Sheet title or Question text (snapshot.json
 * and conflicts.json hold file names, numbers and titles to judge by; both stay private). Selectors are
 * roles, labels and attributes, never text or a title. Run only by `python -m scripts.walk.run <sha40>`
 * (playwright.config.ts here says what it sets).
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const QS = 'nusrat@shapla-homes.example' // the seed's QS (docs/design/m0-screens.md §7)
const MOVING = new Set(['waiting', 'reading', 'stopping', 'retrying'])
const FILE_TIMEOUT_MS = 45 * 60 * 1000
const ACT_TIMEOUT_MS = 3 * 60 * 1000
const ROUNDS_PER_FILE = 10
const SAMPLES_EACH = 5
const ACT_KINDS = ['confirm', 'undo', 'exclude', 'answer']
const SAME_TITLE = 'engine.conflicts.same_title'
const SAME_STOREY = 'engine.conflicts.same_storey'
const CONTINUATION_CODES = new Set([SAME_TITLE, SAME_STOREY])
const GAP_CODES = new Set(['engine.register_check.gap', 'engine.register_check.gaps'])
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
  acts_project: string
  files: FileRecord[]
  acts: ActRecord[]
  questions: Record<string, Record<string, number>>
  burden: Record<string, Burden>
}

type ApiFile = { id: string; state: string }
type ApiQuestion = {
  id: string
  kind: string
  status: string
  code: string
  check_code: string | null
  discipline: string | null
  proposals: string[]
  options: { key: string }[]
}
type ApiProposal = {
  id: string
  discipline: string | null
  agrees: boolean
  held: boolean
  file_name: string
  number: string | null
  title: string
  layout: string | null
  proposed_exclusion: string | null
  plot_page: number | null
  views: { storeys: string[] }[]
  /** The Sheet's storeys as titled (T-W318); absent on a head without them. */
  storeys_titled?: string[] | null
}
/** A Proposal by the keys the ground truth joins on; null for an id the Proposals list lacks. */
type ProposalKeys = { file: string; number: string | null; plot_page: number | null } | null
type ConflictRecord = { code: string; proposals: ProposalKeys[] }

type SnapshotSheet = {
  id: string
  file: string
  number: string | null
  title: string | null
  discipline: string | null
  layout: boolean
  proposed_exclusion: string | null
  held: boolean
  agrees: boolean
  storeys: string[]
  storeys_titled: string[] | null
}
type SnapshotQuestion = {
  id: string
  kind: string
  status: string
  code: string
  check_code: string | null
  discipline: string | null
  proposals: string[]
}
type SnapshotSet = {
  acts_before_snapshot: number
  sheets: SnapshotSheet[]
  questions: SnapshotQuestion[]
  bulk_after_gaps: Record<string, number>
  acts_before_bulk: number
}

/** A Discipline's key as a code (a Library key already is one); none becomes `none`. */
function disciplineCode(key: string | null): string {
  const code = (key ?? 'none').toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 24)
  return /^[a-z][a-z0-9_]{1,24}$/.test(code) ? code : 'none'
}

/** A snapshot's Discipline: a Library key as a code, none as null. */
function snapshotDiscipline(key: string | null): string | null {
  return key === null ? null : disciplineCode(key)
}

/** A product enum code as a code, or `other`. */
function kindCode(kind: string): string {
  return /^[a-z][a-z0-9_]{0,39}$/.test(kind) ? kind : 'other'
}

/** A JSON record (walk.json, conflicts.json), written whole by a rename so a reader never sees half. */
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
 * act timeout with status 0, which fails the walk.
 */
async function timedAct(page: Page, api: Api, projectId: string, kind: string, keys: string[]): Promise<ActRecord | null> {
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
  // Never answered within the act timeout: recorded at the timeout (status 0), which fails the walk.
  let status = 0
  let ms = ACT_TIMEOUT_MS
  const response = await page.waitForResponse((r) => r.request() === request, { timeout: ACT_TIMEOUT_MS }).catch(() => null)
  if (response) {
    ms = Date.now() - started
    status = response.status()
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

/** Each kind has its samples: acts during a read that answered (a status of 1 to 399). */
function sampled(acts: ActRecord[]): boolean {
  const good = acts.filter((a) => a.read_running && a.status > 0 && a.status < 400)
  return ACT_KINDS.every((kind) => good.filter((a) => a.kind === kind).length >= SAMPLES_EACH)
}

/** Acts on Step 1 while a later file reads: rounds of the four acts until each kind has its samples,
 * at most ROUNDS_PER_FILE rounds for this file. */
async function actWhileReading(page: Page, api: Api, project: { id: string; code: string }, acts: ActRecord[]) {
  await page.goto(`/p/${project.code}/takeoff/1`)
  const grid = page.getByRole('grid', { name: 'Sheets' })
  try {
    await grid.waitFor({ state: 'visible', timeout: 60_000 })
  } catch {
    return // no sheet list yet: nothing read to act on
  }
  for (let round = 0; round < ROUNDS_PER_FILE && !sampled(acts); round++) {
    if (!(await api.reading(project.id))) return
    const record = async (kind: string, keys: string[]) => {
      const act = await timedAct(page, api, project.id, kind, keys)
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

/** Uploads one file and waits for its read to end (acting meanwhile, when given acts): its end state
 * and read time. */
async function uploadAndRead(
  page: Page,
  api: Api,
  project: { id: string; code: string },
  file: string,
  meanwhile?: () => Promise<void>,
): Promise<{ state: string; seconds: number | null }> {
  const since = Date.now()
  const fileId = await upload(page, project, file)
  if (meanwhile) await meanwhile()
  return readEnd(api, project.id, fileId, since)
}

/** The burden snapshot of a Project no act touched, from the API the screen reads, with each open
 * conflict Question's Proposals' keys (conflicts.json). */
async function snapshotOf(api: Api, projectId: string, actsBefore: number): Promise<{ snapshot: SnapshotSet; conflicts: ConflictRecord[] }> {
  const { questions } = await api.get<{ questions: ApiQuestion[] }>(`/api/projects/${projectId}/takeoff/step1/questions`)
  const { proposals } = await api.get<{ proposals: ApiProposal[] }>(`/api/projects/${projectId}/takeoff/step1/proposals`)
  const byId = new Map(proposals.map((p) => [p.id, p]))
  const keys = (id: string): ProposalKeys => {
    const p = byId.get(id)
    return p ? { file: p.file_name, number: p.number, plot_page: p.plot_page } : null
  }
  const sheets: SnapshotSheet[] = proposals.map((p) => ({
    id: p.id,
    file: p.file_name,
    // An untitled or unnumbered Sheet reads "" in the API: the snapshot holds null.
    number: p.number || null,
    title: p.title || null,
    discipline: snapshotDiscipline(p.discipline),
    layout: p.layout !== null,
    proposed_exclusion: p.proposed_exclusion || null,
    held: p.held,
    agrees: p.agrees,
    storeys: [...new Set(p.views.flatMap((v) => v.storeys))],
    storeys_titled: p.storeys_titled ?? null,
  }))
  const asked: SnapshotQuestion[] = questions.map((q) => ({
    id: q.id,
    kind: kindCode(q.kind),
    status: q.status,
    code: q.code,
    check_code: q.check_code,
    discipline: snapshotDiscipline(q.discipline),
    proposals: q.proposals ?? [],
  }))
  const conflicts = questions
    .filter((q) => q.status === 'open' && q.kind === 'conflict')
    .map((q) => ({ code: q.code, proposals: (q.proposals ?? []).map(keys) }))
  return { snapshot: { acts_before_snapshot: actsBefore, sheets, questions: asked, bulk_after_gaps: {}, acts_before_bulk: actsBefore }, conflicts }
}

/** walk.json's open Questions per Discipline by kind and its burden counts, from the snapshot. */
function countBurden(snapshot: SnapshotSet, record: SetRecord) {
  const burden = (discipline: string): Burden =>
    (record.burden[discipline] ??= { sheets: 0, one_source: 0, bulk_confirmable: 0, continuation_questions: 0, false_continuation_questions: null })
  for (const q of snapshot.questions) {
    if (q.status !== 'open') continue
    const discipline = disciplineCode(q.discipline)
    const kinds = (record.questions[discipline] ??= {})
    kinds[q.kind] = (kinds[q.kind] ?? 0) + 1
    if (CONTINUATION_CODES.has(q.code)) burden(discipline).continuation_questions += 1
  }
  for (const s of snapshot.sheets) {
    const row = burden(disciplineCode(s.discipline))
    row.sheets += 1
    if (s.agrees && !s.held) row.bulk_confirmable += 1
    if (!s.agrees) row.one_source += 1
  }
}

/** In the snapshot's Project, after its snapshot and before any other act: answers each
 * numbering-gap Question still open (its first option, once each), then counts per Discipline the
 * Sheets that agree and are not held. These answers are not timed acts: no read is running. */
async function bulkAfterGaps(api: Api, projectId: string): Promise<Record<string, number>> {
  const answered = new Set<string>()
  for (;;) {
    const { questions } = await api.get<{ questions: ApiQuestion[] }>(`/api/projects/${projectId}/takeoff/step1/questions`)
    const gap = questions.find(
      (q) => q.status === 'open' && !answered.has(q.id) && (GAP_CODES.has(q.code) || GAP_CODES.has(q.check_code ?? '')),
    )
    if (!gap) break
    answered.add(gap.id)
    const option = gap.options[0]?.key
    // A refused answer leaves its Sheets outside the bulk count (fail closed); the walk goes on.
    if (option) await api.post(`/api/projects/${projectId}/takeoff/step1/questions/${gap.id}/answer`, { option }).catch(() => null)
  }
  const { proposals } = await api.get<{ proposals: ApiProposal[] }>(`/api/projects/${projectId}/takeoff/step1/proposals`)
  const bulk: Record<string, number> = {}
  for (const p of proposals) {
    const discipline = disciplineCode(p.discipline)
    bulk[discipline] = (bulk[discipline] ?? 0) + (p.agrees && !p.held ? 1 : 0)
  }
  return bulk
}

test('G1: reads complete, acts while reading, the burden before any act', async ({ page }) => {
  const password = required('VEXTRUS_DEMO_PASSWORD')
  const out = required('WALK_JSON')
  const conflictsOut = required('WALK_CONFLICTS')
  const snapshotOut = required('WALK_SNAPSHOT')
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
  const conflicts = {
    schema: 1,
    sha: walk.sha,
    started_at: walk.started_at,
    sets: {} as Record<string, { questions: ConflictRecord[] }>,
  }
  const snapshot = {
    schema: 1,
    sha: walk.sha,
    started_at: walk.started_at,
    sets: {} as Record<string, SnapshotSet>,
  }
  const api = new Api(page, origin)
  try {
    await signIn(page, password)
    let n = 0
    for (const [slug, files] of Object.entries(sets)) {
      n += 1
      const ordinal = String(n).padStart(2, '0')
      const code = `WK-${ordinal}`
      const actsCode = `WK-A${ordinal}`
      const record: SetRecord = { project: code, acts_project: actsCode, files: [], acts: [], questions: {}, burden: {} }
      walk.sets[slug] = record
      // (1) The Project no act touches: every file read, then the snapshot.
      const project = await api.post<{ id: string; code: string }>('/api/projects', { code, name: `Walk set ${n}` })
      for (const [i, file] of files.entries()) {
        const end = await uploadAndRead(page, api, project, file)
        record.files.push({ id: i + 1, state: end.state, read_seconds: end.seconds })
      }
      const taken = await snapshotOf(api, project.id, record.acts.length)
      snapshot.sets[slug] = taken.snapshot
      conflicts.sets[slug] = { questions: taken.conflicts }
      countBurden(taken.snapshot, record)
      // The gap answers alone, then the bulk count (no other act in this Project, before or after).
      taken.snapshot.bulk_after_gaps = await bulkAfterGaps(api, project.id)
      // (2) The Project the acts are timed in: the same files, read again, acted on while they read.
      const acting = await api.post<{ id: string; code: string }>('/api/projects', { code: actsCode, name: `Walk set ${n} acts` })
      for (const [i, file] of files.entries()) {
        await uploadAndRead(page, api, acting, file, i > 0 ? () => actWhileReading(page, api, acting, record.acts) : undefined)
      }
      await page.goto(`/p/${project.code}/takeoff/1`)
    }
  } finally {
    writeWalk(snapshotOut, snapshot)
    writeWalk(conflictsOut, conflicts)
    writeWalk(out, walk) // last: walk.json's existence is what the run waits on
  }
})
