/*
 * The Drawing Set page's data (docs/design/m0-screens.md §4.5): 14's operations on a project's files
 * (`vextrus/drawings/http/files.py`: list, cancel, restart, Discipline, report, the Market's
 * Disciplines) and 21a's upload (`vextrus/takeoff/http/upload.py`: one file per request, the multipart
 * part `file`). Every sentence is the machine's `{code, params}`, worded by the page from the
 * catalogue; the summary line is the API's own count, never a count of the rows (14's rulings).
 *
 *   const files = useQuery(filesQuery(project.id))
 *   const answer = await upload(project.id, file)       // an `UploadOut`, or an `ApiRefused` thrown
 */
import { queryOptions } from '@tanstack/react-query'
import { ApiRefused, api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'
import { EMPTY } from '@/format/numbers'
import type { MachineMessage } from '@/format/machine'

export type FilesOut = components['schemas']['FilesOut']
export type FileOut = components['schemas']['FileOut']
export type ReportOut = components['schemas']['ReportOut']
export type DisciplineOut = components['schemas']['DisciplineOut']
export type UploadOut = components['schemas']['UploadOut']

/** A file's row state (14's `FileState`): which acts its row offers. */
export type RowAct = 'cancel' | 'read_again' | 'try_again' | 'open_step1' | 'open_question'

/** States whose reading is under way: the row shows a progress line, and the list is read again. */
const MOVING = new Set(['waiting', 'reading', 'stopping', 'retrying'])

export function isMoving(file: Pick<FileOut, 'state'>): boolean {
  return MOVING.has(file.state)
}

/**
 * The acts §4.5's table gives a row, for a role that changes the Drawing Set (`change`) or one that
 * only looks. "Mark for Vextrus" has no operation here yet (not built in M0's 20b). "Open the Question"
 * reads, so every role has it on a held row, answered or not (#327).
 */
export function rowActs(file: Pick<FileOut, 'state' | 'format'>, changes: boolean): RowAct[] {
  switch (file.state) {
    case 'waiting':
    case 'reading':
    case 'retrying':
      return changes ? ['cancel'] : []
    case 'cancelled':
      return changes ? ['read_again'] : []
    case 'failed':
      return changes ? ['try_again'] : []
    case 'read':
      // A PDF is a Plot: its pages are seen from its DWG's sheets, never opened in Step 1 on their own.
      return file.format === 'dwg' ? ['open_step1'] : []
    case 'held':
      return ['open_question']
    default:
      return []
  }
}

/** A determinate share for the progress line, when the status counts its steps ("sheet 12 of 38"). */
export function progressShare(file: Pick<FileOut, 'status'>): number | undefined {
  const { position, total } = file.status.params
  if (typeof position !== 'number' || typeof total !== 'number' || total <= 0) return undefined
  return position / total
}

/**
 * The files in the table's order: the API's (the order added), with each PDF whose pages match a DWG's
 * sheets moved under that DWG (§4.5: "A DWG's PDF sits under it once its pages match its sheets").
 */
export function tableOrder(files: readonly FileOut[]): { file: FileOut; under: boolean }[] {
  const ids = new Set(files.map((f) => f.id))
  const plotOf = (f: FileOut) => (f.format === 'pdf' ? f.plot_for.find((id) => ids.has(id) && id !== f.id) : undefined)
  const rows: { file: FileOut; under: boolean }[] = []
  for (const f of files) {
    if (plotOf(f)) continue
    rows.push({ file: f, under: false })
    for (const pdf of files) if (plotOf(pdf) === f.id) rows.push({ file: pdf, under: true })
  }
  return rows
}

/** A Discipline's name in the language shown: that language's label, else its base language's, else any. */
export function disciplineName(discipline: DisciplineOut, locale: string): string {
  const { labels } = discipline
  return labels[locale] ?? labels[locale.split('-')[0] ?? ''] ?? Object.values(labels)[0] ?? EMPTY
}

/** A PDF report's sections in §4.5's order ("The report panel for a PDF"). */
export type PdfSection = 'made_by' | 'pages' | 'lettering' | 'layers' | 'pictures' | 'refused' | 'not_read'
export const PDF_SECTIONS: readonly PdfSection[] = ['made_by', 'pages', 'lettering', 'layers', 'pictures', 'refused', 'not_read']

/** Which section an `engine.pdf_report` sentence belongs to, by its code; none for any other code. */
export function pdfSectionOf(code: string): PdfSection | null {
  const name = /^engine\.pdf_report\.([a-z_]+)$/.exec(code)?.[1]
  if (!name) return null
  if (name.startsWith('made_by_')) return 'made_by'
  if (name === 'pages' || name === 'page_unreadable') return 'pages'
  if (name.startsWith('lettering_') || name.startsWith('fonts_') || name === 'unmapped_text') return 'lettering'
  if (name.startsWith('layers_')) return 'layers'
  if (name === 'pictures' || name === 'no_pictures' || name === 'mostly_picture' || name === 'scan_page') return 'pictures'
  // Refused is Vextrus declining a PDF (a scan, too many pages); a PDF it tried and could not read is "Not read".
  if (name === 'scan' || name === 'too_many_pages') return 'refused'
  if (name === 'locked' || name === 'unreadable' || name === 'limit_reached' || name === 'reader_failed') return 'not_read'
  // A sentence the web has not placed yet stays with what made the PDF, never under a heading that
  // says it was not read.
  return 'made_by'
}

/**
 * A PDF's report, its sentences in §4.5's sections: the API sends the PDF's own report as one list
 * (`made_by`) beside the page matching (`pages`), so each `engine.pdf_report` sentence goes to its
 * section by its code, the engine's page lines before the matching; any other sentence stays where
 * the API put it.
 */
export function pdfSections(report: Pick<ReportOut, 'made_by' | 'pages'>): Record<PdfSection, MachineMessage[]> {
  const out: Record<PdfSection, MachineMessage[]> = { made_by: [], pages: [], lettering: [], layers: [], pictures: [], refused: [], not_read: [] }
  const matching: MachineMessage[] = []
  for (const m of report.made_by) out[pdfSectionOf(m.code) ?? 'made_by'].push(m)
  for (const m of report.pages) {
    const section = pdfSectionOf(m.code)
    if (section) out[section].push(m)
    else matching.push(m)
  }
  out.pages.push(...matching)
  return out
}

const same = (a: MachineMessage, b: MachineMessage) =>
  a.code === b.code && JSON.stringify(Object.entries(a.params).sort()) === JSON.stringify(Object.entries(b.params).sort())

/**
 * Each sentence said once in the panel: `lists` with every sentence already said (by `said`, the
 * header's status and top line, or an earlier list) left out. The API repeats a file's finding in its
 * Readers section, and a failed file's reason is its status too.
 */
export function saidOnce(said: readonly MachineMessage[], lists: readonly (readonly MachineMessage[])[]): MachineMessage[][] {
  const seen = [...said]
  return lists.map((list) =>
    list.filter((m) => {
      if (seen.some((x) => same(x, m))) return false
      seen.push(m)
      return true
    }),
  )
}

/** A refusal is an answer, never tried again; an unreachable server keeps being tried. */
export function retry(failures: number, error: unknown): boolean {
  if (error instanceof ApiRefused) return false
  return error instanceof TypeError || failures < 2
}

/** How often the list is read again while a file is moving (§4.5: "watch them read"). */
export const POLL_MS = 2000

export function filesQuery(projectId: string) {
  return queryOptions({
    queryKey: ['drawing-set', projectId, 'files'],
    queryFn: () => unwrap(api.GET('/api/projects/{project_id}/drawings/files', { params: { path: { project_id: projectId } } })),
    staleTime: 0,
    retry,
    refetchInterval: (query) => (query.state.data?.files.some(isMoving) ? POLL_MS : false),
  })
}

export function disciplinesQuery(projectId: string) {
  return queryOptions({
    queryKey: ['drawing-set', projectId, 'disciplines'],
    queryFn: () => unwrap(api.GET('/api/projects/{project_id}/drawings/disciplines', { params: { path: { project_id: projectId } } })),
    staleTime: 5 * 60_000,
    retry,
  })
}

export function reportQuery(projectId: string, fileId: string, moving: boolean) {
  return queryOptions({
    queryKey: ['drawing-set', projectId, 'report', fileId],
    queryFn: () =>
      unwrap(api.GET('/api/projects/{project_id}/drawings/files/{file_id}/report', { params: { path: { project_id: projectId, file_id: fileId } } })),
    staleTime: 0,
    retry,
    refetchInterval: moving ? POLL_MS : false,
  })
}

export async function cancelReading(projectId: string, fileId: string): Promise<FileOut> {
  return unwrap(api.POST('/api/projects/{project_id}/drawings/files/{file_id}/cancel', { params: { path: { project_id: projectId, file_id: fileId } } }))
}

export async function restartReading(projectId: string, fileId: string): Promise<FileOut> {
  return unwrap(api.POST('/api/projects/{project_id}/drawings/files/{file_id}/restart', { params: { path: { project_id: projectId, file_id: fileId } } }))
}

export async function changeDiscipline(projectId: string, fileId: string, discipline: string): Promise<FileOut> {
  return unwrap(
    api.PUT('/api/projects/{project_id}/drawings/files/{file_id}/discipline', {
      params: { path: { project_id: projectId, file_id: fileId } },
      body: { discipline },
    }),
  )
}

/**
 * Adds one file (21a's operation): its own request, through the client's one transport, the file as
 * the multipart part `file`. Upload progress is not measured in M0: the transport is `fetch`, which
 * reports none.
 */
export async function upload(projectId: string, file: File): Promise<UploadOut> {
  const form = new FormData()
  form.append('file', file, file.name)
  return unwrap(
    api.POST('/api/projects/{project_id}/drawings/files', {
      params: { path: { project_id: projectId } },
      // The schema types the part as a string; the body is the form itself, sent as multipart.
      body: form as unknown as { file?: string | null },
    }),
  )
}
