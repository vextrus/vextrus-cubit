/*
 * Step 1's data (ticket 22): 19a's Step 1 operations (`vextrus/takeoff/http/step1.py`) as queries and
 * acts, and the sheet's render (14). Everything here is read through TanStack Query under one key per
 * project, `['step1', projectId]`, so an act refreshes it all at once.
 *
 *   const step1 = useStep1(project.id)            // proposals, questions, coverage, progress, lists
 *   await confirm(project.id, ids)                // one act on the server (19a's Confirmation)
 *   await undo(project.id)                        // the acting user's own last act
 */
import { useState } from 'react'
import { notifyManager, queryOptions, useIsFetching, useQueries, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'
import { sessionQuery } from '@/app/session'
import { sessionEpoch } from '@/auth/actions'

export type ProposalOut = components['schemas']['Step1ProposalOut']
export type ViewOut = components['schemas']['Step1ViewOut']
export type QuestionOut = components['schemas']['Step1QuestionOut']
export type AnswerOut = components['schemas']['Step1AnswerOut']
export type CoverageOut = components['schemas']['Step1CoverageOut']
export type ProgressOut = components['schemas']['Step1ProgressOut']
export type DisciplineProgress = components['schemas']['Step1DisciplineProgressOut']
export type ActOut = components['schemas']['Step1ActOut']
export type HistoryAct = components['schemas']['Step1HistoryActOut']
export type ParsedListOut = components['schemas']['Step1ParsedListOut']
export type DrawingListOut = components['schemas']['Step1DrawingListOut']

const path = (project_id: string) => ({ params: { path: { project_id } } })

export const step1Key = (projectId: string) => ['step1', projectId] as const

/** Step 1's four reads the rows, the frame's Count and Coverage are drawn from (`useSettled`), each one GET. */
const read = {
  proposals: async (projectId: string) => (await unwrap(api.GET('/api/projects/{project_id}/takeoff/step1/proposals', path(projectId)))).proposals,
  questions: async (projectId: string) => (await unwrap(api.GET('/api/projects/{project_id}/takeoff/step1/questions', path(projectId)))).questions,
  coverage: (projectId: string) => unwrap(api.GET('/api/projects/{project_id}/takeoff/step1/coverage', path(projectId))),
  progress: (projectId: string) => unwrap(api.GET('/api/projects/{project_id}/takeoff/step1/progress', path(projectId))),
}

export function proposalsQuery(projectId: string) {
  return queryOptions({
    queryKey: [...step1Key(projectId), 'proposals'],
    queryFn: () => read.proposals(projectId),
  })
}

/** A sheet's acts from the event log, oldest first (m0-screens §6.6 item 5); `proposal` is its `id`. */
export function historyQuery(projectId: string, proposal: string) {
  return queryOptions({
    queryKey: [...step1Key(projectId), 'history', proposal],
    queryFn: async () =>
      (await unwrap(api.GET('/api/projects/{project_id}/takeoff/step1/proposals/{proposal_id}/history', { params: { path: { project_id: projectId, proposal_id: proposal } } }))).acts,
  })
}

export function questionsQuery(projectId: string) {
  return queryOptions({
    queryKey: [...step1Key(projectId), 'questions'],
    queryFn: () => read.questions(projectId),
  })
}

export function coverageQuery(projectId: string) {
  return queryOptions({
    queryKey: [...step1Key(projectId), 'coverage'],
    queryFn: () => read.coverage(projectId),
  })
}

export function progressQuery(projectId: string) {
  return queryOptions({
    queryKey: [...step1Key(projectId), 'progress'],
    queryFn: () => read.progress(projectId),
  })
}

export function drawingListQuery(projectId: string, discipline: string) {
  return queryOptions({
    queryKey: [...step1Key(projectId), 'drawing-list', discipline],
    queryFn: () =>
      unwrap(api.GET('/api/projects/{project_id}/takeoff/step1/drawing-list', { params: { path: { project_id: projectId }, query: { discipline } } })),
  })
}

/** The Drawing Set's files by id, named as the QS added them (a held file's Question names it). */
export function fileNamesQuery(projectId: string) {
  return queryOptions({
    queryKey: [...step1Key(projectId), 'file-names'],
    queryFn: async (): Promise<Record<string, string>> => {
      const out = await unwrap(api.GET('/api/projects/{project_id}/drawings/files', path(projectId)))
      return Object.fromEntries(out.files.map((f) => [f.id, f.name]))
    },
    retry: false,
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
  })
}

export interface Step1Data {
  proposals: readonly ProposalOut[]
  questions: readonly QuestionOut[]
  coverage: CoverageOut
  progress: ProgressOut
  /** The standing drawing list per Discipline present, when read. */
  lists: Readonly<Record<string, DrawingListOut | undefined>>
  /** The files' names by id; empty until read, or when they cannot be. */
  fileNames?: Readonly<Record<string, string>>
}

export interface Step1Parts {
  proposals: readonly ProposalOut[]
  questions: readonly QuestionOut[]
  coverage: CoverageOut
  progress: ProgressOut
}

const WHOLE = ['proposals', 'questions', 'coverage', 'progress']

/** Whether a query is one of the four `useSettled` holds the snapshot for. */
export const isWhole = (projectId: string) => (query: { queryKey: readonly unknown[] }) =>
  query.queryKey[0] === 'step1' && query.queryKey[1] === projectId && WHOLE.includes(query.queryKey[2] as string)

/**
 * Some of the four read now, outside the cache: no query is marked fetching, so `useSettled` holds nothing
 * while they are read, and the caller writes what it read in one batch (`writeParts`), all four moving in one render.
 */
export async function readParts<K extends keyof Step1Parts>(projectId: string, parts: readonly K[]): Promise<Pick<Step1Parts, K>> {
  const values = await Promise.all(parts.map((part) => read[part](projectId)))
  return Object.fromEntries(parts.map((part, i) => [part, values[i]])) as Pick<Step1Parts, K>
}

/** The files' states as Step 1 compares them to know a file moved (`useRefreshAsFilesFinish`). */
export const fileStates = (files: readonly { id: string; state: string }[]) => files.map((f) => `${f.id}:${f.state}`).join(',')

const accounted = new WeakMap<QueryClient, Map<string, string>>()

/**
 * The files' states an answer wrote with its reply (a held file read anyway or set aside), the rest of Step 1
 * read behind by the answer itself: Step 1's own refresh on a file moving is then not asked for again (S27-G7,
 * the re-gate of #843: a second whole reload, and the snapshot held at the state before the answer meanwhile).
 */
export function accountFiles(queryClient: QueryClient, projectId: string, states: string) {
  const byProject = accounted.get(queryClient) ?? new Map<string, string>()
  byProject.set(projectId, states)
  accounted.set(queryClient, byProject)
}

/** The states an answer accounted for, taken once (`accountFiles`). */
export function takeAccounted(queryClient: QueryClient, projectId: string): string | undefined {
  const byProject = accounted.get(queryClient)
  const states = byProject?.get(projectId)
  byProject?.delete(projectId)
  return states
}

/** Writes some of the four in one batch: every reader of the snapshot renders them together. */
export function writeParts(queryClient: QueryClient, projectId: string, parts: Partial<Step1Parts>) {
  notifyManager.batch(() => {
    for (const [part, value] of Object.entries(parts)) if (value !== undefined) queryClient.setQueryData([...step1Key(projectId), part], value)
  })
}

/**
 * The four as an answer's reply leaves them (S27-G7, #319): each Proposal it moved (`changed_proposals`) in
 * place of the one listed, the answered Question in place of the one asked, and Step 1's progress as the
 * reply carries it. `read`: what the caller read again since the reply (`readParts`): the Questions (an
 * answer can close others: a conflict's copies), and Coverage when a sheet moved (progress too, from a reply
 * without it). A reply that does not say which sheets moved writes no Proposal (the caller knows the answer
 * moved none).
 */
export function answered(queryClient: QueryClient, projectId: string, reply: AnswerOut | QuestionOut, read: Partial<Omit<Step1Parts, 'proposals'>> = {}): Partial<Step1Parts> {
  const { changed_proposals: moved, progress, ...question } = reply as Partial<AnswerOut> & QuestionOut
  const parts: Partial<Step1Parts> = { ...(progress ? { progress } : {}), ...read }
  const questions = read.questions ?? queryClient.getQueryData<readonly QuestionOut[]>([...step1Key(projectId), 'questions'])
  if (questions) parts.questions = questions.map((q) => (q.id === question.id ? question : q))
  const proposals = queryClient.getQueryData<readonly ProposalOut[]>([...step1Key(projectId), 'proposals'])
  if (proposals && moved && moved.length > 0) {
    const byId = new Map(moved.map((p) => [p.id, p]))
    parts.proposals = proposals.map((p) => byId.get(p.id) ?? p)
  }
  return parts
}

/**
 * The Proposals, Questions, Coverage and progress that the rows, the frame's Count and the status bar's
 * Coverage are drawn from, as one snapshot: while any of the four is reloading, the last whole snapshot
 * stays, so no render shows one of them ahead of the others (S26-D7). `fresh` is what the caller reads of
 * the four (the frame needs the first two only); every caller sees the snapshot change in the same render.
 * The snapshot is the one person's, in the one project, in the one session: when the four's data is gone
 * (the cache reset for another person, or a project not yet read) or the session, person or project moves,
 * it is dropped and the caller shows its loading state, never the last person's rows.
 */
export function useSettled<T extends object>(projectId: string, fresh: T | null): T | null {
  const queryClient = useQueryClient()
  const fetching = useIsFetching({ predicate: isWhole(projectId) }) > 0
  const person = queryClient.getQueryData(sessionQuery.queryKey)?.user.id ?? ''
  const key = `${sessionEpoch(queryClient)}:${person}:${projectId}`
  const [held, setHeld] = useState<{ key: string; value: T | null }>({ key, value: fresh })
  const kept = held.key === key ? held.value : null
  const same = kept === fresh || (kept !== null && fresh !== null && Object.entries(fresh).every(([k, value]) => (kept as Record<string, unknown>)[k] === value))
  // Set while rendering: the snapshot moves when the reload has ended, and is dropped at once when the four's data is gone.
  if (fresh === null || !fetching) {
    if (!same || held.key !== key) setHeld({ key, value: fresh })
    return fresh
  }
  return kept
}

/** Everything Step 1 shows, or the first load's error. */
export function useStep1(projectId: string): { data: Step1Data | null; error: unknown; retry: () => void } {
  const proposals = useQuery(proposalsQuery(projectId))
  const questions = useQuery(questionsQuery(projectId))
  const coverage = useQuery(coverageQuery(projectId))
  const progress = useQuery(progressQuery(projectId))
  const parts = useSettled<Step1Parts>(
    projectId,
    proposals.data && questions.data && coverage.data && progress.data ? { proposals: proposals.data, questions: questions.data, coverage: coverage.data, progress: progress.data } : null,
  )
  const disciplines = progress.data?.disciplines.map((d) => d.discipline).filter((d): d is string => d !== null) ?? []
  const lists = useQueries({ queries: disciplines.map((d) => drawingListQuery(projectId, d)) })
  const fileNames = useQuery(fileNamesQuery(projectId))
  const all = [proposals, questions, coverage, progress]
  const error = all.find((q) => q.error)?.error ?? null
  const retryAll = () => {
    for (const q of all) if (q.error) void q.refetch()
  }
  if (!parts) return { data: null, error, retry: retryAll }
  const byDiscipline: Record<string, DrawingListOut | undefined> = {}
  disciplines.forEach((d, i) => {
    byDiscipline[d] = lists[i]?.data
  })
  return {
    data: {
      ...parts,
      lists: byDiscipline,
      fileNames: fileNames.data ?? {},
    },
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

/** A plan view's storeys as the QS typed them, each listed, and their meaning's key (S24-B2). */
export interface ViewStoreysChange {
  view: string
  storeys: string
  meaning: 'at_floor_level' | 'floor_to_floor'
}

/** What the form opened with, sent beside a save: the server refuses a value another person changed since. `views`: each plan view sent, by id. */
export interface OpenedWith {
  number: string
  title: string
  /** Each view sent, as the form opened with it, and how the form named it (a view read again since is named so in the 409). */
  views?: Record<string, { storeys: readonly string[]; meaning: string; title: string; place: number }>
}

/** A sheet's number, title or plan views' storeys as the QS corrected them (m0-screens §6.9, `E`): only what changed is sent. */
export async function correct(
  projectId: string,
  proposal: string,
  change: { number?: string; title?: string; views?: readonly ViewStoreysChange[] },
  opened?: OpenedWith,
): Promise<ActOut> {
  const { views, ...sheet } = change
  const body = { proposal, ...sheet, ...(views ? { views: views.map(({ view, storeys, meaning }) => ({ view, storeys, meaning })) } : {}) }
  // The values the form opened with, so a value another person corrected since is refused, not overwritten.
  const headers = opened ? { 'X-Step1-Opened-With': encodeURIComponent(JSON.stringify(opened)) } : undefined
  return unwrap(api.POST('/api/projects/{project_id}/takeoff/step1/correct', { ...path(projectId), body, headers }))
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

/**
 * Answers a Question with one of its options (21c); `text` only for "Type a number". `keep_open` keeps it open.
 * `held`: the sheets the QS saw it hold (S15-Q1: a kind Question that grew since is refused, 409).
 */
export async function answer(projectId: string, questionId: string, option: string, text = '', held?: readonly string[]): Promise<AnswerOut> {
  return unwrap(
    api.POST('/api/projects/{project_id}/takeoff/step1/questions/{question_id}/answer', {
      params: { path: { project_id: projectId, question_id: questionId } },
      body: held ? { option, text, held: [...held] } : { option, text },
    }),
  )
}
