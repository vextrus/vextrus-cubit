/*
 * Ticket 20b's acceptance fake: the Drawing Set's API as 14 (`vextrus/drawings/http/files.py`, on main)
 * and 21a (`vextrus/takeoff/http/upload.py`, reviewed head 1d3d387a) answer it, in memory, laid over the
 * seed's FakeApi for everything else (session, projects). Shapes are the schema's: `FilesOut`,
 * `FileOut`, `ReportOut`, `DisciplineOut`, `UploadOut`, and every refusal `{code, params}`.
 *
 *   const api = new FakeApi(); const set = new FakeDrawingSet(api, 'KR-01'); set.files.push(file({...}))
 *   set.answerUpload('site-plan.jpg', 415, refusalOf('drawings.uploads.not_a_drawing', { file: 'site-plan.jpg' }))
 */
import type { FakeApi } from '@/app/seed/api.fixture'

export interface Msg {
  code: string
  params: Record<string, string | number>
}

export const msg = (code: string, params: Record<string, string | number> = {}): Msg => ({ code, params })
export const refusalOf = msg

export interface FileOut {
  id: string
  name: string
  format: 'dwg' | 'pdf'
  size: number
  discipline: string | null
  state: string
  status: Msg
  finding: Msg | null
  sheets_found: number | null
  plot_for: string[]
  added_at: string
  added_by_name: string
  added_by_vextrus: boolean
}

export interface ReportOut {
  file: FileOut
  readers: Msg[]
  sheets: Msg[]
  bangla: Msg[]
  fonts: Msg[]
  font_rows: { asked: Msg; how_close: Msg; texts: number }[]
  plot: Msg[]
  made_by: Msg[]
  pages: Msg[]
}

let serial = 0
export function file(over: Partial<FileOut> & Pick<FileOut, 'name' | 'state' | 'status'>): FileOut {
  serial += 1
  return {
    id: `00000000-0000-4000-8000-${String(serial).padStart(12, '0')}`,
    format: over.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'dwg',
    size: 1_000_000,
    discipline: 'structural',
    finding: null,
    sheets_found: null,
    plot_for: [],
    added_at: '2026-09-26T05:00:00Z',
    added_by_name: 'Nusrat Jahan',
    added_by_vextrus: false,
    ...over,
  }
}

/** The Market's Disciplines as 14's Library rows serve them (keys and one name per language). */
export const MARKET_DISCIPLINES = [
  ['structural', 'Structural'],
  ['architectural', 'Architectural'],
  ['electrical', 'Electrical'],
  ['plumbing', 'Plumbing and sanitary'],
  ['fire', 'Fire'],
  ['mechanical', 'Mechanical (HVAC)'],
  ['lift', 'Lift'],
  ['gas', 'Gas'],
].map(([key, name]) => ({ key: key!, labels: { en: name! } }))

export class FakeDrawingSet {
  files: FileOut[] = []
  summary: Msg = msg('drawings.files.summary', { files: 0, sheets: 0, reading: 0, failed: 0, held: 0, refused: 0 })
  disciplines = MARKET_DISCIPLINES
  reports = new Map<string, Partial<ReportOut>>()
  /** Every drawings request, "METHOD /path" and its JSON body when it had one. */
  seen: { call: string; body: unknown }[] = []
  /** The upload's answer per file name; a file not named here is added (201). */
  private uploads = new Map<string, { status: number; body: unknown }>()
  /** Cancel's and restart's answers per file id: the file as it becomes. */
  afterCancel = new Map<string, FileOut>()
  afterRestart = new Map<string, FileOut>()
  /** While set, the files list never answers (the page's Loading state). */
  hang = false
  readonly projectId: string

  constructor(api: FakeApi, projectCode: string) {
    this.projectId = api.project(projectCode).id
    const base = api.handle
    api.handle = async (request: Request) => {
      const url = new URL(request.url, location.origin)
      const prefix = `/api/projects/${this.projectId}/drawings`
      if (!url.pathname.startsWith(prefix)) return base(request)
      // A refusal a test queued with `api.failOnce` answers first, as it does for every other request.
      const queued = (api as unknown as { once: { match: (method: string, path: string) => boolean }[] }).once
      if (queued.some((o) => o.match(request.method, url.pathname))) return base(request)
      return this.answer(request, url.pathname.slice(prefix.length), api)
    }
  }

  answerUpload(name: string, status: number, body: unknown): void {
    this.uploads.set(name, { status, body })
  }

  private async answer(request: Request, rest: string, api: FakeApi): Promise<Response> {
    const method = request.method
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
    let body: unknown = null
    if (method !== 'GET' && method !== 'HEAD' && (request.headers.get('Content-Type') ?? '').includes('application/json')) {
      body = await request.clone().json()
    }
    this.seen.push({ call: `${method} ${rest}`, body })
    if (method !== 'GET' && request.headers.get('X-CSRFToken') !== api.csrf) {
      return json(403, msg('platform.auth.csrf_failed'))
    }
    if (method === 'GET' && rest === '/disciplines') return json(200, this.disciplines)
    if (method === 'GET' && rest === '/files') {
      if (this.hang) return new Promise<Response>(() => {})
      return json(200, { set_id: this.files.length ? 'set-1' : null, summary: this.summary, files: this.files })
    }
    if (method === 'POST' && rest === '/files') {
      const form = await request.formData()
      const part = form.get('file')
      if (!(part instanceof File)) return json(400, msg('drawings.uploads.stopped'))
      this.seen[this.seen.length - 1]!.body = { file: part.name }
      const set = this.uploads.get(part.name)
      if (set) return json(set.status, set.body)
      const added = file({ name: part.name, state: 'waiting', status: msg('drawings.files.waiting', { ahead: 0 }) })
      this.files.push(added)
      return json(201, { file: added, outcome: 'added', message: null })
    }
    const one = /^\/files\/([^/]+)(\/[a-z]+)?$/.exec(rest)
    const found = one && this.files.find((f) => f.id === one[1])
    if (!one || !found) return json(404, msg('platform.auth.not_found'))
    const act = one[2] ?? ''
    const replace = (next: FileOut) => {
      this.files = this.files.map((f) => (f.id === next.id ? next : f))
      return json(200, next)
    }
    if (method === 'GET' && act === '') return json(200, found)
    if (method === 'POST' && act === '/cancel') return replace(this.afterCancel.get(found.id) ?? found)
    if (method === 'POST' && act === '/restart') return replace(this.afterRestart.get(found.id) ?? found)
    if (method === 'PUT' && act === '/discipline') {
      const key = (body as { discipline?: string } | null)?.discipline ?? ''
      if (!this.disciplines.some((d) => d.key === key)) return json(400, msg('drawings.files.discipline_unknown'))
      return replace({ ...found, discipline: key })
    }
    if (method === 'GET' && act === '/report') {
      const r = this.reports.get(found.id) ?? {}
      return json(200, { file: found, readers: [], sheets: [], bangla: [], fonts: [], font_rows: [], plot: [], made_by: [], pages: [], ...r })
    }
    return json(404, msg('platform.auth.not_found'))
  }
}
