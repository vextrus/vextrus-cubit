/*
 * Ticket 22's acceptance fake: Step 1's API as 19a answers it (`vextrus/takeoff/http/step1.py`,
 * `vextrus/takeoff/schemas/step1.py`, on main fb4b7f2d) and the sheet's render as 14 serves it
 * (`vextrus/drawings/http/sheets.py`), in memory, laid over the seed's FakeApi for everything else.
 * Its rows are KR-01 after reading (docs/design/m0-screens.md §7): 24 sheets (Structural 13,
 * Architectural 8, Electrical 3), five Questions, Coverage 70 views, the Disciplines not yet received.
 *
 * Shapes are 19a's (`Step1ProposalOut`, `Step1QuestionOut`, `Step1CoverageOut`, `Step1ProgressOut`,
 * `Step1ActOut`, `Step1ParsedListOut`, `Step1DrawingListOut`) and every refusal `{code, params}`, with
 * ONE field chosen by the acceptance writer: `agrees` on a Proposal (two sources agree, so it joins
 * the bulk act; m0-screens §5 "What 'agrees' means"). 19a's Proposal has no such field and the bulk
 * act ("Confirm 16, leave out 1 ↵") cannot be told from its other fields; the builder adds it to 19a's
 * schema (the report names it).
 */
import type { FakeApi } from '@/app/seed/api.fixture'
import { fixtureBuffer } from '../t16/sheet.fixture'

export interface Msg {
  code: string
  params: Record<string, unknown>
}
export const msg = (code: string, params: Record<string, unknown> = {}): Msg => ({ code, params })

export interface ProposalOut {
  id: string
  sheet_id: string
  number: string | null
  title: string
  revision_mark: string
  revision_mark_source: string | null
  issue_date: string
  discipline: string | null
  file_id: string
  file_name: string
  kind: string | null
  jev_pick: { choice: string; options: string[] } | null
  held: boolean
  proposed_exclusion: string | null
  decision: 'confirmed' | 'excluded' | null
  confirmed_kind: string | null
  excluded_reason: string | null
  excluded_text: string
  decided_by: string | null
  decided_at: string | null
  /** Chosen by the acceptance writer (see the header). */
  agrees: boolean
}

export interface QuestionOut {
  id: string
  kind: string
  status: string
  code: string
  params: Record<string, unknown>
  options: { key: string; picked: boolean }[]
  discipline: string | null
  subject_id: string | null
  check_code: string | null
  answer: unknown
  answered_at: string | null
}

let serial = 0
const uuid = (block: string) => {
  serial += 1
  return `${block}-0000-4000-8000-${String(serial).padStart(12, '0')}`
}

const FILES = {
  str: { id: uuid('d1000000'), name: 'KR-STR-R0.dwg' },
  arc: { id: uuid('d1000000'), name: 'KR-ARC-R0.dwg' },
  ele: { id: uuid('d1000000'), name: 'KR-ELE-R0.dwg' },
  old: { id: uuid('d1000000'), name: 'KR-STR-old.dwg' },
}

function sheet(
  file: keyof typeof FILES,
  discipline: string,
  number: string | null,
  title: string,
  over: Partial<ProposalOut> = {},
): ProposalOut {
  return {
    id: uuid('a2200000'),
    sheet_id: uuid('b2200000'),
    number,
    title,
    revision_mark: 'R0',
    revision_mark_source: 'file_name',
    issue_date: '',
    discipline,
    file_id: FILES[file].id,
    file_name: FILES[file].name,
    kind: null,
    jev_pick: null,
    held: false,
    proposed_exclusion: null,
    decision: null,
    confirmed_kind: null,
    excluded_reason: null,
    excluded_text: '',
    decided_by: null,
    decided_at: null,
    agrees: true,
    ...over,
  }
}

/** The longest seeded title (§8 item 6: the toolbar's one line at 1280 is tested with it). */
export const LONGEST_TITLE = 'COLUMN LAYOUT, PILE CAP TO 2ND FLOOR'

/** KR-01's sheets after reading, in 19a's order (Discipline, then number in natural order). */
export function kr01Proposals(): ProposalOut[] {
  return [
    sheet('str', 'structural', 'S-01', 'GENERAL NOTES'),
    sheet('str', 'structural', 'S-02', 'PILE LAYOUT'),
    sheet('str', 'structural', 'S-03', 'PILE CAP LAYOUT'),
    sheet('str', 'structural', 'S-04', 'GROUND FLOOR BEAM LAYOUT'),
    sheet('str', 'structural', 'S-05', '1ST FLOOR BEAM LAYOUT'),
    sheet('str', 'structural', 'S-06', '3RD, 5TH & 7TH FLOOR BEAM LAYOUT'),
    sheet('str', 'structural', 'S-07', 'TYPICAL FLOOR SLAB LAYOUT', { revision_mark: 'B', revision_mark_source: 'title_block', issue_date: '2026-08-20', agrees: false }),
    sheet('str', 'structural', 'S-07', 'TYPICAL FLOOR SLAB LAYOUT', { revision_mark: 'A', revision_mark_source: 'title_block', agrees: false }),
    sheet('str', 'structural', 'S-08', LONGEST_TITLE),
    sheet('str', 'structural', 'S-09', 'COLUMN SCHEDULE'),
    sheet('str', 'structural', 'S-10', 'STAIR DETAILS'),
    sheet('str', 'structural', 'S-11', 'ROOF BEAM LAYOUT'),
    sheet('str', 'structural', 'S-12', 'OVERHEAD TANK AND LIFT MACHINE ROOM'),
    sheet('arc', 'architectural', 'A-01', 'SITE PLAN'),
    sheet('arc', 'architectural', 'A-02', 'GROUND FLOOR PLAN'),
    sheet('arc', 'architectural', 'A-03', 'TYPICAL FLOOR PLAN'),
    sheet('arc', 'architectural', 'A-04', 'ROOF PLAN'),
    sheet('arc', 'architectural', 'A-05', 'SECTION A-A & ELEVATION', { agrees: false }),
    sheet('arc', 'architectural', 'A-06', 'FRONT ELEVATION'),
    sheet('arc', 'architectural', 'A-07', '3D VIEW', { proposed_exclusion: 'for_information' }),
    sheet('arc', 'architectural', null, 'DOOR AND WINDOW SCHEDULE', { agrees: false }),
    sheet('ele', 'electrical', 'E-01', 'ELECTRICAL LEGEND AND NOTES', { agrees: false }),
    sheet('ele', 'electrical', 'E-02', 'TYPICAL FLOOR LIGHTING AND POWER LAYOUT', { agrees: false }),
    sheet('ele', 'electrical', 'E-03', 'TYPICAL FLOOR LIGHTING AND POWER LAYOUT', { agrees: false }),
  ]
}

const opts = (keys: string[], picked: string | null = null) => keys.map((key) => ({ key, picked: key === picked }))

function question(kind: string, code: string, params: Record<string, unknown>, options: { key: string; picked: boolean }[], discipline: string | null, subject: string | null, check: string | null = null): QuestionOut {
  return { id: uuid('c2200000'), kind, status: 'open', code, params, options, discipline, subject_id: subject, check_code: check, answer: null, answered_at: null }
}

export class FakeStep1 {
  proposals: ProposalOut[] = kr01Proposals()
  questions: QuestionOut[]
  coverage = { views: 70, assigned: 0, excluded: 0, proposed: 68, unaccounted: 2, used: 0, by_step: { '1': 1, '5': 12, '6': 14 } as Record<string, number>, by_reason: { for_information: 25 } as Record<string, number> }
  notReceived = ['plumbing', 'fire', 'lift']
  /** The drawing list per Discipline, as `GET …/drawing-list?discipline=` answers. */
  lists: Record<string, { source: string | null; numbers: string[]; entered_by: string | null; entered_at: string | null; read_numbers: string[] | null }> = {
    structural: { source: 'sheet', numbers: Array.from({ length: 13 }, (_, i) => `S-${String(i + 1).padStart(2, '0')}`), entered_by: null, entered_at: null, read_numbers: Array.from({ length: 13 }, (_, i) => `S-${String(i + 1).padStart(2, '0')}`) },
  }
  /** Every Step 1 or render request: "METHOD /rest" (rest after the project's prefix) and its body. */
  seen: { call: string; body: unknown }[] = []
  /** The acts done, newest last; undo takes back the newest. */
  private done: { ids: string[]; act: string; sheets: number }[] = []
  /** The next request to `rest` answers this, once. */
  private once = new Map<string, { status: number; body: unknown }>()
  /** Who acts, by name (the fake does not check the role: `FakeApi`'s session does that below). */
  actor = 'Nusrat Jahan'
  readonly projectId: string

  constructor(api: FakeApi, projectCode = 'KR-01', empty = false) {
    this.projectId = api.project(projectCode).id
    const s07b = this.proposals[6]!
    const byNumber = (n: string | null, title?: string) => this.proposals.find((p) => p.number === n && (!title || p.title === title))!
    this.questions = [
      question('file_misread', 'engine.agree.disagree', { items: 0, only_first: 0, only_second: 0, kinds: 0, layers: 0, unread: 0 }, opts(['read_anyway', 'await_resaved', 'sent_to_vextrus', 'keep_open']), 'structural', FILES.old.id),
      question('conflict', 'engine.conflicts.same_number', { number: 'S-07', copies: 2 }, opts(['keep_b', 'keep_a', 'keep_both', 'keep_open'], 'keep_b'), 'structural', s07b.sheet_id),
      question('missing', 'takeoff.step1.no_number', {}, opts(['no_number', 'type_number', 'keep_open']), 'architectural', byNumber(null).sheet_id),
      question('low_confidence', 'takeoff.step1.which_kind', { number: 'A-05' }, opts(['elevation', 'section', 'floor_plan', 'keep_open']), 'architectural', byNumber('A-05').sheet_id),
      question('check', 'engine.register_check.not_found', { number: 'S-13' }, opts(['not_sent_yet', 'not_in_set', 'file_not_added', 'keep_open']), 'structural', null, 'register'),
    ]
    if (empty) {
      this.proposals = []
      this.questions = []
      this.coverage = { views: 0, assigned: 0, excluded: 0, proposed: 0, unaccounted: 0, used: 0, by_step: {}, by_reason: {} }
      this.lists = {}
    }
    const base = api.handle
    api.handle = async (request: Request) => {
      const url = new URL(request.url, location.origin)
      const step1 = `/api/projects/${this.projectId}/takeoff/step1`
      const sheets = `/api/projects/${this.projectId}/drawings/sheets/`
      if (url.pathname.startsWith(step1)) return this.answer(request, url, url.pathname.slice(step1.length), api)
      if (url.pathname.startsWith(sheets) && url.pathname.endsWith('/render')) {
        this.seen.push({ call: `GET ${url.pathname.slice(`/api/projects/${this.projectId}`.length)}`, body: null })
        return new Response(await fixtureBuffer('tiny-sheet'), { status: 200, headers: { 'Content-Type': 'application/octet-stream' } })
      }
      return base(request)
    }
  }

  /** The next request to `rest` (e.g. "POST /undo") answers `status` with `body`, once. */
  answerOnce(call: string, status: number, body: unknown): void {
    this.once.set(call, { status, body })
  }

  /** Every call made, "METHOD /rest". */
  calls(): string[] {
    return this.seen.map((s) => s.call)
  }

  /** Structural and Architectural settled (the QS's walk, §7), Electrical still to confirm. */
  settleAllBut(discipline: string): void {
    for (const p of this.proposals) {
      if (p.discipline === discipline) continue
      if (p.number === 'S-07' && p.revision_mark === 'A') Object.assign(p, { decision: 'excluded', excluded_reason: 'superseded', decided_by: 'Nusrat Jahan', decided_at: '2026-09-26T05:00:00Z' })
      else if (p.proposed_exclusion) Object.assign(p, { decision: 'excluded', excluded_reason: p.proposed_exclusion, decided_by: 'Nusrat Jahan', decided_at: '2026-09-26T05:00:00Z' })
      else Object.assign(p, { decision: 'confirmed', decided_by: 'Nusrat Jahan', decided_at: '2026-09-26T05:00:00Z' })
    }
    for (const q of this.questions) {
      if (q.discipline === discipline) continue
      Object.assign(q, { status: 'answered', answer: q.options[0]!.key, answered_at: '2026-09-26T05:00:00Z' })
    }
    this.coverage = { ...this.coverage, assigned: 39, excluded: 28, proposed: 3, unaccounted: 0 }
  }

  private progress() {
    const order = ['structural', 'architectural', 'electrical']
    return {
      disciplines: order
        .filter((d) => this.proposals.some((p) => p.discipline === d))
        .map((d) => {
          const mine = this.proposals.filter((p) => p.discipline === d)
          const list = this.lists[d]
          const listed = list ? list.numbers.length : null
          return {
            discipline: d,
            confirmed: mine.filter((p) => p.decision !== null).length,
            found: mine.length,
            listed,
            lists_disagree: false,
            total: listed ?? mine.length,
            open_questions: this.questions.filter((q) => q.discipline === d && q.status === 'open').length,
          }
        }),
      count: this.count(),
      not_received: this.notReceived,
    }
  }

  /**
   * The header's Count as the server sends it (S15-A4: the web derives none): every sheet that is not
   * a blank layout (proposed out as `blank`), numbered or not, decided or not; of those the confirmed
   * and the excluded.
   */
  private count() {
    const counted = this.proposals.filter((p) => p.proposed_exclusion !== 'blank')
    return {
      found: counted.length,
      confirmed: counted.filter((p) => p.decision === 'confirmed').length,
      excluded: counted.filter((p) => p.decision === 'excluded').length,
    }
  }

  private async answer(request: Request, url: URL, rest: string, api: FakeApi): Promise<Response> {
    const method = request.method
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
    let body: Record<string, unknown> = {}
    if (method !== 'GET') body = ((await request.clone().json().catch(() => ({}))) ?? {}) as Record<string, unknown>
    const call = `${method} ${rest}`
    this.seen.push({ call, body: method === 'GET' ? null : body })
    // The session and its role are the base API's, as 07's guard reads them.
    if (!api.session.userId) return json(401, msg('platform.auth.signed_out'))
    const role = api.memberships.find((m) => m.userId === api.session.userId && m.tenant === api.session.developerId && m.revokedAt === null)?.role ?? ''
    if (method !== 'GET' && request.headers.get('X-CSRFToken') !== api.csrf) return json(403, msg('platform.auth.csrf_failed'))
    if (method !== 'GET' && (role === 'md' || role === 'guest')) return json(403, msg('platform.auth.forbidden'))
    const forced = this.once.get(call)
    if (forced) {
      this.once.delete(call)
      return json(forced.status, forced.body)
    }
    const at = new Date(api.now()).toISOString()
    if (method === 'GET' && rest === '/proposals') return json(200, { proposals: this.proposals })
    if (method === 'GET' && rest === '/questions') return json(200, { questions: this.questions })
    if (method === 'GET' && rest === '/coverage') return json(200, this.coverage)
    if (method === 'GET' && rest === '/progress') return json(200, this.progress())
    if (rest === '/confirm' || rest === '/exclude') {
      const ids = (body.proposals as string[] | undefined) ?? []
      if (ids.length === 0) return json(400, msg('takeoff.step1.nothing_chosen'))
      const hit = this.proposals.filter((p) => ids.includes(p.id))
      if (hit.length !== ids.length) return json(404, msg('platform.auth.not_found'))
      for (const p of hit) {
        if (rest === '/confirm') Object.assign(p, { decision: 'confirmed', excluded_reason: null, excluded_text: '', decided_by: this.actor, decided_at: at })
        else Object.assign(p, { decision: 'excluded', excluded_reason: body.reason, excluded_text: body.reason === 'other' ? (body.text ?? '') : '', decided_by: this.actor, decided_at: at })
      }
      const act = rest === '/confirm' ? 'confirmed' : 'excluded'
      this.done.push({ ids, act, sheets: ids.length })
      return json(200, { confirmation_id: uuid('e2200000'), act, sheets: ids.length, by: this.actor, at })
    }
    if (method === 'POST' && rest === '/undo') {
      const last = this.done.pop()
      if (!last) return json(409, msg('takeoff.step1.nothing_to_undo'))
      for (const p of this.proposals.filter((x) => last.ids.includes(x.id))) Object.assign(p, { decision: null, excluded_reason: null, excluded_text: '', decided_by: null, decided_at: null })
      return json(200, { confirmation_id: uuid('e2200000'), act: last.act, sheets: last.sheets, by: this.actor, at })
    }
    if (rest === '/drawing-list/read' || (method === 'POST' && rest === '/drawing-list')) {
      const discipline = String(body.discipline ?? '')
      const text = String(body.text ?? '')
      const parsed = parse(text)
      if (rest === '/drawing-list/read') return json(200, { discipline, ...parsed })
      this.lists[discipline] = { source: parsed.source, numbers: parsed.numbers, entered_by: this.actor, entered_at: at, read_numbers: null }
      this.done.push({ ids: [], act: 'drawing_list', sheets: 0 })
      return json(200, { discipline, source: parsed.source, numbers: parsed.numbers, ignored: parsed.ignored, entered_by: this.actor, entered_at: at, read_numbers: null, agrees: true })
    }
    if (method === 'GET' && rest === '/drawing-list') {
      const d = url.searchParams.get('discipline') ?? ''
      const list = this.lists[d]
      return json(200, { discipline: d, source: list?.source ?? null, numbers: list?.numbers ?? [], ignored: 0, entered_by: list?.entered_by ?? null, entered_at: list?.entered_at ?? null, read_numbers: list?.read_numbers ?? null, agrees: true })
    }
    return json(404, msg('platform.auth.not_found'))
  }
}

/** 19b's parser, as far as these tests need it: a typed range "A-01–A-08" or pasted "NUMBER  TITLE" lines. */
function parse(text: string) {
  const range = /^\s*([A-Z]+-)?(\d+)\s*(?:–|-|to)\s*(?:[A-Z]+-)?(\d+)\s*$/.exec(text.trim())
  if (range && !text.trim().includes('\n')) {
    const [, prefix = '', a, b] = range
    const width = a!.length
    const numbers = []
    for (let n = Number(a); n <= Number(b); n++) numbers.push(`${prefix}${String(n).padStart(width, '0')}`)
    return { source: 'typed', numbers, ignored: 0, entries: numbers.map((number) => ({ number, title: null })) }
  }
  const entries: { number: string; title: string | null }[] = []
  let ignored = 0
  for (const line of text.split('\n')) {
    const m = /^\s*([A-Z]+-\d+)\s+(.+?)\s*$/.exec(line)
    if (m) entries.push({ number: m[1]!, title: m[2]! })
    else if (line.trim()) ignored += 1
  }
  return { source: 'pasted', numbers: entries.map((e) => e.number), ignored, entries }
}
