/*
 * Step 1's data (ticket 22): 19a's Step 1 operations (`vextrus/takeoff/http/step1.py`) as queries and
 * acts, and the sheet's render (14). Everything here is read through TanStack Query under one key per
 * project, `['step1', projectId]`, so an act refreshes it all at once.
 *
 *   const step1 = useStep1(project.id)            // proposals, questions, coverage, progress, lists
 *   await confirm(project.id, ids)                // one act on the server (19a's Confirmation)
 *   await undo(project.id)                        // the acting user's own last act
 */
import { queryOptions, useQueries, useQuery } from '@tanstack/react-query'
import { ApiRefused, api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'

export type ProposalOut = components['schemas']['Step1ProposalOut']
export type QuestionOut = components['schemas']['Step1QuestionOut']
export type CoverageOut = components['schemas']['Step1CoverageOut']
export type ProgressOut = components['schemas']['Step1ProgressOut']
export type DisciplineProgress = components['schemas']['Step1DisciplineProgressOut']
export type ActOut = components['schemas']['Step1ActOut']
export type ParsedListOut = components['schemas']['Step1ParsedListOut']
export type DrawingListOut = components['schemas']['Step1DrawingListOut']

/** A refusal is an answer, never tried again; an unreachable server keeps being tried. */
function retry(failures: number, error: unknown): boolean {
  if (error instanceof ApiRefused) return false
  return error instanceof TypeError || failures < 2
}

const path = (project_id: string) => ({ params: { path: { project_id } } })

export const step1Key = (projectId: string) => ['step1', projectId] as const

export function proposalsQuery(projectId: string) {
  return queryOptions({
    queryKey: [...step1Key(projectId), 'proposals'],
    queryFn: async () => (await unwrap(api.GET('/api/projects/{project_id}/takeoff/step1/proposals', path(projectId)))).proposals,
    retry,
  })
}

export function questionsQuery(projectId: string) {
  return queryOptions({
    queryKey: [...step1Key(projectId), 'questions'],
    queryFn: async () => (await unwrap(api.GET('/api/projects/{project_id}/takeoff/step1/questions', path(projectId)))).questions,
    retry,
  })
}

export function coverageQuery(projectId: string) {
  return queryOptions({
    queryKey: [...step1Key(projectId), 'coverage'],
    queryFn: () => unwrap(api.GET('/api/projects/{project_id}/takeoff/step1/coverage', path(projectId))),
    retry,
  })
}

export function progressQuery(projectId: string) {
  return queryOptions({
    queryKey: [...step1Key(projectId), 'progress'],
    queryFn: () => unwrap(api.GET('/api/projects/{project_id}/takeoff/step1/progress', path(projectId))),
    retry,
  })
}

export function drawingListQuery(projectId: string, discipline: string) {
  return queryOptions({
    queryKey: [...step1Key(projectId), 'drawing-list', discipline],
    queryFn: () =>
      unwrap(api.GET('/api/projects/{project_id}/takeoff/step1/drawing-list', { params: { path: { project_id: projectId }, query: { discipline } } })),
    retry,
  })
}

/** A printed sheet's render buffer (14): fetched when its sheet opens, kept while the screen is. */
export function renderQuery(projectId: string, sheetId: string) {
  return queryOptions({
    queryKey: ['sheet-render', projectId, sheetId],
    queryFn: async () =>
      unwrap(
        api.GET('/api/projects/{project_id}/drawings/sheets/{sheet_id}/render', {
          params: { path: { project_id: projectId, sheet_id: sheetId } },
          parseAs: 'arrayBuffer',
        }),
      ) as Promise<ArrayBuffer>,
    staleTime: Infinity,
    retry,
  })
}

export interface Step1Data {
  proposals: readonly ProposalOut[]
  questions: readonly QuestionOut[]
  coverage: CoverageOut
  progress: ProgressOut
  /** The standing drawing list per Discipline present, when read. */
  lists: Readonly<Record<string, DrawingListOut | undefined>>
}

/** Everything Step 1 shows, or the first load's error. */
export function useStep1(projectId: string): { data: Step1Data | null; error: unknown; retry: () => void } {
  const proposals = useQuery(proposalsQuery(projectId))
  const questions = useQuery(questionsQuery(projectId))
  const coverage = useQuery(coverageQuery(projectId))
  const progress = useQuery(progressQuery(projectId))
  const disciplines = progress.data?.disciplines.map((d) => d.discipline).filter((d): d is string => d !== null) ?? []
  const lists = useQueries({ queries: disciplines.map((d) => drawingListQuery(projectId, d)) })
  const all = [proposals, questions, coverage, progress]
  const error = all.find((q) => q.error)?.error ?? null
  const retryAll = () => {
    for (const q of all) if (q.error) void q.refetch()
  }
  if (!proposals.data || !questions.data || !coverage.data || !progress.data) return { data: null, error, retry: retryAll }
  const byDiscipline: Record<string, DrawingListOut | undefined> = {}
  disciplines.forEach((d, i) => {
    byDiscipline[d] = lists[i]?.data
  })
  return {
    data: { proposals: proposals.data, questions: questions.data, coverage: coverage.data, progress: progress.data, lists: byDiscipline },
    error,
    retry: retryAll,
  }
}

// The acts (each one Confirmation on the server, taken back by one undo) ---------------------------

export async function confirm(projectId: string, proposals: readonly string[]): Promise<ActOut> {
  return unwrap(api.POST('/api/projects/{project_id}/takeoff/step1/confirm', { ...path(projectId), body: { proposals: [...proposals] } }))
}

export async function exclude(projectId: string, proposals: readonly string[], reason: string, text = ''): Promise<ActOut> {
  return unwrap(api.POST('/api/projects/{project_id}/takeoff/step1/exclude', { ...path(projectId), body: { proposals: [...proposals], reason, text } }))
}

export async function undo(projectId: string): Promise<ActOut> {
  return unwrap(api.POST('/api/projects/{project_id}/takeoff/step1/undo', { ...path(projectId), body: {} }))
}

/** A pasted list or a typed range, read back; nothing is kept. */
export async function readList(projectId: string, discipline: string, text: string): Promise<ParsedListOut> {
  return unwrap(api.POST('/api/projects/{project_id}/takeoff/step1/drawing-list/read', { ...path(projectId), body: { discipline, text } }))
}

export async function setList(projectId: string, discipline: string, text: string): Promise<DrawingListOut> {
  return unwrap(api.POST('/api/projects/{project_id}/takeoff/step1/drawing-list', { ...path(projectId), body: { discipline, text } }))
}
