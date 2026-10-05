/*
 * The Projects list's readings (docs/design/m0-screens.md §4.3): each row's Drawing Set, Takeoff and
 * Updated, from the operations the API already has, asked per project by the row that shows them.
 *
 *   GET /api/projects/{id}/drawings/files          filesQuery (the Drawing Set page's; polls while a file moves)
 *   GET /api/projects/{id}/takeoff/step1/progress  progressQuery (Step 1's), read again on each visit
 *   GET /api/activity?project={id}&limit=1         the newest act; only for a viewer with the acts grant
 *
 * The pure functions say what a cell holds (a kind and its numbers); ProjectsPage words them.
 *
 *   driveWords(files.files)        { kind: 'read', read: 6, held: 1, trouble: 0, refused: 0, stopped: 0 }
 *   takeoffWords(progress)         { kind: 'questions', open: 5 }
 *   updatedAt(created, files, act) the newest of the three instants, or null
 */
import { queryOptions } from '@tanstack/react-query'
import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'
import { filesQuery, isMoving, retry, type FileOut } from '@/drawing-set/data'
import { progressQuery, type ProgressOut } from '@/takeoff/data'

export { filesQuery, isMoving, progressQuery }

type ActOut = components['schemas']['ActOut']

/** Step 1's progress, read again whenever the list is opened (coming back from Step 1 shows its counts). */
export function listProgressQuery(projectId: string) {
  return queryOptions({ ...progressQuery(projectId), staleTime: 0, refetchOnMount: 'always' })
}

export const latestActKey = (projectId: string) => ['project-readings', projectId, 'latest-act'] as const

/** The project's newest act (its `occurred_at`), or null when it has none. */
export function latestActQuery(projectId: string, enabled: boolean) {
  return queryOptions({
    queryKey: latestActKey(projectId),
    queryFn: async (): Promise<ActOut | null> => (await unwrap(api.GET('/api/activity', { params: { query: { project: projectId, limit: 1 } } })))[0] ?? null,
    enabled,
    retry,
  })
}

// The Drawing Set cell. ---------------------------------------------------------------------------------

export type DriveWords =
  | { kind: 'none' }
  | { kind: 'reading'; files: number; sheet: { position: number; total: number } | null }
  | { kind: 'read'; read: number; held: number; trouble: number; refused: number; stopped: number }

/**
 * "No drawings yet"; "Reading 2 files" (with ", sheet 7 of 12" when exactly one file moves and its
 * status counts its sheets); else the files read and, above 0, those held, could not be read (`failed`
 * and `unreadable`), refused, and stopped (`cancelled`).
 */
export function driveWords(files: readonly Pick<FileOut, 'state' | 'status'>[]): DriveWords {
  if (files.length === 0) return { kind: 'none' }
  const moving = files.filter(isMoving)
  if (moving.length > 0) {
    const { position, total } = moving.length === 1 ? moving[0]!.status.params : {}
    const counted = typeof position === 'number' && typeof total === 'number' && total > 0
    return { kind: 'reading', files: moving.length, sheet: counted ? { position, total } : null }
  }
  const n = (...states: string[]) => files.filter((f) => states.includes(f.state)).length
  return { kind: 'read', read: n('read'), held: n('held'), trouble: n('failed', 'unreadable'), refused: n('refused'), stopped: n('cancelled') }
}

// The Takeoff cell. -------------------------------------------------------------------------------------

/** One Discipline's part, as the Step 1 inspector's PartsLine words it. */
export type TakeoffPart = { discipline: string | null } & (
  | { kind: 'confirmed' }
  | { kind: 'left'; sheets: number }
  | { kind: 'questions'; open: number }
  | { kind: 'unaccounted' }
)

export type TakeoffWords =
  | { kind: 'not_started' }
  | { kind: 'questions'; open: number }
  | { kind: 'to_confirm'; sheets: number }
  | { kind: 'not_confirmed' }
  | { kind: 'confirmed' }
  | { kind: 'parts'; parts: TakeoffPart[] }

/**
 * Only the Disciplines with sheets found count. None: "Not started". None confirmed: the open Questions,
 * else the sheets not yet decided, else "not yet confirmed". Any confirmed: each Discipline's part, or
 * "Step 1 confirmed" when every one is and no Discipline is still to come.
 */
export function takeoffWords(progress: Pick<ProgressOut, 'disciplines' | 'not_received'>): TakeoffWords {
  const rows = progress.disciplines.filter((d) => d.found > 0)
  if (rows.length === 0) return { kind: 'not_started' }
  const left = (d: (typeof rows)[number]) => Math.max(0, d.found - d.confirmed)
  if (!rows.some((d) => d.status === 'confirmed')) {
    const open = rows.reduce((sum, d) => sum + d.open_questions, 0)
    if (open > 0) return { kind: 'questions', open }
    const sheets = rows.reduce((sum, d) => sum + left(d), 0)
    if (sheets > 0) return { kind: 'to_confirm', sheets }
    return { kind: 'not_confirmed' }
  }
  if (rows.every((d) => d.status === 'confirmed') && progress.not_received.length === 0) return { kind: 'confirmed' }
  const parts = rows.map((d): TakeoffPart => {
    const discipline = d.discipline
    if (d.status === 'confirmed') return { discipline, kind: 'confirmed' }
    if (left(d) > 0) return { discipline, kind: 'left', sheets: left(d) }
    if (d.open_questions > 0) return { discipline, kind: 'questions', open: d.open_questions }
    return { discipline, kind: 'unaccounted' }
  })
  return { kind: 'parts', parts }
}

// The Updated cell. -------------------------------------------------------------------------------------

/** The newest of the project's created instant, its files' `added_at` and its newest act; null if none parses. */
export function updatedAt(createdAt: string | null | undefined, files: readonly Pick<FileOut, 'added_at'>[], latestAct: string | null | undefined): string | null {
  let newest: string | null = null
  let newestMs = -Infinity
  for (const at of [createdAt, ...files.map((f) => f.added_at), latestAct]) {
    const ms = at ? Date.parse(at) : NaN
    if (!Number.isNaN(ms) && ms > newestMs) {
      newest = at!
      newestMs = ms
    }
  }
  return newest
}
