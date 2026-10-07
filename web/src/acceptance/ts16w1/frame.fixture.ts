/*
 * Ticket S16-W1's acceptance fake: the takeoff T2 endpoints (session 16's contract, "takeoff (T1 job,
 * T2 API)"; base `/api/projects/{project_id}/takeoff/`) in memory for KR-01, laid over the seed's
 * FakeApi for everything else, every call recorded with its JSON body. Sheet renders answer the tiny
 * sheet (ticket 16's fixture), so a Trace opened on the sheet can be seen as its render's request.
 *
 * Invented data only: storeys Basement..3rd (given out of order, so the screen must sort by `order`),
 * grid lines A, B, 1, 2, and columns C1 (two, agreeing) and C2 (one, its size not read).
 */
import type { FakeApi } from '@/app/seed/api.fixture'
import { fixtureBuffer } from '../t16/sheet.fixture'

export interface TraceOut {
  fact: string
  sheet_id: string
  view_id: string
  anchor: unknown
}
export interface ProposalOut {
  id: string
  family: 'storey' | 'grid_line' | 'column'
  mark: string
  storey: string | null
  values: Record<string, unknown>
  state: string
  questions: { code: string; params: Record<string, unknown> }[]
  trace: TraceOut[]
}
export interface GroupOut {
  key: string
  label: string
  proposals: ProposalOut[]
}
export interface StoreyOut {
  id: string
  name: string
  order: number
  level_m: string | null
  height_m: string | null
  level_basis: 'typed' | 'default'
}
export interface Call {
  call: string
  body: unknown
}

let serial = 0
const uuid = (block: string) => {
  serial += 1
  return `${block}-0000-4000-8000-${String(serial).padStart(12, '0')}`
}

export const SHEET_GRID = uuid('5e000000')
export const SHEET_COLS = uuid('5e000000')
export const VIEW_GRID = uuid('7e000000')
export const VIEW_COLS = uuid('7e000000')

const trace = (sheet_id: string, view_id: string, fact: string): TraceOut => ({ fact, sheet_id, view_id, anchor: { x: '1200', y: '800' } })

export function storeys(): StoreyOut[] {
  // Out of order on purpose: the screen lists them low to high by `order`.
  return [
    { id: uuid('57000000'), name: '2nd', order: 3, level_m: null, height_m: null, level_basis: 'default' },
    { id: uuid('57000000'), name: 'Basement', order: 0, level_m: '-3.000', height_m: '3.000', level_basis: 'default' },
    { id: uuid('57000000'), name: '3rd', order: 4, level_m: null, height_m: null, level_basis: 'default' },
    { id: uuid('57000000'), name: 'Ground', order: 1, level_m: '0.000', height_m: '3.000', level_basis: 'typed' },
    { id: uuid('57000000'), name: '1st', order: 2, level_m: null, height_m: null, level_basis: 'default' },
  ]
}

const proposal = (family: ProposalOut['family'], mark: string, storey: string | null, values: Record<string, unknown>, tr: TraceOut[], questions: ProposalOut['questions'] = []): ProposalOut => ({
  id: uuid('9a000000'),
  family,
  mark,
  storey,
  values,
  state: 'proposal',
  questions,
  trace: tr,
})

export function storeyGroups(list: StoreyOut[]): GroupOut[] {
  const sorted = [...list].sort((a, b) => a.order - b.order)
  return [{ key: 'storeys', label: 'Storeys', proposals: sorted.map((s) => proposal('storey', s.name, s.name, { order: s.order }, [trace(SHEET_GRID, VIEW_GRID, 'name')])) }]
}

export function gridGroups(): GroupOut[] {
  return [
    {
      key: 'x',
      label: 'A–B',
      proposals: [
        proposal('grid_line', 'A', null, { axis: 'x', offset: '0' }, [trace(SHEET_GRID, VIEW_GRID, 'label')]),
        proposal('grid_line', 'B', null, { axis: 'x', offset: '4500' }, [trace(SHEET_GRID, VIEW_GRID, 'label')]),
      ],
    },
    {
      key: 'y',
      label: '1–2',
      proposals: [
        proposal('grid_line', '1', null, { axis: 'y', offset: '0' }, [trace(SHEET_GRID, VIEW_GRID, 'label')]),
        proposal('grid_line', '2', null, { axis: 'y', offset: '6000' }, [trace(SHEET_GRID, VIEW_GRID, 'label')]),
      ],
    },
  ]
}

export function columnGroups(): GroupOut[] {
  const col = (mark: string, at: string, b: string | null, d: string | null, questions: ProposalOut['questions'] = []) =>
    proposal('column', mark, 'Ground', b && d ? { section_b: b, section_d: d, at, unit: 'in' } : { at }, [trace(SHEET_COLS, VIEW_COLS, 'outline')], questions)
  return [
    { key: 'ground/C1', label: 'Ground · C1', proposals: [col('C1', 'A/1', '10', '20'), col('C1', 'B/1', '10', '20')] },
    { key: 'ground/C2', label: 'Ground · C2', proposals: [col('C2', 'A/2', null, null, [{ code: 'engine.column.size_not_read', params: {} }])] },
  ]
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

export class FakeFrame {
  readonly projectId: string
  storeys: StoreyOut[] = storeys()
  groups: Record<'storeys' | 'grid' | 'columns', GroupOut[]>
  private seen: Call[] = []

  constructor(api: FakeApi, { projectCode = 'KR-01', empty = false }: { projectCode?: string; empty?: boolean } = {}) {
    this.projectId = api.project(projectCode).id
    this.groups = { storeys: storeyGroups(this.storeys), grid: gridGroups(), columns: columnGroups() }
    if (empty) {
      this.storeys = []
      this.groups = { storeys: [], grid: [], columns: [] }
    }
    const base = api.handle
    api.handle = async (request: Request) => {
      const url = new URL(request.url, location.origin)
      const root = `/api/projects/${this.projectId}`
      const takeoff = `${root}/takeoff/`
      if (url.pathname.startsWith(takeoff)) {
        const rest = url.pathname.slice(takeoff.length)
        const text = request.method === 'GET' ? '' : await request.text()
        const body = text ? (JSON.parse(text) as unknown) : null
        this.seen.push({ call: `${request.method} ${rest}${url.search}`, body })
        const answer = this.answer(request.method, rest, url, body)
        if (answer) return answer
      }
      if (url.pathname.startsWith(`${root}/drawings/sheets/`) && url.pathname.endsWith('/render')) {
        this.seen.push({ call: `GET ${url.pathname.slice(root.length)}`, body: null })
        return new Response(await fixtureBuffer('tiny-sheet'), { status: 200, headers: { 'Content-Type': 'application/octet-stream' } })
      }
      return base(request)
    }
  }

  private answer(method: string, rest: string, url: URL, body: unknown): Response | null {
    if (method === 'GET' && rest === 'steps') {
      return json(
        (['storeys', 'grid', 'columns'] as const).map((step) => {
          const ps = this.groups[step].flatMap((g) => g.proposals)
          return { step, status: 'open', n: ps.filter((p) => p.state === 'confirmed').length, N: ps.length, open_questions: ps.filter((p) => p.questions.length).length }
        }),
      )
    }
    const proposals = /^steps\/(storeys|grid|columns)\/proposals$/.exec(rest)
    if (method === 'GET' && proposals) return json({ groups: this.groups[proposals[1] as 'storeys' | 'grid' | 'columns'] })
    if (method === 'GET' && rest === 'storeys') {
      return json({
        storeys: this.storeys,
        view_placements: [
          { view_id: VIEW_GRID, sheet_number: 'S-03', storeys: this.storeys.filter((s) => s.order >= 1).map((s) => s.id) },
          { view_id: VIEW_COLS, sheet_number: 'S-04', storeys: [] },
        ],
      })
    }
    if (method === 'PUT' && rest === 'storeys/levels') {
      for (const l of (body as { levels: { storey_id: string; level_m: string }[] }).levels) {
        const s = this.storeys.find((x) => x.id === l.storey_id)
        if (s) Object.assign(s, { level_m: String(l.level_m), level_basis: 'typed' })
      }
      return json({ storeys: this.storeys })
    }
    if (method === 'PUT' && rest.startsWith('view-placements/')) return json({ view_id: rest.slice('view-placements/'.length), storeys: (body as { storey_ids: string[] }).storey_ids })
    if (method === 'POST' && /^steps\/[a-z]+\/read$/.test(rest)) return json({}, 202)
    if (method === 'POST' && rest === 'confirmations') {
      const b = body as { act: string; proposal_ids?: string[]; group_key?: string; step: string }
      const step = b.step as 'storeys' | 'grid' | 'columns'
      const ids = new Set(b.proposal_ids ?? this.groups[step]?.find((g) => g.key === b.group_key)?.proposals.map((p) => p.id) ?? [])
      const state = b.act === 'confirm' ? 'confirmed' : b.act === 'exclude' ? 'excluded' : b.act === 'unconfirm' ? 'proposal' : null
      for (const g of this.groups[step] ?? []) for (const p of g.proposals) if (ids.has(p.id) && state) p.state = state
      return json({ confirmation_id: uuid('c0000000'), model_version_seq: this.seen.length, figures_changed: true })
    }
    if (method === 'GET' && rest.startsWith('model/primitives')) return json([])
    void url
    return null
  }

  /** Every call made, "METHOD rest" (rest after `/takeoff/`, or `/drawings/...` for a render). */
  calls(): Call[] {
    return [...this.seen]
  }

  /** The confirmation acts posted, in order. */
  acts(): { act: string; step: string; proposal_ids?: string[]; group_key?: string; values?: Record<string, unknown> }[] {
    return this.seen.filter((c) => c.call === 'POST confirmations').map((c) => c.body as never)
  }
}

/** Visible text without the isolates the message layer puts round every value. */
export const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
export const bodyText = () => clean(document.body.textContent)

/** The proposal ids an act names: its `proposal_ids`, or those of the group its `group_key` names. */
export function namedIds(act: { proposal_ids?: string[]; group_key?: string }, groups: GroupOut[]): string[] {
  if (act.proposal_ids) return [...act.proposal_ids].sort()
  return (groups.find((g) => g.key === act.group_key)?.proposals.map((p) => p.id) ?? []).sort()
}
