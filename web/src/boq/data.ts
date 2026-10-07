/*
 * The Priced BOQ's data (session 16's contract, "boq (B) and projects GFA"; docs/plans/M1.md C13, C15):
 * the BOQ with its strip, the Measurement Lines behind one BOQ Item, and the Gross Floor Area entry.
 * Money is `{amount, currency}`, quantities exact decimal strings. The routes are not in the generated
 * schema yet, so their types are written here in the contract's shapes (see rates/data.ts).
 */
import { queryOptions } from '@tanstack/react-query'
import { createApi, unwrap } from '@/api/client'
import type { Money } from '@/format'
import type { MachineMessage } from '@/format/machine'
import type { UnitSystem } from '@/format/units'

export interface BoqItem {
  number: string
  item_code: string
  section: string
  group: string
  description: MachineMessage
  billing_unit: string
  quantity: string
  rate: Money | null
  amount: Money | null
  cost_basis: string
  rebar_basis: 'by_ratio' | 'from_drawing' | 'from_drawing_rules' | null
  rebar_from_drawing_share: string | null
  awaiting_answer: { quantity: string; amount: Money | null } | null
  by_storey: { storey: string; quantity: string }[]
  trace: { lines: number }
}

export interface AllowanceLine {
  step: string
  part: string
  cost_basis: string
  source: string
  consumptions: { item_code: string; per_area: string }[]
  amount: Money
  measured_so_far: Money
}

export interface Strip {
  measured: Money
  awaiting_answer: Money
  allowance: Money
  total: Money
  unpriced_lines: number
  per_area: Money | null
  gfa: { value: string; basis: string; unit?: string } | null
}

export interface BoqOut {
  building_id: string
  strip: Strip
  /** The measured share of the total, "0".."1". */
  measured_share: string
  sections: {
    section: string
    groups: { group: string; items: BoqItem[] }[]
  }[]
  allowances: AllowanceLine[]
}

export interface TraceRef {
  sheet_id: string
  view_id: string
  anchor: unknown
}

export interface MeasurementLine {
  id: string
  item_code: string
  element_id: string
  mark: string
  storey: string
  quantity: string
  billing_unit: string
  trace: TraceRef[]
}

type Ok<T> = {
  200: {
    headers: { [name: string]: unknown }
    content: { 'application/json': T }
  }
}
type Params<P extends Record<string, string>> = {
  query?: never
  header?: never
  path: P
  cookie?: never
}
type Methods = {
  get?: never
  put?: never
  post?: never
  delete?: never
  options?: never
  head?: never
  patch?: never
  trace?: never
}
type Path<O> = Omit<Methods, keyof O> & O
type Project = { project_id: string }
export type AreaUnit = 'sft' | 'm2'

export interface BoqPaths {
  '/api/projects/{project_id}/boq': Path<{
    get: {
      parameters: Params<Project>
      requestBody?: never
      responses: Ok<BoqOut>
    }
  }>
  '/api/projects/{project_id}/boq/items/{item_code}/lines': Path<{
    get: {
      parameters: Params<Project & { item_code: string }>
      requestBody?: never
      responses: Ok<{ lines: MeasurementLine[] }>
    }
  }>
  '/api/projects/{project_id}/buildings/{building_id}/gross-floor-area': Path<{
    put: {
      parameters: Params<Project & { building_id: string }>
      requestBody: {
        content: { 'application/json': { value: string; unit: AreaUnit } }
      }
      responses: Ok<{ value: string; unit: AreaUnit }>
    }
  }>
}

export const boqApi = createApi<BoqPaths>()

export const boqKey = (projectId: string) => ['boq', projectId] as const
export const linesKey = (projectId: string, itemCode: string) => ['boq', projectId, 'lines', itemCode] as const

export function boqQuery(projectId: string) {
  return queryOptions({
    queryKey: boqKey(projectId),
    queryFn: () =>
      unwrap(
        boqApi.GET('/api/projects/{project_id}/boq', {
          params: { path: { project_id: projectId } },
        }),
      ),
  })
}

export function linesQuery(projectId: string, itemCode: string) {
  return queryOptions({
    queryKey: linesKey(projectId, itemCode),
    queryFn: () =>
      unwrap(
        boqApi.GET('/api/projects/{project_id}/boq/items/{item_code}/lines', {
          params: { path: { project_id: projectId, item_code: itemCode } },
        }),
      ),
  })
}

/** Puts the Building's Gross Floor Area (an exact decimal as typed) in the unit the project shows areas in. */
export function putGrossFloorArea(projectId: string, buildingId: string, value: string, unit: AreaUnit) {
  return unwrap(
    boqApi.PUT('/api/projects/{project_id}/buildings/{building_id}/gross-floor-area', {
      params: { path: { project_id: projectId, building_id: buildingId } },
      body: { value, unit },
    }),
  )
}

/** The Billing Unit an area is entered in: square feet where the project's unit system writes feet and inches, else square metres. */
export function areaUnitOf(system: UnitSystem): AreaUnit {
  return system.length === 'feet-inches' ? 'sft' : 'm2'
}
