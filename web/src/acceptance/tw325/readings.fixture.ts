/*
 * Ticket T-W325's acceptance fake (S15-W6, #548): the readings the Projects list (docs/design/m0-screens.md
 * §4.3) words each row from, laid over the seed's FakeApi once more, in memory:
 *
 *   GET /api/projects                              ProjectOut[] with `updated_at` (vextrus/projects/http/projects.py)
 *   GET /api/projects/{id}/drawings/files          FilesOut          (vextrus/drawings/http/files.py)
 *   GET /api/projects/{id}/takeoff/step1/progress  Step1ProgressOut  (vextrus/takeoff/http/step1.py)
 *   GET /api/activity?project={id}&limit=n         ActOut[]          (vextrus/platform/http/activity.py)
 *
 * `updated_at` is the time of the project's newest DomainEvent, as the API sends it to every role
 * (vextrus/projects/tests/acceptance/ts15w6 pins the API's side): the newest of its creation (an event
 * of its own) and the acts on it (`act`), never an act on another project or on none.
 *
 * and `GET …/drawings/disciplines` (the Drawing Set page a new project lands on asks it). Every shape is
 * typed from `@/api/schema.gen`, so a drift from the real schema fails `tsc`. Any project the fake has
 * no data for answers an empty Drawing Set and an empty progress, so a project created during a test
 * has both. The activity honours `project` and `limit` (the base fake ignores `project`), refuses a
 * project the member may not open with 404 as the API's project scope does, and leaves a role without
 * the acts grant (Vextrus Engineer, Guest) to the base fake, which refuses it 403. Every request that
 * reaches the API is recorded, path and query, so a test can say what was and was not asked.
 *
 *   const api = new FakeApi(); const readings = new FakeReadings(api)
 *   readings.setFiles('KR-01', [aFile('ground.dwg', 'read')]); readings.fail('BP-02', 'progress', 500)
 *
 * Every name, number and date here and in the tests is invented.
 */
import type { components } from '@/api/schema.gen'
import { PEOPLE, type FakeApi } from '@/app/seed/api.fixture'
import { MARKET_DISCIPLINES } from '../t20b/drawings.fixture'

type Schemas = components['schemas']
export type FilesOut = Schemas['FilesOut']
export type FileOut = Schemas['FileOut']
export type ProgressOut = Schemas['Step1ProgressOut']
export type ProgressRow = Schemas['Step1DisciplineProgressOut']
export type ActOut = Schemas['ActOut']
export type Reading = 'files' | 'progress' | 'activity'
/** A project as `GET /api/projects` lists it for S15-W6: with the time of its newest DomainEvent. */
export type ProjectListed = Schemas['ProjectOut'] & { updated_at: string }

let serial = 0
const nextId = (block: string) => {
  serial += 1
  return `${block}-0000-4000-8000-${String(serial).padStart(12, '0')}`
}

/** Each state's status line as 14 sends it (the list never shows it; a real file carries one). */
const STATUS: Record<string, Schemas['Message']> = {
  waiting: { code: 'drawings.files.waiting', params: { ahead: 0 } },
  reading: { code: 'drawings.files.reading_drawing', params: {} },
  stopping: { code: 'drawings.files.stopping', params: {} },
  retrying: {
    code: 'drawings.files.retrying',
    params: { attempt: 1, tries: 3 },
  },
  read: { code: 'drawings.files.read', params: {} },
  held: { code: 'drawings.files.held', params: {} },
  failed: { code: 'drawings.files.failed', params: { tries: 3 } },
  unreadable: { code: 'drawings.files.failed', params: { tries: 1 } },
  refused: { code: 'drawings.files.refused_scan', params: {} },
  cancelled: { code: 'drawings.files.cancelled_unnamed', params: {} },
}

/** A file in one of 4.5's states; a name ending ".pdf" is a PDF. */
export function aFile(name: string, state: string, over: Partial<FileOut> = {}): FileOut {
  return {
    id: nextId('f3250000'),
    name,
    format: name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'dwg',
    size: 2_400_000,
    discipline: 'structural',
    state,
    status: STATUS[state] ?? { code: 'drawings.files.read', params: {} },
    finding: null,
    sheets_found: state === 'read' ? 6 : null,
    plot_for: [],
    added_at: '2026-09-05T04:00:00Z',
    added_by_name: 'Mahfuza Alam',
    added_by_vextrus: false,
    marked_for_vextrus: false,
    ...over,
  }
}

/** `n` files in `state`, named `<stem>-<i>.dwg`. */
export function files(n: number, state: string, stem: string = state, over: Partial<FileOut> = {}): FileOut[] {
  return Array.from({ length: n }, (_, i) => aFile(`${stem}-${i + 1}.dwg`, state, over))
}

/** One Discipline's Step 1 progress row; `confirmed` is the sheets decided, `status` the StepProgress's. */
export function aRow(discipline: string | null, over: Partial<ProgressRow> = {}): ProgressRow {
  const found = over.found ?? 0
  return {
    discipline,
    confirmed: 0,
    found,
    listed: null,
    lists_disagree: false,
    total: found,
    open_questions: 0,
    status: found === 0 ? 'not_started' : 'in_review',
    outstanding: [],
    plots: [],
    ...over,
  }
}

/** A Discipline every sheet of which the QS confirmed (m0-screens 6.11). */
export function confirmedRow(discipline: string, found: number): ProgressRow {
  return aRow(discipline, { found, confirmed: found, status: 'confirmed' })
}

export function progressOut(rows: ProgressRow[], notReceived: string[] = []): ProgressOut {
  return { disciplines: rows, not_received: notReceived, qs: ['Mahfuza Alam'] }
}

const EMPTY_SUMMARY: Schemas['Message'] = {
  code: 'drawings.files.summary',
  params: { files: 0, sheets: 0, reading: 0, failed: 0, held: 0, refused: 0 },
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export class FakeReadings {
  /** The files per project id; a project not here has none. */
  private filesBy = new Map<string, FileOut[]>()
  private progressBy = new Map<string, ProgressOut>()
  /** A reading that answers this status, every time, per "projectId reading". */
  private failing = new Map<string, number>()
  /** Every request that reached the API: "METHOD /path?query". */
  readonly seen: string[] = []
  /** The JSON body of every POST /api/projects (a project created). */
  readonly created: unknown[] = []

  private readonly api: FakeApi

  constructor(api: FakeApi) {
    this.api = api
    const base = api.handle
    api.handle = async (request: Request) => {
      const url = new URL(request.url, location.origin)
      this.seen.push(`${request.method} ${url.pathname}${url.search}`)
      if (request.method === 'POST' && url.pathname === '/api/projects') this.created.push(await request.clone().json())
      if (api.offline) return base(request)
      if (request.method === 'GET' && url.pathname === '/api/projects') return this.projectsWithUpdated(await base(request))
      const answer = this.answer(request.method, url)
      if (!answer) return base(request)
      if (api.latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, api.latencyMs))
      return answer()
    }
  }

  id(code: string): string {
    return this.api.project(code).id
  }

  setFiles(code: string, list: FileOut[]): void {
    this.filesBy.set(this.id(code), list)
  }

  filesOf(code: string): FileOut[] {
    return this.filesBy.get(this.id(code)) ?? []
  }

  setProgress(code: string, rows: ProgressRow[], notReceived: string[] = []): void {
    this.progressBy.set(this.id(code), progressOut(rows, notReceived))
  }

  /** Every request for `reading` of project `code` answers `status` from now on. */
  fail(code: string, reading: Exclude<Reading, 'activity'>, status: number): void {
    this.failing.set(`${this.id(code)} ${reading}`, status)
  }

  /** An act on project `code`, at `at`: one DomainEvent (a file's, or a Step 1 act's once S15-A3 lands); the activity lists it for that project only. */
  act(code: string, at: string): void {
    const project = this.api.project(code)
    const actor = this.api.users.find((u) => u.email === PEOPLE.qs) ?? null
    this.api.addAct(project.tenant, 'drawings.files.discipline_changed', actor?.id ?? null, null, at, project.id)
  }

  /** The time of the project's newest DomainEvent: its creation's, or the newest act on it. */
  updatedAt(projectId: string): string {
    const project = this.api.projects.find((p) => p.id === projectId)!
    const times = [project.createdAt, ...this.api.acts.filter((a) => a.tenant === project.tenant && a.projectId === projectId).map((a) => a.at)]
    return times.reduce((newest, at) => (Date.parse(at) > Date.parse(newest) ? at : newest))
  }

  /** The base fake's project list, each project with its `updated_at`; a refusal as it came. */
  private async projectsWithUpdated(listed: Response): Promise<Response> {
    if (!listed.ok) return listed
    const projects = (await listed.json()) as Schemas['ProjectOut'][]
    const body: ProjectListed[] = projects.map((p) => ({ ...p, updated_at: this.updatedAt(p.id) }))
    return json(200, body)
  }

  /** The recorded requests for one reading, of one project when `code` is given. */
  calls(reading: Reading, code?: string): string[] {
    const id = code === undefined ? null : this.id(code)
    return this.seen.filter((call) => {
      if (reading === 'activity') return call.startsWith('GET /api/activity') && (id === null || new URL(call.slice(4), location.origin).searchParams.get('project') === id)
      const tail = reading === 'files' ? '/drawings/files' : '/takeoff/step1/progress'
      const m = /^GET \/api\/projects\/([^/]+)(\/[^?]*)/.exec(call)
      return m !== null && m[2] === tail && (id === null || m[1] === id)
    })
  }

  count(reading: Reading, code?: string): number {
    return this.calls(reading, code).length
  }

  /** Every project id a recorded request named, in its path or its `project` query. */
  projectIdsAsked(): Set<string> {
    const ids = new Set<string>()
    for (const call of this.seen) {
      const url = new URL(call.slice(call.indexOf(' ') + 1), location.origin)
      const m = /^\/api\/projects\/([^/]+)\//.exec(url.pathname)
      if (m) ids.add(m[1]!)
      const project = url.searchParams.get('project')
      if (project) ids.add(project)
    }
    return ids
  }

  /** The member acting now, as the API's guard reads the session. */
  private acting() {
    const { userId, developerId } = this.api.session
    if (!userId || !developerId) return null
    const now = this.api.now()
    return (
      this.api.memberships.find((m) => m.userId === userId && m.tenant === developerId && m.revokedAt === null && (m.expiresAt === null || Date.parse(m.expiresAt) > now)) ?? null
    )
  }

  private mayOpen(projectId: string): boolean {
    const m = this.acting()
    if (!m) return false
    const project = this.api.projects.find((p) => p.id === projectId && p.tenant === m.tenant)
    return project !== undefined && (m.projectIds.length === 0 || m.projectIds.includes(projectId))
  }

  /** This fake's answer, or null to leave the request to the base fake. */
  private answer(method: string, url: URL): (() => Response) | null {
    if (method !== 'GET') return null
    if (url.pathname === '/api/activity') return this.activity(url.searchParams)
    const m = /^\/api\/projects\/([^/]+)\/(drawings\/files|drawings\/disciplines|takeoff\/step1\/progress)$/.exec(url.pathname)
    if (!m) return null
    const [, projectId, rest] = m as unknown as [string, string, string]
    // Signed out, no Developer, or a project not theirs: the base fake's guard answers (401, 403, 404).
    if (!this.mayOpen(projectId)) return null
    if (rest === 'drawings/disciplines') return () => json(200, MARKET_DISCIPLINES)
    const reading = rest === 'drawings/files' ? 'files' : 'progress'
    const failing = this.failing.get(`${projectId} ${reading}`)
    if (failing !== undefined) {
      return () =>
        failing >= 500
          ? new Response('Server Error', {
              status: failing,
              headers: { 'Content-Type': 'text/html' },
            })
          : json(failing, { code: 'platform.auth.not_found', params: {} })
    }
    if (reading === 'files') {
      const list = this.filesBy.get(projectId) ?? []
      const body: FilesOut = {
        set_id: list.length ? `5e700000-0000-4000-8000-${projectId.slice(-12)}` : null,
        summary: EMPTY_SUMMARY,
        files: list,
      }
      return () => json(200, body)
    }
    const progress = this.progressBy.get(projectId) ?? progressOut([])
    return () => json(200, progress)
  }

  private activity(query: URLSearchParams): (() => Response) | null {
    const viewer = this.acting()
    // No session, no Developer, or no acts grant: the base fake refuses exactly as it always has.
    if (!viewer || !['qs', 'md'].includes(viewer.role)) return null
    const project = query.get('project')
    if (project === null) return null
    if (!this.mayOpen(project)) return () => json(404, { code: 'platform.auth.not_found', params: {} })
    const limit = Math.min(Number(query.get('limit') ?? 50), 200)
    const acts = this.api.acts
      .filter((a) => a.tenant === viewer.tenant && a.projectId === project)
      .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
      .slice(0, limit)
      .map((a): ActOut => {
        const actor = this.api.users.find((u) => u.id === a.actorId)
        const role = actor ? (this.api.memberships.find((m) => m.userId === actor.id && m.tenant === a.tenant)?.role ?? null) : null
        return {
          id: a.id,
          code: a.code,
          params: {
            by: actor ? 'person' : 'vextrus',
            actor: actor?.name ?? '',
          },
          actor: actor
            ? {
                id: actor.id,
                name: actor.name,
                role,
                vextrus: role === 'vextrus_engineer',
              }
            : null,
          project_id: a.projectId,
          building_id: null,
          subject_type: 'project',
          subject_id: a.projectId,
          occurred_at: a.at,
        }
      })
    return () => json(200, acts)
  }
}

// The seam the tests read: the rendered list (m0-screens §4.3's table), its header and its cells. -------

/** Bidi marks and isolates out, runs of space as one. */
export const clean = (s: string | null | undefined) =>
  (s ?? '')
    .replace(/[⁦-⁩‎‏]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export const COLUMNS = ['Code', 'Name', 'Address', 'Drawing Set', 'Takeoff', 'Updated'] as const
export type Column = (typeof COLUMNS)[number]

export function listbox(): HTMLElement {
  const list = document.querySelector<HTMLElement>('[role="listbox"]')
  if (!list) throw new Error('no Projects list on the page')
  return list
}

/** The table's header row: the element before the list, as the page draws it. */
export function headerRow(): HTMLElement {
  return listbox().parentElement!.firstElementChild as HTMLElement
}

export function rows(): HTMLElement[] {
  return [...listbox().querySelectorAll<HTMLElement>('[role="option"]')]
}

export function rowOf(code: string): HTMLElement {
  const row = rows().find((r) => clean(r.textContent).startsWith(code))
  if (!row) throw new Error(`no row for ${code}`)
  return row
}

/**
 * The row's cell under `column`: the outermost element of the row lying exactly under that header
 * cell (the header and the rows share one grid, so each cell is as wide as its header).
 */
export function cellOf(row: HTMLElement, column: Column): HTMLElement {
  const head = headerRow().children[COLUMNS.indexOf(column)] as HTMLElement | undefined
  if (!head) throw new Error(`no header cell for ${column}`)
  const h = head.getBoundingClientRect()
  const under = [...row.querySelectorAll<HTMLElement>('*')].find((el) => {
    const r = el.getBoundingClientRect()
    return Math.abs(r.left - h.left) <= 1.5 && Math.abs(r.right - h.right) <= 1.5 && r.height > 0
  })
  if (!under) throw new Error(`no cell of ${clean(row.textContent).slice(0, 5)} under ${column}`)
  return under
}

export function cellText(code: string, column: Column): string {
  return clean(cellOf(rowOf(code), column).textContent)
}

/** The full text a truncated cell offers: its own `title`, or the one element inside it with one. */
export function cellTitle(cell: HTMLElement): string | null {
  const titled = cell.hasAttribute('title') ? cell : cell.querySelector<HTMLElement>('[title]')
  return titled ? clean(titled.getAttribute('title')) : null
}
