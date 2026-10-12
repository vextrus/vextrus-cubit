/*
 * Steps 3, 4 and 6's data (S16-W1): session 16's takeoff endpoints (the contract's "T2") as queries
 * and acts. The paths are typed here, by hand, from that contract until K0's frozen schema reaches
 * the generated types; every call goes through the app's one transport (`createApi`), so the session
 * cookie, the CSRF token and the refusal reader are the same as everywhere.
 *
 *   const proposals = useQuery(proposalsQuery(projectId, 'columns'))
 *   await act(projectId, { act: 'confirm', step: 'columns', proposal_ids: ids })
 *
 * One query key per project, `['frame', projectId]`, so an act refreshes everything at once.
 */
import { queryOptions } from '@tanstack/react-query'
import { createApi, unwrap } from '@/api/client'

export type StepKey = 'storeys' | 'grid' | 'columns'

export interface TraceOut {
  fact: string
  sheet_id: string
  view_id: string
  anchor: unknown
}

export interface QuestionRef {
  code: string
  params: Record<string, unknown>
}

export interface FrameProposal {
  id: string
  family: string
  mark: string
  storey: string | null
  values: Record<string, unknown>
  state: string
  questions: QuestionRef[]
  trace: TraceOut[]
}

export interface FrameGroup {
  key: string
  label: string
  proposals: FrameProposal[]
}

export interface StoreyOut {
  id: string
  name: string
  order: number
  level_m: string | null
  height_m: string | null
  level_basis: 'typed' | 'default'
}

export interface ViewPlacement {
  view_id: string
  sheet_number: string
  storeys: string[]
}

export interface StoreysOut {
  storeys: StoreyOut[]
  view_placements: ViewPlacement[]
}

export interface StepOut {
  step: StepKey
  status: string
  n: number
  N: number
  open_questions: number
}

export type FrameAct = 'confirm' | 'exclude' | 'edit' | 'unconfirm'

export interface ActBody {
  act: FrameAct
  step: StepKey
  proposal_ids?: string[]
  group_key?: string
  values?: Record<string, string>
  reason?: string
}

export interface ActOut {
  confirmation_id: string
  model_version_seq: number
  figures_changed: boolean
}

interface Op<Query, Body, Ok> {
  parameters: { query?: Query; header?: never; path: { project_id: string } & Record<string, string>; cookie?: never }
  requestBody?: { content: { 'application/json': Body } }
  responses: { 200: { headers: Record<string, never>; content: { 'application/json': Ok } } }
}

type Get<Ok, Query = never> = { get: Op<Query, never, Ok>; put?: never; post?: never; delete?: never; options?: never; head?: never; patch?: never; trace?: never }
type Put<Body, Ok> = { put: Op<never, Body, Ok>; get?: never; post?: never; delete?: never; options?: never; head?: never; patch?: never; trace?: never }
type Post<Body, Ok> = { post: Op<never, Body, Ok>; get?: never; put?: never; delete?: never; options?: never; head?: never; patch?: never; trace?: never }

interface FramePaths {
  '/api/projects/{project_id}/takeoff/steps': Get<StepOut[]>
  '/api/projects/{project_id}/takeoff/steps/{step}/proposals': Get<{ groups: FrameGroup[] }, { group?: 'band' | 'mark' }>
  '/api/projects/{project_id}/takeoff/steps/{step}/read': Post<Record<string, never>, unknown>
  '/api/projects/{project_id}/takeoff/storeys': Get<StoreysOut>
  '/api/projects/{project_id}/takeoff/storeys/levels': Put<{ levels: { storey_id: string; level_m: string }[] }, { storeys: StoreyOut[] }>
  '/api/projects/{project_id}/takeoff/view-placements/{view_id}': Put<{ storey_ids: string[] }, { view_id: string; storeys: string[] }>
  '/api/projects/{project_id}/takeoff/confirmations': Post<ActBody, ActOut>
}

const frameApi = createApi<FramePaths>()

const at = (project_id: string) => ({ params: { path: { project_id } } })

export const frameKey = (projectId: string) => ['frame', projectId] as const

export function proposalsQuery(projectId: string, step: StepKey) {
  return queryOptions({
    queryKey: [...frameKey(projectId), 'proposals', step],
    queryFn: async () =>
      (
        await unwrap(
          frameApi.GET('/api/projects/{project_id}/takeoff/steps/{step}/proposals', {
            params: { path: { project_id: projectId, step }, query: { group: step === 'columns' ? 'band' : 'mark' } },
          }),
        )
      ).groups,
  })
}

export function storeysQuery(projectId: string) {
  return queryOptions({
    queryKey: [...frameKey(projectId), 'storeys'],
    queryFn: () => unwrap(frameApi.GET('/api/projects/{project_id}/takeoff/storeys', at(projectId))),
  })
}

export function stepsQuery(projectId: string) {
  return queryOptions({
    queryKey: [...frameKey(projectId), 'steps'],
    queryFn: () => unwrap(frameApi.GET('/api/projects/{project_id}/takeoff/steps', at(projectId))),
  })
}

/** Asks the server to read the step's proposals again (a 202: the job runs behind it). */
export async function readStep(projectId: string, step: StepKey): Promise<void> {
  await unwrap(frameApi.POST('/api/projects/{project_id}/takeoff/steps/{step}/read', { params: { path: { project_id: projectId, step } }, body: {} }))
}

/** One Confirmation on the server (the contract's `confirmations`). */
export async function act(projectId: string, body: ActBody): Promise<ActOut> {
  return unwrap(frameApi.POST('/api/projects/{project_id}/takeoff/confirmations', { ...at(projectId), body }))
}

/** The QS's typed levels ("levels typed, not read"), one call for all the fields changed. */
export async function putLevels(projectId: string, levels: { storey_id: string; level_m: string }[]): Promise<StoreyOut[]> {
  return (await unwrap(frameApi.PUT('/api/projects/{project_id}/takeoff/storeys/levels', { ...at(projectId), body: { levels } }))).storeys
}

/** The storeys a view stands for, as the QS fixed them. */
export async function putPlacement(projectId: string, viewId: string, storeyIds: string[]): Promise<void> {
  await unwrap(
    frameApi.PUT('/api/projects/{project_id}/takeoff/view-placements/{view_id}', { params: { path: { project_id: projectId, view_id: viewId } }, body: { storey_ids: storeyIds } }),
  )
}
