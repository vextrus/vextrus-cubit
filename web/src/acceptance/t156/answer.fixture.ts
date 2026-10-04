/*
 * Ticket 156's fake: 22's Step 1 fake (../t22/step1.fixture.ts) with 21c's Questions and 21c's answer
 * operation laid over it (PR #152: `POST /api/projects/{project_id}/takeoff/step1/questions/{question_id}/answer`,
 * body `Step1AnswerIn` `{option, text}`, reply `Step1QuestionOut`; 400 `takeoff.proposals.option_not_offered`
 * or `takeoff.proposals.number_needed`, 409 `takeoff.proposals.answered_already`). A Question's
 * statuses are 21c's: `open`, `answered`, `withdrawn`; "Keep open" leaves it `open` with its answer
 * `{option: 'keep_open', by}`. Answering a conflict "keep all" confirms the sheets it holds, as 21c does.
 */
import { FakeApi } from '@/app/testing'
import { FakeStep1, msg, type QuestionOut } from '../t22/step1.fixture'
import { QUESTION_SHAPES } from './options.fixture'

export type Question21c = QuestionOut & { proposals: string[] }

let serial = 0
const id = () => `c1560000-0000-4000-8000-${String(++serial).padStart(12, '0')}`
const opts = (keys: readonly string[]) => keys.map((key) => ({ key, picked: false }))
const optionsOf = (code: string) => QUESTION_SHAPES.find((s) => s.code === code)!.options

export class FakeAnswers {
  readonly api: FakeApi
  readonly step1: FakeStep1
  /** Each answer POSTed, by Question id, with its JSON body, in order. */
  posted: { question: string; body: Record<string, unknown> }[] = []
  /** The next answer is refused with this, once. */
  refuseNext: { status: number; body: unknown } | null = null

  constructor() {
    this.api = new FakeApi()
    this.step1 = new FakeStep1(this.api)
    const base = this.api.handle
    this.api.handle = async (request: Request) => {
      const url = new URL(request.url, location.origin)
      const m = new RegExp(`^/api/projects/${this.step1.projectId}/takeoff/step1/questions/([^/]+)/answer/?$`).exec(url.pathname)
      if (!m || request.method !== 'POST') return base(request)
      return this.answer(request, m[1]!)
    }
  }

  get questions(): Question21c[] {
    return this.step1.questions as Question21c[]
  }

  set questions(qs: Question21c[]) {
    this.step1.questions = qs
  }

  private sheet(number: string | null, revision?: string) {
    return this.step1.proposals.find((p) => p.number === number && (!revision || p.revision_mark === revision))!
  }

  private question(kind: string, code: string, params: Record<string, unknown>, discipline: string | null, held: ReturnType<FakeAnswers['sheet']>[], check: string | null = null): Question21c {
    return {
      id: id(),
      kind,
      status: 'open',
      code,
      params,
      options: opts(optionsOf(code)),
      discipline,
      subject_id: held[0]?.sheet_id ?? null,
      check_code: check,
      answer: null,
      answered_at: null,
      proposals: held.map((p) => p.id),
    }
  }

  /** One Question of each kind 21c raises, on KR-01's sheets (m0-screens §7). */
  byKind(): Record<string, Question21c> {
    const s07b = this.sheet('S-07', 'B')
    const s07a = this.sheet('S-07', 'A')
    const misread = this.question('file_misread', 'engine.decoders_agree.disagree', { items: 312, only_first: 312, only_second: 0, kinds: 1, layers: 1, unread: 0 }, 'structural', [])
    misread.subject_id = s07b.file_id
    return {
      file_misread: misread,
      same_number: this.question('conflict', 'engine.conflicts.same_number', { number: 'S-07', copies: 2 }, 'structural', [s07b, s07a]),
      same_title: this.question('conflict', 'engine.conflicts.same_title', { title: 'TYPICAL FLOOR LIGHTING AND POWER LAYOUT', sheets: 2 }, 'electrical', [this.sheet('E-02'), this.sheet('E-03')]),
      lists_disagree: this.question('conflict', 'takeoff.proposals.lists_disagree', { sheet: 'S-01', named: 'number', source: 'pasted' }, 'structural', [this.sheet('S-01')]),
      missing: this.question('missing', 'takeoff.step1.no_number', {}, 'architectural', [this.sheet(null)]),
      missing_discipline: this.question('missing_discipline', 'takeoff.proposals.which_discipline', { sheet: 'A-06', named: 'number' }, null, [this.sheet('A-06')]),
      low_confidence: { ...this.question('low_confidence', 'takeoff.proposals.which_kind', { sheet: 'A-05', named: 'number' }, 'architectural', [this.sheet('A-05')]), options: opts(['elevation', 'section', 'perspective', 'keep_open']) },
      convention: this.question('convention', 'takeoff.proposals.boundary_storey', { sheet: 'S-08', named: 'number', range: 'PILE CAP TO 2ND FLOOR', next_sheet: 'S-09', next_named: 'number', level: 'floor', number: 2, storey: 'floor_2' }, 'structural', [this.sheet('S-08')]),
      check: this.question('check', 'engine.register_check.not_found', { number: 'S-13' }, 'structural', [], 'register'),
    }
  }

  /** Every code in options.fixture.ts, each carrying every option key it can carry. */
  everyShape(): Question21c[] {
    const any = this.sheet('S-02')
    return QUESTION_SHAPES.map((s) => this.question(s.kind, s.code, {}, 'structural', [any]))
  }

  private async answer(request: Request, questionId: string): Promise<Response> {
    const api = this.api
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
    const body = ((await request.clone().json().catch(() => ({}))) ?? {}) as Record<string, unknown>
    this.posted.push({ question: questionId, body })
    if (!api.session.userId) return json(401, msg('platform.auth.signed_out'))
    if (request.headers.get('X-CSRFToken') !== api.csrf) return json(403, msg('platform.auth.csrf_failed'))
    const role = api.memberships.find((m) => m.userId === api.session.userId && m.tenant === api.session.developerId && m.revokedAt === null)?.role ?? ''
    if (role === 'md' || role === 'guest') return json(403, msg('platform.auth.forbidden'))
    if (this.refuseNext) {
      const r = this.refuseNext
      this.refuseNext = null
      return json(r.status, r.body)
    }
    const q = this.questions.find((x) => x.id === questionId)
    if (!q) return json(404, msg('platform.auth.not_found'))
    if (q.status !== 'open') return json(409, msg('takeoff.proposals.answered_already'))
    const option = body.option
    if (typeof option !== 'string' || !q.options.some((o) => o.key === option)) return json(400, msg('takeoff.proposals.option_not_offered'))
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (option === 'type_number' && !text) return json(400, msg('takeoff.proposals.number_needed'))
    const by = this.step1.actor
    const at = new Date(api.now()).toISOString()
    const given: Record<string, unknown> = { option, by, ...(option === 'type_number' ? { text } : {}) }
    if (option === 'keep_open') {
      q.answer = given
      return json(200, q)
    }
    if (q.kind === 'conflict' && option === 'keep_all') {
      for (const p of this.step1.proposals.filter((x) => q.proposals.includes(x.id))) Object.assign(p, { decision: 'confirmed', decided_by: by, decided_at: at })
    }
    Object.assign(q, { status: 'answered', answer: given, answered_at: at })
    return json(200, q)
  }
}
