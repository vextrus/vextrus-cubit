/*
 * S16-W2's seed: the 3D Live Model view's data in the session-16 contract's shapes
 * (.private/work/session-16/contracts.md; docs/plans/M1.md C17, C4):
 *
 * - `GET /api/projects/{project_id}/takeoff/model/primitives?seq=` →
 *   `[{element_id, family, storey, part, state, primitives: [{kind, polygon, z0, z1}]}]`; state is
 *   `confirmed` | `proposal` | `held`; quantities are decimal strings (SI metres), never floats.
 * - `GET /api/projects/{project_id}/model/elements/{element_id}` → `{element_id, family, mark, storey,
 *   grid_ref, ifc_class, classification: [{system, code}], attrs: [{key, value, unit}], trace: [{fact,
 *   kind, sheet_id, view_id, anchor}]}`.
 *
 * Column C1's GF prism is C11's worked example: 0.254 × 0.508 × 2.921 = 0.376902 m3.
 */
import { FakeApi } from '@/app/testing'

export interface Prism {
  kind: 'prism'
  polygon: [string, string][]
  z0: string
  z1: string
}
export interface ElementPrimitives {
  element_id: string
  family: string
  storey: string
  part: string
  state: 'confirmed' | 'proposal' | 'held'
  primitives: Prism[]
}

const rect = (x: number, y: number, b: number, d: number): [string, string][] =>
  [
    [x, y],
    [x + b, y],
    [x + b, y + d],
    [x, y + d],
  ].map(([px, py]) => [px!.toFixed(3), py!.toFixed(3)] as [string, string])

export const C1_GF = 'e16f2000-0000-4000-8000-000000000001'
export const C2_GF = 'e16f2000-0000-4000-8000-000000000002'
export const C1_1F = 'e16f2000-0000-4000-8000-000000000003'

/** Two storeys, three columns: per storey one merged mesh, whatever the count of Elements. */
export const PRIMITIVES: ElementPrimitives[] = [
  { element_id: C1_GF, family: 'column', storey: 'GF', part: 'column', state: 'confirmed', primitives: [{ kind: 'prism', polygon: rect(1, 2, 0.254, 0.508), z0: '0.000', z1: '2.921' }] },
  { element_id: C2_GF, family: 'column', storey: 'GF', part: 'column', state: 'proposal', primitives: [{ kind: 'prism', polygon: rect(6, 2, 0.305, 0.381), z0: '0.000', z1: '2.921' }] },
  { element_id: C1_1F, family: 'column', storey: '1F', part: 'column', state: 'held', primitives: [{ kind: 'prism', polygon: rect(1, 2, 0.254, 0.457), z0: '2.921', z1: '5.969' }] },
]

/** Expected per element: the prism's b × d × h and its box, in the primitives' frame (x, y, z up). */
export const EXPECTED: Record<string, { volume: number; min: [number, number, number]; max: [number, number, number] }> = {
  [C1_GF]: { volume: 0.254 * 0.508 * 2.921, min: [1, 2, 0], max: [1.254, 2.508, 2.921] },
  [C2_GF]: { volume: 0.305 * 0.381 * 2.921, min: [6, 2, 0], max: [6.305, 2.381, 2.921] },
  [C1_1F]: { volume: 0.254 * 0.457 * (5.969 - 2.921), min: [1, 2, 2.921], max: [1.254, 2.457, 5.969] },
}

/** The inspector's answer for C1 on GF. */
export const C1_INSPECTED = {
  element_id: C1_GF,
  family: 'column',
  mark: 'C1',
  storey: 'GF',
  grid_ref: 'B/2',
  ifc_class: 'IfcColumn',
  classification: [{ system: 'Uniclass', code: 'EF_20_10' }],
  attrs: [
    { key: 'section_b', value: '0.254', unit: 'm' },
    { key: 'section_d', value: '0.508', unit: 'm' },
  ],
  trace: [{ fact: 'section_b', kind: 'label', sheet_id: 'e16f2000-0000-4000-8000-0000000000a1', view_id: 'e16f2000-0000-4000-8000-0000000000b1', anchor: { x: '120.0', y: '80.0' } }],
}

/**
 * The seed's API with the 3D's two endpoints answered; `only` limits the primitives to some Elements
 * (a single column, so the view's centre is on it). `seen` lists every request, `GET /api/…`.
 */
export function seedModel(only?: string[]): { api: FakeApi; seen: string[] } {
  const api = new FakeApi()
  const seen: string[] = []
  const projectId = api.project('KR-01').id
  const base = api.handle
  const elements = only ? PRIMITIVES.filter((e) => only.includes(e.element_id)) : PRIMITIVES
  const storeyNames = [...new Set(elements.map((e) => e.storey))]
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  api.handle = async (request: Request) => {
    const url = new URL(request.url)
    const p = url.pathname.replace(/\/$/, '')
    seen.push(`${request.method} ${p}`)
    if (request.method === 'GET' && p === `/api/projects/${projectId}/takeoff/model/primitives`) return json(200, elements)
    if (request.method === 'GET' && p === `/api/projects/${projectId}/takeoff/storeys`)
      return json(200, {
        storeys: storeyNames.map((name, i) => ({ id: `e16f2000-0000-4000-8000-00000000005${i}`, name, order: i, level_m: (i * 2.921).toFixed(3), height_m: '2.921', level_basis: 'typed' })),
      })
    const el = new RegExp(`^/api/projects/${projectId}/model/elements/([0-9a-f-]+)$`).exec(p)
    if (request.method === 'GET' && el) {
      if (el[1] === C1_GF) return json(200, C1_INSPECTED)
      return json(404, { code: 'live_model.element.not_found', params: {} })
    }
    return base(request)
  }
  return { api, seen }
}
