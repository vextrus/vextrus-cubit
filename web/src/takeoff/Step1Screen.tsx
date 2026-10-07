/*
 * Step 1 on layout A, "List ⇄ Sheet" (ticket 22; docs/design/m0-screens.md §4.7, §5, §6): the canvas
 * of the Takeoff's frame at `/p/:code/takeoff/1`. List mode shows the sheet list (SheetList); Space
 * opens the focused sheet in the viewer (16's SheetViewer) and goes back; the Confirmation bar at the
 * canvas foot says what Enter does (Bar); X opens the exclusion picker; Ctrl Z undoes the user's last
 * act. The toolbar, status bar and inspector are filled through the frame's slots.
 *
 * Keys go through the key map (m0-screens §2, §6.15): Space at region scope on the list and on the
 * sheet (so the list's own Space-to-select is off), everything else at the screen's scope. The MD and
 * a Guest see everything and change nothing: a key that would change something says so (§1.4).
 *
 * The toolbar's Count ("Confirmed 16 / 24, 1 excluded") is the frame's (03), read from the session's
 * project summary; the API does not send Step 1's counts there, so this screen writes what it reads
 * from 19a into that summary (the rail's mark and count follow).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useIsFetching, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi, useSearch } from '@tanstack/react-router'
import { ChevronDown, ChevronLeft, ChevronRight, Crosshair, Layers, MoreHorizontal } from 'lucide-react'
import { AppLink, PATHS } from '@/app/AppLink'
import { sessionQuery, type ProjectSummary, type Session } from '@/app/session'
import { SlotFill } from '@/app/slots'
import { LoadProblem, readOnlyRole, usePageTitle, useReadOnlyToast } from '@/auth'
import { SheetViewer, type SheetOutline } from '@/sheet'
import { useFormat } from '@/format'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/ui/primitives/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/primitives/popover'
import { DrawingText, Empty, IconButton, KeyCombo, KeyRegion, KeyScope, Skeleton, SheetsGlyph, buttonVariants, cn, isolateLtr, useKeys, useToast } from '@/ui'
import { SheetName, useStep1Acts } from './acts'
import { PAPER_AS_READ, useSheetLook, type LookSetting } from './SheetLook'
import { Bar, ExclusionPicker, useBar, type BarSpec } from './Bar'
import { renderQuery, useStep1, type CoverageOut, type ProposalOut, type Step1Data, type ViewOut } from './data'
import { DrawingListDialog } from './DrawingListDialog'
import { step1Key } from './data'
import { FilesBand } from './FilesBand'
import { ReportPanel } from '@/drawing-set/ReportPanel'
import { POLL_MS, disciplinesQuery, filesQuery, isMoving, type FileOut } from '@/drawing-set/data'
import { nextOpenRow, step1Model, type Reason, type Row, type Step1Model } from './model'
import { SheetList, disciplineName } from './SheetList'
import { OTHER_VIEW_KIND, VIEW_KINDS } from './words'
import { stripSlots } from './storeys'
import { CoverageLine, CoveragePanel, Overview, QuestionCard, QuestionsTab, SheetFacts, cardContext, type Answerer, type Pick } from './Step1Inspector'
import { Copy, optionsOf, prePick } from './questionWords'
import type { QuestionEntry } from './model'

/** The picker's row when it stands for the sheets of several selected rows. */
const SELECTION_KEY = 'selection'

const projectRoute = getRouteApi('/_app/p/$code')

export function Step1Page() {
  const { t } = useLingui()
  usePageTitle(t`Step 1, Sheets`)
  const { data: session } = useSuspenseQuery(sessionQuery)
  const project = projectRoute.useLoaderData()
  const { data, error, retry } = useStep1(project.id)
  const reading = useRefreshAsFilesFinish(project.id)
  if (!data) {
    if (error) return <LoadProblem error={error} onRetry={retry} className="m-4" />
    return <Skeleton rows={10} className="m-4" status={<Trans>Opening Step 1…</Trans>} />
  }
  if (data.proposals.length === 0 && data.questions.length === 0 && reading.length > 0) return <NoSheetsYet project={project} reading={reading} />
  if (data.proposals.length === 0 && data.questions.length === 0) return <NoSheets project={project} readOnly={readOnlyRole(session) !== null} />
  return (
    <KeyScope level="screen" name="step1">
      <Step1 session={session} project={project} model={step1Model(data)} coverage={data.coverage} drawn={data} reading={reading} />
    </KeyScope>
  )
}

/** How often Step 1 asks for the files while none moves: a file added in another tab, or by a colleague, starts its row and refresh. */
const IDLE_POLL_MS = 30_000

/**
 * The Drawing Set's files still reading (waiting, reading or retrying; a file being stopped adds no
 * sheets). Whenever a file changes state, Step 1's answers are fetched again, so a file's sheets, the
 * Count and Coverage arrive without a reload as it finishes. The files are asked for every 2 s while
 * one moves, every 30 s otherwise and on coming back to the tab. On the first files answer, Step 1's
 * answers are fetched again unless they arrived after it (a tie counts as before): sent together, the server may answer Step 1
 * first and finish a file before it answers the files, which then show nothing moving to wait for.
 */
function useRefreshAsFilesFinish(projectId: string): FileOut[] {
  const qc = useQueryClient()
  const files = useQuery({
    ...filesQuery(projectId),
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (query.state.data?.files.some(isMoving) ? POLL_MS : IDLE_POLL_MS),
    // Step 1's whole screen hangs on this: it re-renders when the files change, never at each poll (CI's slowed run).
    notifyOnChangeProps: ['data'],
  })
  const list = files.data?.files
  const states = list?.map((f) => `${f.id}:${f.state}`).join(',')
  const seen = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (states === undefined || states === seen.current) return
    const first = seen.current === undefined
    seen.current = states
    const step1At = qc.getQueryState([...step1Key(projectId), 'proposals'])?.dataUpdatedAt ?? 0
    const answeredAt = qc.getQueryState(filesQuery(projectId).queryKey)?.dataUpdatedAt ?? 0
    if (!first || step1At <= answeredAt) void qc.invalidateQueries({ queryKey: step1Key(projectId) })
  }, [states, qc, projectId])
  return (list ?? []).filter((f) => isMoving(f) && f.state !== 'stopping')
}

/** m0-screens §4.7, "Files still reading": one row per file above the list, or alone while no file is read yet. */
function StillReading({ files }: { files: readonly FileOut[] }) {
  if (files.length === 0) return null
  return (
    <div role="status" className="flex flex-col gap-0.5 border-b border-border px-3 py-1.5 text-xs text-ink-secondary">
      {files.map((file) => (
        <p key={file.id}>
          <StillReadingLine file={file} />
        </p>
      ))}
    </div>
  )
}

/**
 * One file's row: what it is doing (§4.7's "Still reading KR-ELE-R0.dwg: sheet 2 of 3." while it reads
 * sheets; a waiting or interrupted file says so, never "Still reading"), then what it will add. A PDF is
 * a Plot: its pages are matched to sheets and never join the list as rows of their own.
 */
function StillReadingLine({ file }: { file: FileOut }) {
  const f = useFormat()
  const name = <DrawingText kind="file-name" text={file.name} truncate={false} className="text-foreground" />
  const { position, total } = file.status.params as { position?: unknown; total?: unknown }
  const counted = typeof position === 'number' && typeof total === 'number'
  const code = file.status.code
  const at = counted ? f.integer(position) : ''
  const of = counted ? f.integer(total) : ''
  let doing
  if (file.state === 'waiting') doing = <Trans>{name} is waiting to be read.</Trans>
  else if (file.state === 'retrying') doing = <Trans>Reading {name} was interrupted and is starting again.</Trans>
  else if (counted && (code === 'drawings.files.reading_sheet' || code === 'drawings.files.reading_sheet_left'))
    doing = (
      <Trans>
        Still reading {name}: sheet {at} of {of}.
      </Trans>
    )
  else if (counted && (code === 'drawings.files.reading_page' || code === 'drawings.files.reading_page_left'))
    doing = (
      <Trans>
        Still reading {name}: page {at} of {of}.
      </Trans>
    )
  else doing = <Trans>Still reading {name}.</Trans>
  return (
    <>
      {doing} {file.format === 'pdf' ? <Trans>Its pages are matched to sheets when it is read.</Trans> : <Trans>Its sheets join the list when it is read.</Trans>}
    </>
  )
}

/**
 * No sheets in Step 1 yet while files read: the files band (each file's chip, its report and Cancel in
 * the inspector, as in list mode), §4.7's row for each file, and the way to the Drawing Set; never
 * "No sheets yet. Add the Drawing Set's files first."
 */
function NoSheetsYet({ project, reading }: { project: ProjectSummary; reading: readonly FileOut[] }) {
  const disciplines = useQuery(disciplinesQuery(project.id))
  const [file, setFile] = useState<FileOut | null>(null)
  const name = <DrawingText kind="file-name" text={reading[0]!.name} truncate={false} />
  return (
    <div className="flex h-full flex-col">
      <SlotFill slot="inspector.selection">
        {file ? (
          <ReportPanel key={file.id} projectId={project.id} file={file} disciplines={disciplines.data} onClose={() => setFile(null)} />
        ) : (
          <p className="p-3 text-sm text-muted-foreground">
            {reading.length === 1 ? <Trans>No sheets yet: they arrive as {name} is read.</Trans> : <Trans>No sheets yet: they arrive as the files are read.</Trans>}
          </p>
        )}
      </SlotFill>
      <FilesBand projectId={project.id} onOpen={setFile} />
      <StillReading files={reading} />
      <div className="p-3">
        <AppLink to={PATHS.drawingSet(project.code)} className={buttonVariants({ variant: 'secondary' })}>
          <Trans>Go to the Drawing Set</Trans>
        </AppLink>
      </div>
    </div>
  )
}

function NoSheets({ project, readOnly }: { project: ProjectSummary; readOnly: boolean }) {
  // The last file just finished and its sheets are on their way: never "Add the Drawing Set's files first"
  // meanwhile. Asked only here, with nothing to show: Step 1's own screen never re-renders as its queries fetch.
  const refreshing = useIsFetching({ queryKey: step1Key(project.id) }) > 0
  if (refreshing) return <Skeleton rows={10} className="m-4" status={<Trans>Opening Step 1…</Trans>} />
  return (
    <div className="flex h-full items-center justify-center">
      <SlotFill slot="inspector.selection">
        <p className="p-3 text-sm text-muted-foreground">
          <Trans>Nothing is waiting.</Trans>
        </p>
      </SlotFill>
      <Empty
        glyph={<SheetsGlyph />}
        action={
          <AppLink to={PATHS.drawingSet(project.code)} className={buttonVariants({ variant: 'secondary' })}>
            <Trans>Go to the Drawing Set</Trans>
          </AppLink>
        }
      >
        {readOnly ? (
          <Trans>No sheets yet. The QS adds the Drawing Set’s files; Step 1 fills as they are read.</Trans>
        ) : (
          <Trans>No sheets yet. Add the Drawing Set’s files first.</Trans>
        )}
      </Empty>
    </div>
  )
}

/** The project summary's Step 1 counts, from what Step 1 read (the frame's Count and the rail's mark). */
function useSummaryCounts(project: ProjectSummary, model: Step1Model) {
  const queryClient = useQueryClient()
  const { data: session } = useSuspenseQuery(sessionQuery)
  const counts = useMemo(
    () => ({ found: model.found, confirmed: model.confirmed, excluded: model.excluded, questionsOpen: model.queue.length }),
    [model.found, model.confirmed, model.excluded, model.queue.length],
  )
  const shown = session.projects.find((p) => p.id === project.id)?.step1
  useEffect(() => {
    if (shown && shown.found === counts.found && shown.confirmed === counts.confirmed && shown.excluded === counts.excluded && shown.questionsOpen === counts.questionsOpen) return
    queryClient.setQueryData<Session>(sessionQuery.queryKey, (s) => (s ? { ...s, projects: s.projects.map((p) => (p.id === project.id ? { ...p, step1: counts } : p)) } : s))
  }, [queryClient, project.id, counts, shown])
}

/** Sheets in list order: what sheet mode pages through (a Question's copies included, files not). */
function sheetsInOrder(model: Step1Model): ProposalOut[] {
  // Each printed sheet once, by its id: two copies of one number are two stops (M18).
  const seen = new Set<string>()
  return model.rows.flatMap((r) => [...r.sheets]).filter((p) => !seen.has(p.id) && !!seen.add(p.id))
}

/** A sheet's name on the canvas and the picker: "S-07", or "S-07 rev A" where two copies share the number. */
function useSheetLabel(model: Step1Model) {
  const { t } = useLingui()
  return (sheet: ProposalOut) => {
    const number = sheet.number
    if (!number) return sheet.title
    const copies = sheetsInOrder(model).filter((p) => p.number === number && p.discipline === sheet.discipline)
    const mark = sheet.revision_mark.trim()
    if (copies.length < 2 || !mark) return number
    return /^rev\b|^r\d/i.test(mark) ? `${number} ${mark}` : t`${number} rev ${mark}`
  }
}

function Step1({
  session,
  project,
  model,
  coverage,
  drawn,
  reading,
}: {
  session: Session
  project: ProjectSummary
  model: Step1Model
  coverage: CoverageOut
  drawn: Step1Data
  reading: readonly FileOut[]
}) {
  const { t } = useLingui()
  const readOnly = readOnlyRole(session)
  const refuse = useReadOnlyToast()
  // The data drawn now: an act's toast waits until it is what Step 1 reloaded (#167, F1).
  const acts = useStep1Acts(project.id, drawn)
  const toast = useToast()
  const format = useFormat()
  useSummaryCounts(project, model)

  // `?sheet=<printed sheet's id>` opens that sheet (the Drawing Set report's "Open in Step 1", #118).
  const { sheet: asked } = useSearch({ strict: false }) as { sheet?: string }
  const [start] = useState(() => {
    const row = asked ? model.rows.find((r) => r.sheets.some((p) => p.sheet_id === asked)) : undefined
    const first = row?.sheets.find((p) => p.sheet_id === asked)
    return row && first ? { row: row.key, sheet: first.id } : null
  })
  const [mode, setMode] = useState<'list' | 'sheet'>(start ? 'sheet' : 'list')
  const [focused, setFocusedState] = useState<string | null>(start?.row ?? null)
  const [openSheet, setOpenSheet] = useState<string | null>(start?.sheet ?? null)
  /** The exclusion picker's target: the rows' sheets, or `view` when a view of the open sheet is selected (§6.9). */
  const [picker, setPicker] = useState<(Row & { view?: { id: string; title: string } }) | null>(null)
  /** Shift ↑ ↓ and Shift-click: the rows from where the selection began to where it ends (list mode, §6.15). */
  const [range, setRangeState] = useState<{ anchor: string; end: string } | null>(null)
  /**
   * The one way focus and the selection change: a picker open over them closes, so no route (keys, a click, an
   * inspector card, the bar, Q) leaves an exclusion picker acting on rows the list has since left.
   */
  const setFocused = (key: string | null) => {
    if (key !== focused) setPicker(null)
    setFocusedState(key)
  }
  const setRange = (next: { anchor: string; end: string } | null) => {
    setPicker(null)
    setRangeState(next)
  }
  /** O: the view outlines drawn on the sheet; kept through paging. */
  const [outlinesOn, setOutlinesOn] = useState(true)
  /** Z: each press (or the button) flies to the selected view again. */
  const [zoomToken, setZoomToken] = useState(0)
  const [listFor, setListFor] = useState<string | null>(null)
  const [panel, setPanel] = useState<'coverage' | { file: FileOut } | null>(null)
  const disciplines = useQuery(disciplinesQuery(project.id))
  /** The view selected in sheet mode (→ ←, a click on its outline), of the sheet it was selected on. */
  const [sheetPicker, setSheetPicker] = useState(false)
  // CAD-dark and As read | Plot | Compare are the screen's settings: kept through paging and List ⇄ Sheet.
  const [look, setLook] = useState<LookSetting>(PAPER_AS_READ)
  const [viewPick, setViewPickState] = useState<{ sheet: string; view: string } | null>(null)
  /** A view picked or cleared closes an exclusion picker open over the one before, as focus changes do. */
  const setViewPick = (next: { sheet: string; view: string } | null) => {
    setPicker(null)
    setViewPickState(next)
  }
  const listRef = useRef<HTMLDivElement>(null)
  const focusNext = useRef<string | null>(null)
  /** The QS's pick on each Question, by its id, until answered (a pick changes nothing until Enter, §6.7). */
  const [picks, setPicks] = useState<Readonly<Record<string, Pick>>>({})
  /**
   * The Questions whose answer is in flight: another Enter on one is ignored before it reaches the
   * acts, so no dropped key is kept for Ctrl Z to meet (the design gate, M2).
   */
  const answering = useRef(new Set<string>())
  /**
   * The Questions answered here whose cleared pick has not yet been drawn: an Enter in that gap runs a
   * handler of the render before, with the old pick or one made during the flight (the review, F1), and
   * is refused. Cleared once the picks are drawn, so a Question kept open can be answered again.
   */
  const answered = useRef(new Set<string>())
  useEffect(() => answered.current.clear(), [picks])

  const rowByKey = (key: string | null) => (key ? (model.rows.find((r) => r.key === key) ?? null) : null)
  const rowOfSheet = (id: string | null) => (id ? (model.rows.find((r) => r.sheets.some((s) => s.id === id)) ?? null) : null)
  const order = sheetsInOrder(model)
  const open = order.find((s) => s.id === openSheet) ?? null
  const focusedRow = mode === 'sheet' ? rowOfSheet(openSheet) : rowByKey(focused)
  const selectedView = mode === 'sheet' && open && viewPick?.sheet === open.id ? viewPick.view : null
  const viewsInOrder = open ? [...(open.views ?? [])].sort((a, b) => a.ordinal - b.ordinal) : []
  const selectedRows = useMemo(() => {
    if (!range || mode !== 'list') return []
    const keys = model.rows.map((r) => r.key)
    const [a, b] = [keys.indexOf(range.anchor), keys.indexOf(range.end)]
    return a < 0 || b < 0 ? [] : model.rows.slice(Math.min(a, b), Math.max(a, b) + 1)
  }, [range, mode, model.rows])
  const chosenKeys = useMemo(() => new Set(selectedRows.map((r) => r.key)), [selectedRows])
  /** → ←: the next or previous view in reading order; past either end, none. */
  const stepView = (by: 1 | -1) => {
    if (mode !== 'sheet' || !open || viewsInOrder.length === 0) return
    const at = viewsInOrder.findIndex((v) => v.id === selectedView)
    const next = at === -1 ? (by > 0 ? viewsInOrder[0] : viewsInOrder.at(-1)) : viewsInOrder[at + by]
    setViewPick(next ? { sheet: open.id, view: next.id } : null)
  }

  // A row focused by the keys (↑ ↓, Q, back from a sheet) takes the browser's focus once it is drawn.
  useLayoutEffect(() => {
    const key = focusNext.current
    if (!key || mode !== 'list') return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(key)}"]`)
    if (el) {
      focusNext.current = null
      el.focus({ preventScroll: false })
      el.scrollIntoView({ block: 'nearest' })
    }
  })

  /** After the last Question is answered: focus the first open row of the reloaded Step 1. */
  const focusFirstOpen = useRef<string | null>(null)
  useLayoutEffect(() => {
    const answered = focusFirstOpen.current
    if (!answered || mode !== 'list') return
    // Held until the answered Question's row has gone with the reload.
    if (model.rows.some((r) => r.key === answered)) return
    const first = nextOpenRow(model.rows, null)
    const el = first ? listRef.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(first.key)}"]`) : null
    if (!first || !el) return
    focusFirstOpen.current = null
    el.focus({ preventScroll: false })
    el.scrollIntoView({ block: 'nearest' })
  })

  /** A focus move that is not Shift's: a selection the focus has left is over (X then acts on the focused row). */
  const focusPlain = (key: string) => {
    setFocused(key)
    if (range && !chosenKeys.has(key)) setRange(null)
  }

  const focusRow = (key: string | null) => {
    setFocused(key)
    focusNext.current = key
  }

  const openRow = (row: Row) => {
    const first = row.sheets[0]
    if (!first) return
    setPicker(null)
    setRange(null)
    setOpenSheet(first.id)
    setFocused(row.key)
    setMode('sheet')
  }

  /** A Trace link: open that sheet in sheet mode. */
  const openSheetOf = (sheet: ProposalOut) => {
    const row = rowOfSheet(sheet.id)
    if (!row) return
    setPicker(null)
    setRange(null)
    setOpenSheet(sheet.id)
    setFocused(row.key)
    setMode('sheet')
  }

  const toList = () => {
    const row = rowOfSheet(openSheet)
    setMode('list')
    setPicker(null)
    focusRow(row?.key ?? focused)
  }

  const nextOpen = () => {
    const here = mode === 'sheet' ? (rowOfSheet(openSheet)?.key ?? focused) : focused
    const next = nextOpenRow(model.rows, here)
    if (!next) return
    if (mode === 'sheet') {
      setMode('list')
      setPicker(null)
    }
    focusRow(next.key)
  }

  const nextQuestion = () => {
    const next = nextOpenRow(model.rows, mode === 'sheet' ? (rowOfSheet(openSheet)?.key ?? focused) : focused, true)
    if (!next) return
    if (mode === 'sheet') setMode('list')
    focusRow(next.key)
  }

  /** After an act in sheet mode, the next sheet in list order still a Proposal (wrapping). */
  const openNextProposal = (after: string) => {
    const at = order.findIndex((s) => s.id === after)
    const ring = [...order.slice(at + 1), ...order.slice(0, at + 1)]
    const next = ring.find((s) => s.decision === null && s.id !== after && !rowOfSheet(s.id)?.question)
    if (next) setOpenSheet(next.id)
    else toList()
  }

  const confirmRow = async (row: Row, thenNext: boolean) => {
    const undecided = row.sheets.filter((s) => s.decision === null)
    const out = undecided.length > 0 && undecided.every((s) => s.proposed_exclusion) ? (undecided[0]!.proposed_exclusion as Reason) : null
    const backIn = row.sheets.every((p) => p.decision === 'excluded') ? session.user.name : undefined
    const done = out ? await acts.excludeSheets(row.sheets, out) : await acts.confirmSheets(row.sheets, backIn)
    if (done && thenNext && mode === 'sheet' && openSheet) openNextProposal(openSheet)
  }

  const setPick = (entry: QuestionEntry, pick: Pick | null) =>
    setPicks((all) => {
      const next = { ...all }
      if (pick) next[entry.question.id] = pick
      else delete next[entry.question.id]
      return next
    })

  const answerEntry = async (entry: QuestionEntry) => {
    if (readOnly) return refuse(readOnly)
    const id = entry.question.id
    if (answering.current.has(id) || answered.current.has(id)) return
    const pick = picks[entry.question.id] ?? null
    const key = pick?.key ?? prePick(entry, cardContext(model))?.key
    if (!key) return
    // Never an empty number (the walk, M4): Enter in the empty field is refused under it (round 3's gate).
    if (key === 'type_number' && !(pick?.text ?? '').trim()) return setPick(entry, { key, text: pick?.text ?? '', refused: (pick?.refused ?? 0) + 1 })
    const rowKey = `q:${entry.question.id}`
    answering.current.add(id)
    const done = await acts.answerQuestion(entry, key, key === 'type_number' ? (pick?.text ?? '') : '').finally(() => answering.current.delete(id))
    if (!done) return
    answered.current.add(id)
    setPick(entry, null)
    // Kept open, it stays focused (its card says "Kept open"); else on to the next open Question, as
    // "Ask later" would; none left, nothing focused (the overview).
    if (key !== 'keep_open' && (focused === rowKey || mode === 'list')) {
      const next = nextOpenRow(model.rows, rowKey, true)
      if (next && next.key !== rowKey) focusRow(next.key)
      else {
        // The last Question answered: focus goes to the first sheet still open, the row the bar then
        // names (the walk, M4), found in Step 1 as reloaded (its rows' keys change with the answer).
        focusRow(null)
        focusFirstOpen.current = rowKey
      }
    }
  }

  const answerer: Answerer | null = readOnly
    ? null
    : {
        choice: (entry) => picks[entry.question.id] ?? null,
        choose: (entry, key) => {
          setPick(entry, { key, text: picks[entry.question.id]?.text ?? '' })
          // A pick on a card in the Questions tab makes its Question the one Enter answers.
          const rowKey = `q:${entry.question.id}`
          if (mode === 'list' && focused !== rowKey && model.rows.some((r) => r.key === rowKey)) focusPlain(rowKey)
        },
        type: (entry, text) => setPick(entry, { key: 'type_number', text }),
        answer: (entry) => void answerEntry(entry),
        later: () => nextQuestion(),
        busy: acts.busy,
      }

  /** 1–9: pick that answer on the focused Question (§6.15). */
  const pickByKey = (n: number) => {
    if (readOnly) return refuse(readOnly)
    const entry = focusedRow?.question
    const option = entry ? optionsOf(entry)[n - 1] : undefined
    if (entry && option?.key && answerer) answerer.choose(entry, option.key)
  }

  const bar = useBar({
    model,
    reading: reading.length,
    row: focusedRow,
    mode,
    readOnly,
    bulk: () => void acts.bulk(model.bulk.confirm, model.bulk.leaveOut),
    confirmRow: (row, thenNext) => void confirmRow(row, thenNext),
    nextOpen,
    nextQuestion,
    openRow,
    answerer,
  })
  /**
   * What the bar shows: while an act and Step 1's reload are in flight, the bar from before it,
   * its button off (the walk, M5: mid-reload it showed the bulk act with Questions still open).
   * Enter still reads the live bar, so a key pressed meanwhile is dropped as before.
   */
  // Taken as the act starts: Step 1 has not changed yet, so it is the bar the QS acted on.
  const [held, setHeld] = useState<{ busy: boolean; bar: BarSpec | null }>({ busy: false, bar: null })
  if (held.busy !== acts.busy) setHeld({ busy: acts.busy, bar: acts.busy ? bar : null })
  const before = acts.busy ? held.bar : null
  const shown = before ? { ...before, button: before.button && { ...before.button, disabled: true } } : bar

  const page = (by: number) => {
    if (mode !== 'sheet' || !open) return
    const at = order.findIndex((s) => s.id === open.id)
    const next = order[at + by]
    if (next) setOpenSheet(next.id)
  }

  const moveFocus = (by: number) => {
    if (mode === 'sheet') return page(by)
    setRange(null)
    const at = model.rows.findIndex((r) => r.key === focused)
    const next = model.rows[at === -1 ? (by > 0 ? 0 : model.rows.length - 1) : Math.min(model.rows.length - 1, Math.max(0, at + by))]
    if (next) focusRow(next.key)
  }

  /** Home and End: the list's first and last row. */
  const focusEnd = (last: boolean) => {
    const row = last ? model.rows.at(-1) : model.rows[0]
    setRange(null)
    if (row) focusRow(row.key)
  }

  /** Shift ↑ ↓: the selection grows (or shrinks) by the row above or below the focused one. */
  const extendBy = (by: number) => {
    const at = model.rows.findIndex((r) => r.key === focused)
    const next = model.rows[at === -1 ? (by > 0 ? 0 : model.rows.length - 1) : Math.min(model.rows.length - 1, Math.max(0, at + by))]
    if (!next) return
    setRange({ anchor: range?.anchor ?? focused ?? next.key, end: next.key })
    focusRow(next.key)
  }

  /** Shift-click: the selection runs from the focused row to the one clicked. */
  const extendTo = (key: string) => {
    setRange({ anchor: range?.anchor ?? focused ?? key, end: key })
    focusRow(key)
  }

  /** §6.4: Enter on a Question with nothing picked says what to do (a toast is drawn outside the format's provider). */
  const sayPick = (entry: QuestionEntry) => {
    const tag = entry.tag
    const keys = Array.from({ length: Math.min(9, optionsOf(entry).length) }, (_, i) => format.integer(i + 1)).join(', ')
    toast.show({ message: <Trans>Pick an answer to {tag} first: {keys}</Trans> })
  }

  /** Enter on a Question's card: answers it with the pick (or the pre-pick), else says to pick first. */
  function enterOn(entry: QuestionEntry) {
    if (readOnly) return refuse(readOnly)
    if (picks[entry.question.id] || prePick(entry, cardContext(model))) void answerEntry(entry)
    else sayPick(entry)
  }

  const enter = () => {
    if (readOnly) return refuse(readOnly)
    // The exclusion picker is what the bar shows: Enter is its own (with "Other" typed), never the bar's.
    if (picker) return
    // In a Question's card (its number field), Enter answers that Question, whatever row or sheet is open.
    const inCard = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-question]')?.dataset.question
    const carded = inCard ? [...model.queue, ...model.withdrawn.flatMap((r) => (r.question ? [r.question] : []))].find((e) => e.question.id === inCard) : undefined
    if (carded) return enterOn(carded)
    if (bar?.button?.disabled) {
      // A pick made, its number not typed yet: refused under the field, as Enter in it is.
      const entry = focusedRow?.question
      if (entry && picks[entry.question.id]?.key === 'type_number') void answerEntry(entry)
      else if (entry) sayPick(entry)
      return
    }
    const act = bar?.button ?? bar?.ghost
    if (act) act.run()
    else nextOpen()
  }
  const undoKey = () => (readOnly ? refuse(readOnly) : void acts.undoLast())
  const excludeKey = () => {
    if (readOnly) return refuse(readOnly)
    // Several rows selected (list mode): one exclusion for all their sheets, with one reason (§6.9).
    const chosen = focused !== null && chosenKeys.has(focused) ? selectedRows.filter((r) => r.sheets.length > 0) : []
    const view = viewsInOrder.find((v) => v.id === selectedView)
    // A view already left out is never left out again: Ctrl Z takes the exclusion back (§6.6).
    if (mode === 'sheet' && view && (view.decision === 'excluded' || open?.decision === 'excluded' || (view.proposed_exclusion && open?.decision === 'confirmed'))) return
    if (mode === 'sheet' && view && focusedRow) setPicker({ ...focusedRow, view: { id: view.id, title: view.title } })
    else if (chosen.length > 1) setPicker({ ...chosen[0]!, key: SELECTION_KEY, numberTo: null, sheets: chosen.flatMap((r) => [...r.sheets]) })
    else if (focusedRow && focusedRow.sheets.length > 0) setPicker(focusedRow)
  }

  const spaceLabel = t`Open the focused sheet, or go back to the list`
  useKeys([
    { key: 'Enter', label: t`Do what the bar says`, group: 'screen', run: (event) => (event.repeat ? undefined : enter()) },
    { key: 'Ctrl Z', label: t`Undo your last confirmation, exclusion or drawing list on Step 1`, group: 'screen', run: (event) => (event.repeat ? undefined : undoKey()) },
    { key: 'X', label: t`Exclude the focused sheet, with a reason`, group: 'screen', run: excludeKey },
    { key: '↓', label: t`Next row; in a sheet, the next sheet`, group: 'screen', run: () => moveFocus(1) },
    { key: '↑', label: t`Previous row; in a sheet, the previous sheet`, group: 'screen', run: () => moveFocus(-1) },
    { key: ']', label: t`Next sheet`, group: 'sheet', when: () => mode === 'sheet', run: () => page(1) },
    { key: 'PageDown', label: t`Next sheet`, group: 'sheet', when: () => mode === 'sheet', run: () => page(1) },
    { key: '→', label: t`Next view on the sheet`, group: 'screen', when: () => mode === 'sheet', run: () => stepView(1) },
    { key: '←', label: t`Previous view on the sheet`, group: 'screen', when: () => mode === 'sheet', run: () => stepView(-1) },
    { key: 'S', label: t`The sheet picker`, group: 'screen', when: () => mode === 'sheet', run: () => setSheetPicker(true) },
    { key: '[', label: t`Previous sheet`, group: 'sheet', when: () => mode === 'sheet', run: () => page(-1) },
    { key: 'PageUp', label: t`Previous sheet`, group: 'sheet', when: () => mode === 'sheet', run: () => page(-1) },
    { key: 'O', label: t`Show or hide the view outlines`, group: 'sheet', when: () => mode === 'sheet', run: () => setOutlinesOn((on) => !on) },
    { key: 'Q', label: t`Next open Question`, group: 'screen', run: nextQuestion },
    // 1–9: an answer on the focused Question (§6.15); the exclusion picker's own 1–9 win while it is open.
    { key: '1', label: t`Pick answer 1 on the focused Question`, group: 'screen', when: () => !!focusedRow?.question, run: (event) => (event.repeat ? undefined : pickByKey(1)) },
    { key: '2', label: t`Pick answer 2 on the focused Question`, group: 'screen', when: () => !!focusedRow?.question, run: (event) => (event.repeat ? undefined : pickByKey(2)) },
    { key: '3', label: t`Pick answer 3 on the focused Question`, group: 'screen', when: () => !!focusedRow?.question, run: (event) => (event.repeat ? undefined : pickByKey(3)) },
    { key: '4', label: t`Pick answer 4 on the focused Question`, group: 'screen', when: () => !!focusedRow?.question, run: (event) => (event.repeat ? undefined : pickByKey(4)) },
    { key: '5', label: t`Pick answer 5 on the focused Question`, group: 'screen', when: () => !!focusedRow?.question, run: (event) => (event.repeat ? undefined : pickByKey(5)) },
    { key: '6', label: t`Pick answer 6 on the focused Question`, group: 'screen', when: () => !!focusedRow?.question, run: (event) => (event.repeat ? undefined : pickByKey(6)) },
    { key: '7', label: t`Pick answer 7 on the focused Question`, group: 'screen', when: () => !!focusedRow?.question, run: (event) => (event.repeat ? undefined : pickByKey(7)) },
    { key: '8', label: t`Pick answer 8 on the focused Question`, group: 'screen', when: () => !!focusedRow?.question, run: (event) => (event.repeat ? undefined : pickByKey(8)) },
    { key: '9', label: t`Pick answer 9 on the focused Question`, group: 'screen', when: () => !!focusedRow?.question, run: (event) => (event.repeat ? undefined : pickByKey(9)) },
    {
      // M22 (walk 5): straight after load focus is on the page, outside the list and canvas regions
      // whose Space opens and closes a sheet, yet the bar shows "Open E-01 [Space]". From the page,
      // Space does what the bar says (6.15: none focused, the first sheet row); in a region, the
      // region's Space wins (the registry resolves regions before the screen).
      key: 'Space',
      label: t`Open the sheet the bar names, or go back to the list`,
      group: 'screen',
      when: () => !document.activeElement || document.activeElement === document.body,
      run: () => {
        if (mode === 'sheet') toList()
        else if (bar?.ghost?.combo === 'Space') bar.ghost.run()
        else fromList()
      },
    },
    {
      key: 'Esc',
      label: t`Back to the list; in the list, clear the focus`,
      group: 'screen',
      when: () => mode === 'sheet' || panel !== null || focused !== null || chosenKeys.size > 0,
      run: () => {
        if (panel) setPanel(null)
        else if (chosenKeys.size > 0) setRange(null)
        else if (selectedView) setViewPick(null)
        else if (mode === 'sheet') toList()
        else {
          setFocused(null)
          ;(document.activeElement as HTMLElement | null)?.blur()
        }
      },
    },
  ])

  const fromList = () => {
    const row = rowByKey(focused) ?? model.rows.find((r) => r.sheets.length > 0) ?? null
    if (row && row.sheets.length > 0) openRow(row)
  }

  const selection = panel && panel !== 'coverage' ? (
    <ReportPanel key={panel.file.id} projectId={project.id} file={panel.file} disciplines={disciplines.data} onClose={() => setPanel(null)} />
  ) : panel === 'coverage' ? (
    <CoveragePanel
      coverage={coverage}
      held={model.queue.filter((e) => e.question.kind === 'file_misread' && e.question.subject_id && model.fileNames[e.question.subject_id]).map((e) => model.fileNames[e.question.subject_id!]!)}
      reading={reading.filter((f) => f.state === 'reading').map((f) => f.name)}
    />
  ) : focusedRow ? (
    <>
      {focusedRow.question ? <QuestionCard entry={focusedRow.question} readOnly={readOnly} context={cardContext(model)} onOpen={openSheetOf} answerer={answerer} /> : null}
      <SheetFacts
        row={focusedRow}
        showTitle={mode === 'list'}
        readOnly={readOnly !== null}
        open={mode === 'sheet' && open ? open : undefined}
        acts={{ exclude: excludeKey, confirmBackIn: () => void confirmRow(focusedRow, false) }}
        selectedView={selectedView}
        slots={stripSlots(model.rows.flatMap((r) => r.sheets.map((p) => p.views)))}
        onSelectView={mode === 'sheet' && open ? (view) => setViewPick({ sheet: open.id, view }) : undefined}
      />
    </>
  ) : (
    <Overview model={model} projectName={project.name} readOnly={readOnly} />
  )

  const pasteSection = listFor ? model.disciplines.find((d) => d.discipline === listFor) : undefined
  const pasteFile = pasteSection?.rows[0]?.sheets[0]?.file_name ?? ''

  return (
    <div className="absolute inset-0 flex flex-col" data-step1="" aria-busy={acts.busy}>
      <SlotFill slot="toolbar.end" order={0}>
        <ModeSwitch mode={mode} title={spaceLabel} onList={() => mode === 'sheet' && toList()} onSheet={() => mode === 'list' && fromList()} />
      </SlotFill>
      <SlotFill slot="status.end" order={0}>
        <button type="button" onClick={() => setPanel('coverage')} className="hover:text-foreground hover:underline">
          <CoverageLine coverage={coverage} />
        </button>
      </SlotFill>
      <SlotFill slot="inspector.selection">
        <div className="flex w-full flex-col">{selection}</div>
      </SlotFill>
      <SlotFill slot="inspector.questions">
        <div className="flex w-full flex-col">
          <QuestionsTab model={model} readOnly={readOnly} onOpen={openSheetOf} answerer={answerer} />
        </div>
      </SlotFill>

      {mode === 'list' ? (
        <ListRegion label={spaceLabel} onSpace={fromList} onEnd={focusEnd} onExtend={extendBy} onPointer={() => setPicker(null)}>
          <FilesBand projectId={project.id} onOpen={(file) => setPanel({ file })} />
          <StillReading files={reading} />
          <SheetList
            ref={listRef}
            model={model}
            focused={focused}
            onFocusRow={focusPlain}
            onOpenRow={(key) => {
              const row = rowByKey(key)
              if (row) openRow(row)
            }}
            onPasteList={readOnly ? null : setListFor}
            selection={chosenKeys}
            onExtendTo={extendTo}
            onClearSelection={() => setRange(null)}
          />
        </ListRegion>
      ) : open ? (
        <SheetMode
          projectId={project.id}
          sheet={open}
          label={spaceLabel}
          onSpace={toList}
          onPage={page}
          model={model}
          selectedView={selectedView}
          onSelectView={(view) => setViewPick({ sheet: open.id, view })}
          picker={sheetPicker}
          onPicker={setSheetPicker}
          lookSetting={look}
          onLookSetting={setLook}
          outlinesOn={outlinesOn}
          onOutlines={setOutlinesOn}
          zoomToken={zoomToken}
          onZoom={() => setZoomToken((n) => n + 1)}
          onPick={(sheet) => {
            setSheetPicker(false)
            setOpenSheet(sheet.id)
            const row = rowOfSheet(sheet.id)
            if (row) setFocused(row.key)
          }}
        />
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10">
        {picker ? (
          <ExclusionPicker
            row={picker}
            heading={picker.view ? <ViewHeading title={picker.view.title} /> : undefined}
            several={picker.key === SELECTION_KEY}
            onCancel={() => setPicker(null)}
            onPick={(reason, text) => {
              const row = picker
              setPicker(null)
              setRange(null)
              if (row.view) {
                void acts.excludeView(row.view, reason, text)
                return
              }
              void acts.excludeSheets(row.sheets, reason, text, row.key === SELECTION_KEY).then((done) => {
                if (done && mode === 'sheet' && openSheet) openNextProposal(openSheet)
              })
            }}
          />
        ) : shown ? (
          <Bar spec={shown} />
        ) : null}
      </div>

      {listFor ? (
        <DrawingListDialog
          projectId={project.id}
          discipline={listFor}
          fileName={pasteFile}
          given={pasteSection?.list && pasteSection.list.source !== 'sheet' ? pasteSection.list.numbers.join('\n') : ''}
          example={pasteSection?.numbering ? `${pasteSection.numbering.first}–${pasteSection.numbering.last}` : null}
          readOnly={readOnly !== null}
          onClose={() => setListFor(null)}
          onUse={(text) => acts.setDrawingList(listFor, text)}
        />
      ) : null}
    </div>
  )
}

/**
 * The toolbar's "List | Sheet" (§6.1, §6.5): the same as Space, by mouse. Two toggle buttons, the
 * current one pressed, at the toolbar's control height (so the toolbar keeps one line, §8 item 6).
 */
function ModeSwitch({ mode, title, onList, onSheet }: { mode: 'list' | 'sheet'; title: string; onList: () => void; onSheet: () => void }) {
  const { t } = useLingui()
  const item = cn('h-control px-2.5 text-sm text-ink-secondary hover:bg-hover aria-pressed:bg-paper aria-pressed:font-medium aria-pressed:text-foreground')
  return (
    <div role="group" aria-label={t`List or sheet`} className="inline-flex overflow-hidden rounded-md bg-chrome-sunken ring-1 ring-border-strong">
      <button type="button" aria-pressed={mode === 'list'} title={title} aria-keyshortcuts="Space" onClick={onList} className={item}>
        <Trans>List</Trans>
      </button>
      <button type="button" aria-pressed={mode === 'sheet'} title={title} aria-keyshortcuts="Space" onClick={onSheet} className={item}>
        <Trans>Sheet</Trans>
      </button>
    </div>
  )
}

/** The exclusion picker's first line for one view (§6.9). */
function ViewHeading({ title }: { title: string }) {
  const name = <DrawingText kind="title" text={title} truncate={false} />
  return <Trans>Exclude the view “{name}”. Why?</Trans>
}

/** The list's key region: Space opens the focused sheet (m0-screens §6.1, 2.3 item 10). */
function ListRegion({
  label,
  onSpace,
  onEnd,
  onExtend,
  onPointer,
  children,
}: {
  label: string
  onPointer: () => void
  onSpace: () => void
  onEnd: (last: boolean) => void
  onExtend: (by: number) => void
  children: ReactNode
}) {
  const { t } = useLingui()
  return (
    <KeyRegion name="list" role="grid" aria-label={t`Sheets`} className="min-h-0 flex-1 overflow-auto pb-24" onPointerDownCapture={onPointer}>
      <SpaceKey label={label} run={onSpace} />
      <ListKeys onEnd={onEnd} onExtend={onExtend} />
      {children}
    </KeyRegion>
  )
}

function SpaceKey({ label, run }: { label: string; run: () => void }) {
  useKeys([{ key: 'Space', label, group: 'screen', run }])
  return null
}

/** §2.2's list keys: Home and End, and Shift ↑ ↓ to select several sheets (to exclude them together). */
function ListKeys({ onEnd, onExtend }: { onEnd: (last: boolean) => void; onExtend: (by: number) => void }) {
  const { t } = useLingui()
  useKeys([
    { key: 'Home', label: t`First row`, group: 'screen', run: () => onEnd(false) },
    { key: 'End', label: t`Last row`, group: 'screen', run: () => onEnd(true) },
    { key: 'Shift ↓', label: t`Extend the selection to the next row`, group: 'screen', run: () => onExtend(1) },
    { key: 'Shift ↑', label: t`Extend the selection to the previous row`, group: 'screen', run: () => onExtend(-1) },
  ])
  return null
}

/** "Plan, 1:100" / "Detail, not to scale": a view's tag on its outline (§6.5). */
function useViewTag() {
  const { i18n, t } = useLingui()
  return (v: ViewOut) => {
    const kind = i18n._(VIEW_KINDS[v.kind] ?? OTHER_VIEW_KIND)
    if (v.not_to_scale) return t`${kind}, not to scale`
    if (v.stated_scale) {
      const scale = isolateLtr(v.stated_scale)
      return t`${kind}, ${scale}`
    }
    return kind
  }
}

/** A view's tone on the canvas and in the legend (§6.5, 6.11): excluded, held by a Question, assigned, or a Proposal. */
function viewTone(v: ViewOut, sheet: ProposalOut, held: boolean): SheetOutline['tone'] {
  if (v.decision === 'excluded' || sheet.decision === 'excluded' || (v.proposed_exclusion && sheet.decision === 'confirmed')) return 'excluded'
  if (held) return 'question'
  if (sheet.decision === 'confirmed') return 'assigned'
  return 'proposal'
}

/** 4.6's legend, counting views (§6.5): "Proposal 2 · Assigned 0 · Question 0 · Excluded 0". */
function Legend({ tones }: { tones: readonly SheetOutline['tone'][] }) {
  const f = useFormat()
  const count = (tone: SheetOutline['tone']) => f.integer(tones.filter((x) => x === tone).length)
  const [p, a, q, x] = [count('proposal'), count('assigned'), count('question'), count('excluded')]
  return (
    <Trans>
      Proposal {p} · Assigned {a} · Question {q} · Excluded {x}
    </Trans>
  )
}

/** Sheet mode (§6.5): the open sheet in the viewer with its views; its label, the picker and paging in the toolbar. */
function SheetMode({
  projectId,
  sheet,
  label,
  onSpace,
  onPage,
  model,
  selectedView,
  onSelectView,
  picker,
  onPicker,
  onPick,
  lookSetting,
  onLookSetting,
  outlinesOn,
  onOutlines,
  zoomToken,
  onZoom,
}: {
  projectId: string
  sheet: ProposalOut
  label: string
  onSpace: () => void
  onPage: (by: number) => void
  model: Step1Model
  selectedView: string | null
  onSelectView: (id: string) => void
  picker: boolean
  onPicker: (open: boolean) => void
  onPick: (sheet: ProposalOut) => void
  lookSetting: LookSetting
  onLookSetting: (next: LookSetting) => void
  outlinesOn: boolean
  onOutlines: (on: boolean) => void
  zoomToken: number
  onZoom: () => void
}) {
  const { t } = useLingui()
  // The pointer's place on this sheet's paper (gone with the sheet: no pointerleave comes when it changes).
  const [cursor, setCursor] = useState<{ sheet: string; x: number; y: number } | null>(null)
  if (cursor && cursor.sheet !== sheet.id) setCursor(null)
  const stated = statedView(sheet.views ?? [], cursor, selectedView)
  const render = useQuery(renderQuery(projectId, sheet.sheet_id))
  const look = useSheetLook(projectId, sheet, lookSetting, onLookSetting)
  const region = useRef<HTMLDivElement>(null)
  const name = useSheetLabel(model)(sheet)
  const tag = useViewTag()
  const held = model.rows.some((r) => r.question && r.sheets.some((s) => s.id === sheet.id))
  const outlines = useMemo<SheetOutline[]>(
    () =>
      [...(sheet.views ?? [])]
        .sort((a, b) => a.ordinal - b.ordinal)
        .map((v) => {
          const [x0, y0, x1, y1] = v.box.map(Number) as [number, number, number, number]
          return { id: v.id, box: { x0, y0, x1, y1 }, tag: tag(v), tone: viewTone(v, sheet, held) }
        })
        .filter((o) => [o.box.x0, o.box.y0, o.box.x1, o.box.y1].every(Number.isFinite) && o.box.x1 > o.box.x0 && o.box.y1 > o.box.y0),
    [sheet, held, tag],
  )

  // Focus follows the sheet into the canvas as it opens and as it pages (§6.1), and comes back to it
  // when the sheet picker closes, so Space still goes back to the list.
  const focusCanvas = () => {
    const el = region.current
    if (!el) return
    const canvas = el.querySelector<HTMLElement>('[role="group"][tabindex]')
    if (canvas) canvas.focus({ preventScroll: true })
    else if (!el.contains(document.activeElement)) el.focus({ preventScroll: true })
  }
  useLayoutEffect(focusCanvas, [render.data, sheet.id])
  // O hides the outlines while focus is in one: focus goes to the canvas, so F, Z, + and − still work.
  useLayoutEffect(() => {
    if (!outlinesOn && (!document.activeElement || document.activeElement === document.body)) focusCanvas()
  }, [outlinesOn])

  // #115: Try again's button goes while the sheet loads again; focus waits on the region (so Space
  // still works) and, if the sheet fails again, comes back to the new Try again, never the page.
  const retried = useRef(false)
  const retryRender = () => {
    if (region.current?.contains(document.activeElement)) {
      retried.current = true
      region.current.focus({ preventScroll: true })
    }
    void render.refetch()
  }
  useLayoutEffect(() => {
    if (!retried.current || render.isFetching) return
    retried.current = false
    if (render.error && region.current?.contains(document.activeElement)) region.current.querySelector<HTMLElement>('button')?.focus({ preventScroll: true })
  }, [render.error, render.isFetching, render.errorUpdatedAt])

  return (
    <>
      <SlotFill slot="toolbar.start" order={1}>
        <SheetPicker sheet={sheet} model={model} open={picker} onOpen={onPicker} onPick={onPick} onClosed={focusCanvas} />
        <IconButton label={t`Previous sheet`} combo="[" onClick={() => onPage(-1)}>
          <ChevronLeft strokeWidth={1.5} className="rtl:-scale-x-100" />
        </IconButton>
        <IconButton label={t`Next sheet`} combo="]" onClick={() => onPage(1)}>
          <ChevronRight strokeWidth={1.5} className="rtl:-scale-x-100" />
        </IconButton>
      </SlotFill>
      {look.switches}
      <SlotFill slot="toolbar.end" order={1}>
        <ViewerTools selected={selectedView !== null} outlinesOn={outlinesOn} onOutlines={onOutlines} onZoom={onZoom} />
      </SlotFill>
      {stated && (stated.not_to_scale || stated.stated_scale) ? (
        <SlotFill slot="status.start" order={0}>
          <StatedScale view={stated} />
        </SlotFill>
      ) : null}
      <KeyRegion name="sheet" className="relative min-h-0 flex-1">
        <SpaceKey label={label} run={onSpace} />
        <ZoomKey enabled={selectedView !== null} run={onZoom} />
        {/* F6 lands here, inside the key region, so Space and the sheet's keys work from it (M17). */}
        <div ref={region} tabIndex={-1} data-region-focus="" className="focus-inset absolute inset-0">
          {render.data ? (
            <SheetViewer
              key={sheet.id}
              buffer={render.data}
              label={name}
              onRetry={retryRender}
              outlines={outlines}
              selected={selectedView}
              onSelect={onSelectView}
              onCursor={(at) => setCursor(at ? { sheet: sheet.id, ...at } : null)}
              showOutlines={outlinesOn}
              zoomToken={zoomToken}
              legend={(sheet.views ?? []).length > 0 ? <Legend tones={(sheet.views ?? []).map((v) => viewTone(v, sheet, held))} /> : null}
              labelInToolbar={false}
              {...look.viewer}
            />
          ) : render.error ? (
            <LoadProblem error={render.error} onRetry={retryRender} className="m-4" />
          ) : (
            <Skeleton rows={6} className="m-6" status={<Trans>Opening <SheetName sheets={[sheet]} />…</Trans>} />
          )}
        </div>
      </KeyRegion>
    </>
  )
}

/** Z (§2.2, region: canvas): zoom to the selected view; with none selected the key is not active. */
function ZoomKey({ enabled, run }: { enabled: boolean; run: () => void }) {
  const { t } = useLingui()
  useKeys([{ key: 'Z', label: t`Zoom to the selected view`, group: 'sheet', when: () => enabled, run }])
  return null
}

/**
 * §4.6's Zoom to view and Outlines: buttons in the toolbar from 1440, rows of "More" (with their Kbd)
 * below it, so the toolbar keeps one line at 1280.
 */
function ViewerTools({ selected, outlinesOn, onOutlines, onZoom }: { selected: boolean; outlinesOn: boolean; onOutlines: (on: boolean) => void; onZoom: () => void }) {
  const { t } = useLingui()
  return (
    <>
      <IconButton label={t`Zoom to view`} tip={t`Zoom to the selected view`} combo="Z" aria-keyshortcuts="Z" disabled={!selected} onClick={onZoom} className="hidden min-[1440px]:inline-flex">
        <Crosshair strokeWidth={1.5} />
      </IconButton>
      <IconButton label={t`Outlines`} tip={t`View outlines`} combo="O" aria-keyshortcuts="O" pressed={outlinesOn} onClick={() => onOutlines(!outlinesOn)} className="hidden min-[1440px]:inline-flex">
        <Layers strokeWidth={1.5} />
      </IconButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton label={t`More`} className="min-[1440px]:hidden">
            <MoreHorizontal strokeWidth={1.5} />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={!selected} onSelect={onZoom}>
            <Crosshair strokeWidth={1.5} />
            <Trans>Zoom to view</Trans>
            <KeyCombo combo="Z" className="ms-auto" />
          </DropdownMenuItem>
          <DropdownMenuCheckboxItem checked={outlinesOn} onCheckedChange={onOutlines}>
            <Trans>Outlines</Trans>
            <KeyCombo combo="O" className="ms-auto" />
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

/**
 * The view whose scale the status bar states (§4.1, §4.6's scale-bar rule), by the views' boxes in paper
 * mm, never by an outline element: the one under the pointer (the smallest where views nest), else the
 * selected one, else the working view (the first in reading order).
 */
function statedView(views: readonly ViewOut[], cursor: { x: number; y: number } | null, selected: string | null): ViewOut | undefined {
  const under = cursor
    ? views
        .map((v) => ({ v, box: v.box.map(Number) as [number, number, number, number] }))
        .filter(({ box }) => cursor.x >= box[0] && cursor.x <= box[2] && cursor.y >= box[1] && cursor.y <= box[3])
        .sort((a, b) => (a.box[2] - a.box[0]) * (a.box[3] - a.box[1]) - (b.box[2] - b.box[0]) * (b.box[3] - b.box[1]))[0]?.v
    : undefined
  return under ?? views.find((v) => v.id === selected) ?? [...views].sort((a, b) => a.ordinal - b.ordinal)[0]
}

/** The status bar's stated scale for the view under the cursor (§4.1): "1:100, as stated", or "Not to scale". */
function StatedScale({ view }: { view: ViewOut }) {
  const { t } = useLingui()
  if (view.not_to_scale) return <span>{t`Not to scale`}</span>
  if (!view.stated_scale) return null
  const scale = isolateLtr(view.stated_scale)
  return <span>{t`${scale}, as stated`}</span>
}

/** The sheet label as a button (§6.5: "S-20 8th & 9th floor beam layout ▾", at most 250 px) opening "Sheets, in list order". */
function SheetPicker({
  sheet,
  model,
  open,
  onOpen,
  onPick,
  onClosed,
}: {
  sheet: ProposalOut
  model: Step1Model
  open: boolean
  onOpen: (open: boolean) => void
  onPick: (sheet: ProposalOut) => void
  /** Focus goes back to the canvas, not the label button, when the picker closes. */
  onClosed: () => void
}) {
  const { t } = useLingui()
  const groups: { key: string; heading: ReactNode; sheets: ProposalOut[] }[] = [
    { key: 'needs', heading: <Trans>Needs you</Trans>, sheets: model.needsYou.flatMap((r) => [...r.sheets]) },
    { key: 'withdrawn', heading: <Trans>Questions withdrawn</Trans>, sheets: model.withdrawn.flatMap((r) => [...r.sheets]) },
    { key: 'out', heading: <Trans>Proposed to leave out</Trans>, sheets: model.proposedOut.flatMap((r) => [...r.sheets]) },
    ...model.disciplines.map((d) => ({ key: d.discipline, heading: <DisciplineName discipline={d.discipline} />, sheets: d.rows.flatMap((r) => [...r.sheets]) })),
  ].filter((g) => g.sheets.length > 0)
  /** Two copies of one number share it: each says its revision ("rev A", M18). */
  const copied = (s: ProposalOut) => !!s.number && !!s.revision_mark.trim() && sheetsInOrder(model).filter((p) => p.number === s.number && p.discipline === s.discipline).length > 1
  return (
    <Popover open={open} onOpenChange={onOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-keyshortcuts="S"
          className="inline-flex h-control max-w-[250px] min-w-0 items-center gap-1.5 rounded-md px-2 text-sm hover:bg-hover"
        >
          {sheet.number ? <DrawingText kind="sheet-number" text={sheet.number} truncate={false} className="shrink-0 font-semibold" /> : null}
          {copied(sheet) ? (
            <span className="shrink-0 text-ink-secondary">
              <Copy sheet={sheet} />
            </span>
          ) : null}
          <DrawingText kind="title" text={sheet.title} className="min-w-0 text-ink-secondary" />
          <ChevronDown strokeWidth={1.5} className="size-3.5 shrink-0" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[60vh] w-80 overflow-auto p-1"
        aria-label={t`Sheets, in list order`}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          onClosed()
        }}
      >
        <p className="px-2 py-1 text-xs font-semibold text-ink-secondary">
          <Trans>Sheets, in list order</Trans>
        </p>
        {groups.map((g) => (
          <div key={g.key} role="group" className="py-0.5">
            <p className="px-2 text-2xs text-muted-foreground">{g.heading}</p>
            {g.sheets.map((s) => (
              <button
                key={`${g.key}:${s.id}`}
                type="button"
                aria-current={s.id === sheet.id ? 'true' : undefined}
                onClick={() => onPick(s)}
                className="flex w-full min-w-0 items-center gap-2 rounded-sm px-2 py-1 text-start text-sm hover:bg-hover aria-[current=true]:bg-selected"
              >
                <span className="w-12 shrink-0 font-semibold">{s.number ? <DrawingText kind="sheet-number" text={s.number} truncate={false} /> : <Trans>none</Trans>}</span>
                {copied(s) ? (
                  <span className="shrink-0 text-ink-secondary">
                    <Copy sheet={s} />
                  </span>
                ) : null}
                <DrawingText kind="title" text={s.title} className="min-w-0" />
              </button>
            ))}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}

function DisciplineName({ discipline }: { discipline: string }) {
  const { i18n } = useLingui()
  return <>{disciplineName(discipline, i18n)}</>
}
