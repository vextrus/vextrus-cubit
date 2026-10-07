/*
 * The 3D Live Model's data (session-16 contract; docs/plans/M1.md C17): the Elements' primitives, the
 * storeys' names and order, and one Element's inspector. Read through TanStack Query under one key per
 * project, `['model', projectId]`.
 *
 * The three operations are typed here, by hand, until the generated types carry them (the frozen API's
 * schema files are K0's); the shapes are the contract's.
 */
import { queryOptions } from '@tanstack/react-query'
import { createApi, unwrap } from '@/api/client'
import type { ElementPrimitives } from './scene'

export type { ElementPrimitives } from './scene'

export interface StoreyOut {
  id: string
  name: string
  order: number
  level_m: string | null
  height_m: string | null
  level_basis: 'typed' | 'default'
}

export interface TraceOut {
  fact: string
  kind: string
  sheet_id: string
  view_id: string
  anchor: Record<string, string>
  /** The printed sheet's number and title, when the Trace's sheet is still in the list. */
  sheet_number?: string | null
  sheet_title?: string | null
}

export interface ElementOut {
  element_id: string
  family: string
  mark: string
  storey: string
  grid_ref: string | null
  ifc_class: string
  classification: { system: string; code: string }[]
  attrs: { key: string; value: string; unit: string | null }[]
  trace: TraceOut[]
}

type Op<Path extends Record<string, string>, Query, Ok> = {
  parameters: { query?: Query; header?: never; path: Path; cookie?: never }
  requestBody?: never
  responses: {
    200: {
      headers: Record<string, unknown>
      content: { 'application/json': Ok }
    }
  }
}

interface ModelPaths {
  '/api/projects/{project_id}/takeoff/model/primitives': {
    get: Op<{ project_id: string }, { seq?: number }, ElementPrimitives[]>
  }
  '/api/projects/{project_id}/takeoff/storeys': {
    get: Op<{ project_id: string }, never, { storeys: StoreyOut[] }>
  }
  '/api/projects/{project_id}/model/elements/{element_id}': {
    get: Op<{ project_id: string; element_id: string }, never, ElementOut>
  }
}

const modelApi = createApi<ModelPaths>()

export const modelKey = (projectId: string) => ['model', projectId] as const

export function primitivesQuery(projectId: string) {
  return queryOptions({
    queryKey: [...modelKey(projectId), 'primitives'],
    queryFn: () =>
      unwrap(
        modelApi.GET('/api/projects/{project_id}/takeoff/model/primitives', {
          params: { path: { project_id: projectId } },
        }),
      ),
  })
}

export function storeysQuery(projectId: string) {
  return queryOptions({
    queryKey: [...modelKey(projectId), 'storeys'],
    queryFn: async () =>
      (
        await unwrap(
          modelApi.GET('/api/projects/{project_id}/takeoff/storeys', {
            params: { path: { project_id: projectId } },
          }),
        )
      ).storeys,
  })
}

export function elementQuery(projectId: string, elementId: string) {
  return queryOptions({
    queryKey: [...modelKey(projectId), 'element', elementId],
    queryFn: () =>
      unwrap(
        modelApi.GET('/api/projects/{project_id}/model/elements/{element_id}', {
          params: { path: { project_id: projectId, element_id: elementId } },
        }),
      ),
    retry: false,
  })
}
