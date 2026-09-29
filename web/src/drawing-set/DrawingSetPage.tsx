/*
 * The Drawing Set (docs/design/m0-screens.md §4.5; stories 6–20; wireframes `drawing-set-*.svg`): add a
 * project's DWG and PDF files, watch them read, stop or restart one, and read what Vextrus found about
 * each, in a QS's words. Sheets are not listed here; they are in Step 1.
 *
 * Header "Drawing Set", the API's summary line and "Add files"; a dashed drop strip; the file table
 * (File · Discipline · Status · Sheets found), each row's words from its status code and exactly the acts
 * its state allows. The whole page takes a drop. Each file is its own upload (21a's operation); what the
 * API answers is said: a toast for one file, a count for several, and each refusal in an error bar.
 * Selecting a row (click or Enter) opens its report docked on the right; Esc closes it.
 *
 * The MD and a Guest read it all: a ReadOnlyChip, and no adding, no Cancel or Read again, no Discipline
 * select (§1.4). Upload progress in percent, "Mark for Vextrus" and "Open the Question" are not built:
 * the upload goes through the client's one transport (`fetch`, which reports no progress), and the
 * other two have no operation yet.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { FileUp } from 'lucide-react'
import { ApiRefused } from '@/api/client'
import { PATHS, useGo } from '@/app/AppLink'
import { PageLayout } from '@/app/Frame'
import { sessionQuery, type ProjectSummary } from '@/app/session'
import { LoadProblem, ProblemBar, ProblemWords, can, useReadOnlyToast, problemOf, readOnlyRole, sameSession, usePageTitle, useSignedInAgain, type Problem } from '@/auth'
import { EMPTY, useFormat } from '@/format'
import { MachineText, machineText } from '@/format/machine'
import { Button, DrawingText, ErrorBar, ProgressLine, ExcludedGlyph, KeyRegion, QuestionGlyph, ReadOnlyChip, Skeleton, cn, useKeys, useToast } from '@/ui'
import {
  cancelReading,
  changeDiscipline,
  disciplinesQuery,
  filesQuery,
  isMoving,
  progressShare,
  restartReading,
  rowActs,
  tableOrder,
  upload,
  type DisciplineOut,
  type FileOut,
  type FilesOut,
  type RowAct,
  type UploadOut,
} from './data'
import { DisciplineSelect, useDisciplineName } from './discipline'
import { ReportPanel } from './ReportPanel'

const projectRoute = getRouteApi('/_app/p/$code')

/** The table keeps at least this width, the report open, at 1280 (§4.5). */
const TABLE_MIN_PX = 752

/** The file on its way up, and where it is among those added together. */
interface Uploading {
  name: string
  position: number
  total: number
}

/** One file's answer to its upload. */
type Answer = { file: string; out: UploadOut } | { file: string; problem: NonNullable<Problem> }

/** The 3 px line under a moving file's words: determinate when its status counts its steps. */
function RowProgress({ share }: { share?: number }) {
  return (
    <span aria-hidden className="absolute inset-x-2 bottom-[3px] block h-progress-line overflow-hidden rounded-full bg-border">
      {share === undefined ? (
        <span className="progress-sweep rounded-full" />
      ) : (
        <span className="absolute inset-y-0 start-0 rounded-full bg-primary" style={{ width: `${Math.min(1, Math.max(0, share)) * 100}%` }} />
      )}
    </span>
  )
}

function StatusCell({ file }: { file: FileOut }) {
  const { i18n } = useLingui()
  const f = useFormat()
  const moving = isMoving(file) && file.state !== 'stopping'
  return (
    <td
      className={cn('relative h-row truncate px-2 align-middle', file.state === 'refused' && 'text-muted-foreground')}
      title={machineText(file.status, f, i18n)}
    >
      <span className="inline-flex max-w-full items-center gap-1.5">
        {file.state === 'held' ? <QuestionGlyph size={14} className="shrink-0 text-question" aria-hidden /> : null}
        {file.state === 'refused' ? <ExcludedGlyph size={14} className="shrink-0 text-excluded" aria-hidden /> : null}
        <span className="truncate">
          <MachineText message={file.status} />
        </span>
      </span>
      {moving ? <RowProgress share={progressShare(file)} /> : null}
    </td>
  )
}

function Head({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn('h-row px-2 text-start align-middle text-xs font-semibold text-ink-secondary', className)}>{children}</th>
}

function ActButton({ act, busy, onAct }: { act: RowAct; busy: boolean; onAct: () => void }) {
  const words: Record<RowAct, ReactNode> = {
    cancel: <Trans>Cancel reading</Trans>,
    read_again: <Trans>Read again</Trans>,
    try_again: <Trans>Try again</Trans>,
    open_step1: <Trans>Open in Step 1</Trans>,
  }
  return (
    <Button
      variant={act === 'cancel' ? 'ghost' : 'secondary'}
      // 24 px in a 28 px row, its ring at the button's edge (as the Members page's acts).
      className="h-[24px]! focus-visible:outline-offset-0"
      saving={busy}
      onClick={(event) => {
        event.stopPropagation()
        onAct()
      }}
    >
      {words[act]}
    </Button>
  )
}

interface TableProps {
  rows: { file: FileOut; under: boolean }[]
  disciplines: readonly DisciplineOut[] | undefined
  changes: boolean
  busy: string | null
  openId: string | null
  pulseId: string | null
  focusedId: string | null
  onFocus: (id: string) => void
  onOpen: (id: string, from: HTMLElement) => void
  onAct: (act: RowAct, file: FileOut) => void
  onDiscipline: (file: FileOut, key: string) => void
}

function FilesTable(props: TableProps) {
  const { rows, disciplines, changes, busy, openId, pulseId, onFocus, onOpen, onAct, onDiscipline } = props
  const { t } = useLingui()
  const f = useFormat()
  const nameOf = useDisciplineName(disciplines)
  const ids = rows.map((r) => r.file.id)
  const focusedId = props.focusedId !== null && ids.includes(props.focusedId) ? props.focusedId : (ids[0] ?? null)
  const rowEls = useRef(new Map<string, HTMLTableRowElement>())

  const onRow = () => document.activeElement instanceof HTMLTableRowElement && document.activeElement.dataset.file !== undefined
  function move(to: number) {
    if (ids.length === 0) return
    const id = ids[Math.max(0, Math.min(ids.length - 1, to))]!
    onFocus(id)
    rowEls.current.get(id)?.focus()
  }
  const at = focusedId === null ? -1 : ids.indexOf(focusedId)
  useKeys([
    { key: '↑', label: t`Previous file`, group: 'screen', when: onRow, run: () => move(at - 1) },
    { key: '↓', label: t`Next file`, group: 'screen', when: onRow, run: () => move(at + 1) },
    { key: 'Home', label: t`First file`, group: 'screen', when: onRow, run: () => move(0) },
    { key: 'End', label: t`Last file`, group: 'screen', when: onRow, run: () => move(ids.length - 1) },
    {
      key: 'Enter',
      label: t`Open the file’s report`,
      group: 'screen',
      when: onRow,
      run: () => {
        const el = document.activeElement
        if (el instanceof HTMLTableRowElement && el.dataset.file) onOpen(el.dataset.file, el)
      },
    },
  ])

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table aria-label={t`Files`} style={{ minWidth: TABLE_MIN_PX }} className="w-full table-fixed border-collapse bg-paper text-sm">
        <colgroup>
          <col style={{ width: '28%' }} />
          <col style={{ width: 170 }} />
          <col />
          <col style={{ width: 104 }} />
          <col style={{ width: 144 }} />
        </colgroup>
        <thead className="border-b border-border bg-chrome-sunken">
          <tr>
            <Head>
              <Trans>File</Trans>
            </Head>
            <Head>
              <Trans>Discipline</Trans>
            </Head>
            <Head>
              <Trans>Status</Trans>
            </Head>
            <Head className="text-end">
              <Trans>Sheets found</Trans>
            </Head>
            <Head className="sticky end-0 bg-chrome-sunken">
              <span className="sr-only">
                <Trans>Actions</Trans>
              </span>
            </Head>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ file, under }) => {
            const acts = rowActs(file, changes)
            const open = openId === file.id
            return (
              <tr
                key={file.id}
                ref={(el) => {
                  if (el) rowEls.current.set(file.id, el)
                  else rowEls.current.delete(file.id)
                }}
                data-file={file.id}
                tabIndex={file.id === focusedId ? 0 : -1}
                aria-current={open || undefined}
                onFocus={(event) => {
                  if (event.target === event.currentTarget) onFocus(file.id)
                }}
                onClick={(event) => {
                  onFocus(file.id)
                  onOpen(file.id, event.currentTarget)
                }}
                className={cn(
                  'cursor-default border-b border-border last:border-b-0 hover:bg-hover',
                  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                  open && 'bg-selected',
                  pulseId === file.id && 'arrive',
                )}
              >
                <td className={cn('h-row truncate px-2 align-middle', under && 'ps-7')} title={file.name}>
                  <DrawingText kind="file-name" text={file.name} />
                </td>
                <td className="h-row truncate px-1 align-middle">
                  {changes && disciplines ? (
                    <DisciplineSelect
                      fileName={file.name}
                      value={file.discipline}
                      disciplines={disciplines}
                      disabled={busy !== null}
                      onChange={(key) => onDiscipline(file, key)}
                    />
                  ) : (
                    <span className="px-1">{file.discipline ? nameOf(file.discipline) : EMPTY}</span>
                  )}
                </td>
                <StatusCell file={file} />
                <td className="num h-row px-2 text-end align-middle">{file.sheets_found === null ? EMPTY : f.integer(file.sheets_found)}</td>
                <td className={cn('sticky end-0 h-row px-2 text-end align-middle whitespace-nowrap', open ? 'bg-selected' : 'bg-paper')}>
                  <span className="inline-flex justify-end gap-1.5">
                    {acts.map((act) => (
                      <ActButton key={act} act={act} busy={busy === `${act}:${file.id}`} onAct={() => onAct(act, file)} />
                    ))}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Why one file of a drop was not added, naming it: a refusal that names the file says so itself; any
 * other ("Upload stopped: the connection dropped.", out of reach, a fault) is put after the file's name,
 * with what to do.
 */
function NotAdded({ file, problem }: { file: string; problem: NonNullable<Problem> }) {
  const f = useFormat()
  if ('refusal' in problem && 'file' in problem.refusal.params) return <ProblemWords problem={problem} />
  const name = <DrawingText kind="file-name" text={file} truncate={false} />
  if ('unreachable' in problem) return <Trans>{name} was not added. Vextrus can’t be reached. Check your connection and add it again.</Trans>
  if ('failed' in problem) return <Trans>{name} was not added. Vextrus could not add it just now. Add it again in a minute.</Trans>
  // Refusals that name no file, worded around the file's name so "not added" is said once.
  const { code, params } = problem.refusal
  if (code === 'drawings.uploads.stopped')
    return (
      // §4.5's sentence verbatim, then what to do.
      <Trans>
        {name} was not added. <MachineText message={problem.refusal} /> Add it again.
      </Trans>
    )
  if (code === 'drawings.uploads.malformed')
    return <Trans>{name} was not added: it could not be received. If its name is very long, shorten it and add it again. If this keeps happening, tell Vextrus.</Trans>
  if (code === 'drawings.uploads.no_name') return <Trans>{name} was not added: Vextrus cannot use its name. Rename it and add it again.</Trans>
  if (code === 'drawings.uploads.too_large_unnamed' && typeof params.megabytes === 'number') {
    const megabytes = f.integer(params.megabytes)
    return <Trans>{name} is larger than {megabytes} MB, so it was not added. Tell Vextrus if your drawings need more.</Trans>
  }
  return (
    <Trans>
      {name} was not added. <MachineText message={problem.refusal} />
    </Trans>
  )
}

/**
 * Whether a drag may carry files: it says so, or says nothing (a browser may not name what is dragged
 * until the drop). Text or a link dragged within the page names itself and is left alone.
 */
function carriesFiles(event: DragEvent): boolean {
  const types = Array.from(event.dataTransfer?.types ?? [])
  return types.length === 0 || types.includes('Files')
}

/**
 * The whole page takes a drop while mounted: `onFiles` gets them; `dragging` shows the overlay. For a
 * role that only looks (`accepts` false) a drop is refused: the browser neither opens the file in place
 * of the page nor offers to drop, and a drop that lands anyway goes to `onRefused`.
 */
function usePageDrop(accepts: boolean, onFiles: (files: File[]) => void, onRefused: () => void): boolean {
  const [dragging, setDragging] = useState(false)
  const depth = useRef(0)
  const latest = useRef({ onFiles, onRefused })
  useEffect(() => {
    latest.current = { onFiles, onRefused }
  })
  useEffect(() => {
    if (!accepts) {
      const refuse = (event: DragEvent) => {
        if (!carriesFiles(event)) return
        event.preventDefault()
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'none'
      }
      const dropped = (event: DragEvent) => {
        if (!carriesFiles(event)) return
        event.preventDefault()
        latest.current.onRefused()
      }
      document.addEventListener('dragover', refuse)
      document.addEventListener('drop', dropped)
      return () => {
        document.removeEventListener('dragover', refuse)
        document.removeEventListener('drop', dropped)
      }
    }
    const enter = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      event.preventDefault()
      depth.current += 1
      setDragging(true)
    }
    const over = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
      setDragging(true)
    }
    const leave = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDragging(false)
    }
    const drop = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      event.preventDefault()
      depth.current = 0
      setDragging(false)
      const files = Array.from(event.dataTransfer?.files ?? [])
      if (files.length) latest.current.onFiles(files)
    }
    document.addEventListener('dragenter', enter)
    document.addEventListener('dragover', over)
    document.addEventListener('dragleave', leave)
    document.addEventListener('drop', drop)
    return () => {
      document.removeEventListener('dragenter', enter)
      document.removeEventListener('dragover', over)
      document.removeEventListener('dragleave', leave)
      document.removeEventListener('drop', drop)
      depth.current = 0
      setDragging(false)
    }
  }, [accepts])
  return dragging
}

export function DrawingSetView({ project }: { project: ProjectSummary }) {
  const { t, i18n } = useLingui()
  const f = useFormat()
  const toast = useToast()
  const go = useGo()
  const queryClient = useQueryClient()
  const { data: session } = useSuspenseQuery(sessionQuery)
  const changes = can(session, 'change')
  const readOnly = readOnlyRole(session)
  const files = useQuery(filesQuery(project.id))
  const disciplines = useQuery(disciplinesQuery(project.id))
  const [openId, setOpenId] = useState<string | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [uploading, setUploading] = useState<Uploading | null>(null)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<Problem>(null)
  const [refused, setRefused] = useState<{ key: string; problem: NonNullable<Problem> }[]>([])
  const [pulseId, setPulseId] = useState<string | null>(null)
  const chooser = useRef<HTMLInputElement>(null)
  useSignedInAgain(setProblem)
  const projectName = project.name

  useEffect(() => {
    if (pulseId === null) return
    const timer = window.setTimeout(() => setPulseId(null), 1200)
    return () => window.clearTimeout(timer)
  }, [pulseId])

  const filesKey = filesQuery(project.id).queryKey
  const putFile = (next: FileOut) =>
    queryClient.setQueryData<FilesOut>(filesKey, (old) => (old ? { ...old, files: old.files.map((f) => (f.id === next.id ? next : f)) } : old))

  /** One act; its answer is said only while the session is still the one that asked. */
  async function run(key: string, work: (current: () => boolean) => Promise<void>) {
    const current = sameSession(queryClient)
    setBusy(key)
    setProblem(null)
    try {
      await work(current)
    } catch (error) {
      if (current()) setProblem(problemOf(error))
    } finally {
      setBusy(null)
      if (current()) await queryClient.invalidateQueries({ queryKey: ['drawing-set', project.id] })
    }
  }

  function act(which: RowAct, file: FileOut) {
    const key = `${which}:${file.id}`
    if (which === 'open_step1') return go(PATHS.takeoff(project.code, 1))
    if (which === 'cancel') {
      return void run(key, async (current) => {
        const next = await cancelReading(project.id, file.id)
        if (current()) putFile(next)
      })
    }
    void run(key, async (current) => {
      const next = await restartReading(project.id, file.id)
      if (current()) putFile(next)
    })
  }

  function discipline(file: FileOut, key: string) {
    if (key === file.discipline) return
    void run(`discipline:${file.id}`, async (current) => {
      const next = await changeDiscipline(project.id, file.id, key)
      if (current()) putFile(next)
    })
  }

  /** Each file on its own, one after another; then what they came to. A later drop waits its turn. */
  /** "3 files added; 1 was already here.": what several files at once came to. */
  function severalAdded(added: number, already: number, replaced: number, notAdded: number): string {
    return t`${plural(added, { 0: 'No files added', one: '# file added', other: '# files added' })}${plural(already, { 0: '', one: '; # was already here', other: '; # were already here' })}${plural(replaced, { 0: '', one: "; # replaced Vextrus's damaged copy", other: "; # replaced Vextrus's damaged copies" })}${plural(notAdded, { 0: '', one: '; # was not added', other: '; # were not added' })}.`
  }

  /** Batches dropped and not yet answered: while one runs, a new drop keeps the bars already shown. */
  const inFlight = useRef(0)

  function add(chosen: readonly File[]) {
    if (!changes || chosen.length === 0) return
    // The session the files were dropped in: a batch waiting its turn across a change of session is
    // never sent for whoever is signed in by then.
    const current = sameSession(queryClient)
    if (inFlight.current === 0) {
      setRefused([])
      setProblem(null)
    }
    inFlight.current += 1
    // A later drop waits for the one before, even one that failed.
    const next = queue.current.then(() => addEach(chosen, current)).finally(() => {
      inFlight.current -= 1
    })
    queue.current = next.catch(() => undefined)
    void next
  }

  /** Why a file was not added; an answer that is neither a refusal nor out of reach is a fault, said as one. */
  function whyNot(error: unknown): NonNullable<Problem> {
    try {
      return problemOf(error) ?? { failed: true }
    } catch {
      console.error(error)
      return { failed: true }
    }
  }

  async function addEach(chosen: readonly File[], current: () => boolean) {
    const answers: Answer[] = []
    try {
      for (const [i, file] of chosen.entries()) {
        // Signed out, switched or someone else meanwhile: the files were chosen for no one on screen now.
        if (!current()) return
        setUploading({ name: file.name, position: i + 1, total: chosen.length })
        try {
          answers.push({ file: file.name, out: await upload(project.id, file) })
        } catch (error) {
          answers.push({ file: file.name, problem: whyNot(error) })
        }
        if (current()) await queryClient.invalidateQueries({ queryKey: filesKey })
      }
    } finally {
      setUploading(null)
    }
    if (!current()) return
    const said = answers.flatMap((a) => ('problem' in a ? [{ key: a.file, problem: a.problem }] : []))
    setRefused((before) => [...before, ...said])
    const outs = answers.flatMap((a) => ('out' in a ? [a.out] : []))
    const added = outs.filter((o) => o.outcome === 'added').length
    const already = outs.filter((o) => o.outcome === 'already_here').length
    const replaced = outs.filter((o) => o.outcome === 'replaced').length
    const again = outs.findLast((o) => o.outcome === 'already_here')
    if (again) setPulseId(again.file.id)
    // The toast is plain text: it shows outside the page, where only the words travel.
    const lines = outs.flatMap((o) => (o.message && (chosen.length === 1 || o.outcome !== 'already_here') ? [machineText(o.message, f, i18n)] : []))
    // Several: what they came to, unless nothing was added or already here (each error bar says why).
    if (chosen.length > 1 && added + already + replaced > 0) lines.unshift(severalAdded(added, already, replaced, said.length))
    if (lines.length) toast.show({ message: lines.join(' ') })
  }

  const refuseReadOnly = useReadOnlyToast()
  const dragging = usePageDrop(
    changes,
    (dropped) => void add(dropped),
    () => (readOnly ? refuseReadOnly(readOnly) : undefined),
  )

  const list = files.data
  const rows = list ? tableOrder(list.files) : []
  const openFile = rows.find((r) => r.file.id === openId)?.file ?? null
  const empty = list !== undefined && list.files.length === 0 && uploading === null
  const failed = files.error instanceof ApiRefused ? files.error : null

  function close() {
    setOpenId(null)
    opener.current?.focus()
  }

  const choose = () => chooser.current?.click()
  const upName = uploading?.name ?? ''
  const upAt = f.integer(uploading?.position ?? 0)
  const upOf = f.integer(uploading?.total ?? 0)

  return (
    <PageLayout
      panel={
        openFile ? <ReportPanel key={openFile.id} projectId={project.id} file={openFile} disciplines={disciplines.data} onClose={close} /> : undefined
      }
    >
      <header className="mb-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl">
            <Trans>Drawing Set</Trans>
          </h1>
          {list && list.files.length > 0 ? (
            <p className="text-sm text-ink-secondary">
              <MachineText message={list.summary} />
            </p>
          ) : null}
        </div>
        {readOnly ? <ReadOnlyChip role={readOnly} /> : null}
        {changes && !empty ? (
          <Button variant="primary" onClick={choose}>
            <Trans>Add files</Trans>
          </Button>
        ) : null}
      </header>

      {changes ? (
        <input
          ref={chooser}
          type="file"
          multiple
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          onChange={(event) => {
            const chosen = Array.from(event.currentTarget.files ?? [])
            event.currentTarget.value = ''
            void add(chosen)
          }}
        />
      ) : null}

      <div aria-live="polite" className="flex flex-col gap-2">
        <ProblemBar problem={problem} className="mb-2" />
        {refused.map((r, i) => (
          <ErrorBar key={`${r.key}-${i}`} className="mb-2">
            <NotAdded file={r.key} problem={r.problem} />
          </ErrorBar>
        ))}
      </div>

      {changes && !empty ? (
        <button
          type="button"
          tabIndex={-1}
          onClick={choose}
          className="mb-4 flex h-9 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border-strong text-sm text-ink-secondary hover:bg-hover"
        >
          <FileUp aria-hidden size={16} strokeWidth={1.5} />
          <Trans>Drop DWG and PDF files here to add them, or choose files.</Trans>
        </button>
      ) : null}

      {uploading ? (
        <ProgressLine className="mb-4">
          {uploading.total > 1 ? (
            <Trans>
              Uploading <DrawingText kind="file-name" text={upName} truncate={false} /> ({upAt} of {upOf})
            </Trans>
          ) : (
            <Trans>
              Uploading <DrawingText kind="file-name" text={upName} truncate={false} />
            </Trans>
          )}
        </ProgressLine>
      ) : null}

      {list ? (
        empty ? (
          <div
            className={cn(
              'flex flex-col items-center justify-center gap-3 px-6 text-center',
              changes ? 'h-[300px] rounded-md border border-dashed border-border-strong' : 'py-10',
            )}
          >
            <FileUp aria-hidden size={20} strokeWidth={1.5} className="text-muted-foreground" />
            <p className="text-md">
              <Trans>No drawings yet.</Trans>
            </p>
            {changes ? (
              <>
                <p className="max-w-[56ch] text-sm text-ink-secondary">
                  <Trans>Drop the Drawing Set's DWG files here, with the PDFs plotted from them if you have them.</Trans>
                </p>
                <Button variant="primary" onClick={choose}>
                  <Trans>Choose files</Trans>
                </Button>
                <p className="text-xs text-ink-secondary">
                  <Trans>Vextrus reads DWG and PDF files. Scanned drawings cannot be read.</Trans>
                </p>
              </>
            ) : null}
          </div>
        ) : (
          <KeyRegion name="list">
            <FilesTable
              rows={rows}
              disciplines={disciplines.data}
              changes={changes}
              busy={busy}
              openId={openId}
              pulseId={pulseId}
              focusedId={focusedId}
              onFocus={setFocusedId}
              onOpen={(id, from) => {
                opener.current = from
                setOpenId(id)
              }}
              onAct={act}
              onDiscipline={discipline}
            />
          </KeyRegion>
        )
      ) : failed ? (
        <LoadProblem error={failed} onRetry={() => void files.refetch()} />
      ) : (
        <Skeleton rows={4} status={<Trans>Opening the Drawing Set…</Trans>} />
      )}

      {dragging ? (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-paper/80">
          <p className="rounded-md border-2 border-dashed border-primary bg-paper px-6 py-4 text-md">
            <Trans>Drop to add to {projectName}'s Drawing Set</Trans>
          </p>
        </div>
      ) : null}
    </PageLayout>
  )
}

export function DrawingSetPage() {
  const { t } = useLingui()
  const project = projectRoute.useLoaderData()
  usePageTitle(t`Drawing Set`)
  return <DrawingSetView project={project} />
}

/** Loading (§4.5, "Page states"): the header, then four Skeleton rows. */
export function DrawingSetLoading() {
  return (
    <PageLayout>
      <header className="mb-3">
        <h1 className="text-xl">
          <Trans>Drawing Set</Trans>
        </h1>
      </header>
      <Skeleton rows={4} status={<Trans>Opening the Drawing Set…</Trans>} />
    </PageLayout>
  )
}
