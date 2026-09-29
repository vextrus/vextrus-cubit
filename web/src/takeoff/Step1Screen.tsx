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
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi, useSearch } from '@tanstack/react-router'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { AppLink, PATHS } from '@/app/AppLink'
import { sessionQuery, type ProjectSummary, type Session } from '@/app/session'
import { SlotFill } from '@/app/slots'
import { LoadProblem, readOnlyRole, usePageTitle, useReadOnlyToast } from '@/auth'
import { SheetViewer } from '@/sheet'
import { DrawingText, Empty, IconButton, KeyRegion, KeyScope, Skeleton, cn, SheetsGlyph, buttonVariants, useKeys } from '@/ui'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/ui/primitives/dialog'
import { useFormat } from '@/format'
import { SheetName, useStep1Acts } from './acts'
import { Bar, ExclusionPicker, useBar } from './Bar'
import { renderQuery, useStep1, type CoverageOut, type ProposalOut } from './data'
import { DrawingListDialog } from './DrawingListDialog'
import { nextOpenRow, step1Model, type Reason, type Row, type Step1Model } from './model'
import { SheetList } from './SheetList'
import { NOT_TO_SCALE, OTHER_VIEW_KIND, VIEW_KIND_NAMES } from './words'
import { CoverageLine, CoveragePanel, Overview, QuestionCard, QuestionsTab, SheetFacts } from './Step1Inspector'

const projectRoute = getRouteApi('/_app/p/$code')

export function Step1Page() {
  const { t } = useLingui()
  const { data: session } = useSuspenseQuery(sessionQuery)
  const project = projectRoute.useLoaderData()
  const code = project.code
  usePageTitle(t`Step 1, Sheets · ${code}`)
  const { data, error, retry } = useStep1(project.id)
  if (!data) {
    if (error) return <LoadProblem error={error} onRetry={retry} className="m-4" />
    return <Skeleton rows={10} className="m-4" status={<Trans>Opening Step 1…</Trans>} />
  }
  if (data.proposals.length === 0 && data.questions.length === 0) return <NoSheets project={project} readOnly={readOnlyRole(session) !== null} />
  return (
    <KeyScope level="screen" name="step1">
      <Step1 session={session} project={project} model={step1Model(data)} coverage={data.coverage} />
    </KeyScope>
  )
}

function NoSheets({ project, readOnly }: { project: ProjectSummary; readOnly: boolean }) {
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
  return model.rows.flatMap((r) => [...r.sheets])
}

function Step1({ session, project, model, coverage }: { session: Session; project: ProjectSummary; model: Step1Model; coverage: CoverageOut }) {
  const { t } = useLingui()
  const readOnly = readOnlyRole(session)
  const refuse = useReadOnlyToast()
  const acts = useStep1Acts(project.id)
  useSummaryCounts(project, model)

  // `?sheet=<printed sheet's id>` opens that sheet (the Drawing Set report's "Open in Step 1", #118).
  const { sheet: asked } = useSearch({ strict: false }) as { sheet?: string }
  const [start] = useState(() => {
    const row = asked ? model.rows.find((r) => r.sheets.some((p) => p.sheet_id === asked)) : undefined
    const first = row?.sheets.find((p) => p.sheet_id === asked)
    return row && first ? { row: row.key, sheet: first.id } : null
  })
  const [mode, setMode] = useState<'list' | 'sheet'>(start ? 'sheet' : 'list')
  const [focused, setFocused] = useState<string | null>(start?.row ?? null)
  const [openSheet, setOpenSheet] = useState<string | null>(start?.sheet ?? null)
  const [picker, setPicker] = useState<Row | null>(null)
  const [listFor, setListFor] = useState<string | null>(null)
  const [panel, setPanel] = useState<'coverage' | null>(null)
  /** Sheet mode's selected view, by its ordinal (→ ← walk them, §6.5). */
  const [view, setView] = useState<string | null>(null)
  const [choosing, setChoosing] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const focusNext = useRef<string | null>(null)

  const rowByKey = (key: string | null) => (key ? (model.rows.find((r) => r.key === key) ?? null) : null)
  const rowOfSheet = (id: string | null) => (id ? (model.rows.find((r) => r.sheets.some((s) => s.id === id)) ?? null) : null)
  const order = sheetsInOrder(model)
  const open = order.find((s) => s.id === openSheet) ?? null
  const focusedRow = mode === 'sheet' ? rowOfSheet(openSheet) : rowByKey(focused)

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

  const focusRow = (key: string | null) => {
    setFocused(key)
    focusNext.current = key
  }

  const openRow = (row: Row) => {
    const first = row.sheets[0]
    if (!first) return
    setPicker(null)
    setView(null)
    setOpenSheet(first.id)
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

  /** After an act in sheet mode, the next sheet in list order still a Proposal (wrapping). */
  const openNextProposal = (after: string) => {
    const at = order.findIndex((s) => s.id === after)
    const ring = [...order.slice(at + 1), ...order.slice(0, at + 1)]
    const next = ring.find((s) => s.decision === null && s.id !== after && !rowOfSheet(s.id)?.question)
    setView(null)
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

  const nextQuestion = () => {
    const next = nextOpenRow(model.rows, mode === 'sheet' ? (rowOfSheet(openSheet)?.key ?? focused) : focused, true)
    if (!next) return
    if (mode === 'sheet') {
      setMode('list')
      setPicker(null)
    }
    focusRow(next.key)
  }

  const bar = useBar({
    model,
    row: focusedRow,
    mode,
    readOnly,
    bulk: () => void acts.bulk(model.bulk.confirm, model.bulk.leaveOut),
    confirmRow: (row, thenNext) => void confirmRow(row, thenNext),
    nextOpen,
    openRow,
    nextQuestion,
  })

  const page = (by: number) => {
    if (mode !== 'sheet' || !open) return
    const at = order.findIndex((s) => s.id === open.id)
    const next = order[at + by]
    if (next) {
      setView(null)
      setOpenSheet(next.id)
    }
  }

  /** → ←: the next or previous view on the open sheet, in reading order; past the last, none (§6.5). */
  const stepView = (by: number) => {
    const views = open?.views ?? []
    if (mode !== 'sheet' || views.length === 0) return
    const at = view === null ? -1 : views.findIndex((v) => String(v.ordinal) === view)
    const next = by > 0 ? (at === -1 ? 0 : at + 1) : at === -1 ? views.length - 1 : at - 1
    setView(next >= 0 && next < views.length ? String(views[next]!.ordinal) : null)
  }

  const moveFocus = (by: number) => {
    if (mode === 'sheet') return page(by)
    const at = model.rows.findIndex((r) => r.key === focused)
    const next = model.rows[at === -1 ? (by > 0 ? 0 : model.rows.length - 1) : Math.min(model.rows.length - 1, Math.max(0, at + by))]
    if (next) focusRow(next.key)
  }

  const enter = () => {
    if (readOnly) return refuse(readOnly)
    const act = bar?.button ?? bar?.ghost
    if (act) act.run()
    else nextOpen()
  }
  const undoKey = () => (readOnly ? refuse(readOnly) : void acts.undoLast())
  const excludeKey = () => {
    if (readOnly) return refuse(readOnly)
    if (focusedRow && focusedRow.sheets.length > 0) setPicker(focusedRow)
  }

  useKeys([
    { key: 'Enter', label: t`Do what the bar says`, group: 'screen', run: (event) => (event.repeat ? undefined : enter()) },
    { key: 'Ctrl Z', label: t`Undo your last act on Step 1`, group: 'screen', run: (event) => (event.repeat ? undefined : undoKey()) },
    { key: 'X', label: t`Exclude the focused sheet, with a reason`, group: 'screen', run: excludeKey },
    { key: '↓', label: t`Next row; in a sheet, the next sheet`, group: 'screen', run: () => moveFocus(1) },
    { key: '↑', label: t`Previous row; in a sheet, the previous sheet`, group: 'screen', run: () => moveFocus(-1) },
    { key: ']', label: t`Next sheet`, group: 'screen', when: () => mode === 'sheet', run: () => page(1) },
    { key: '[', label: t`Previous sheet`, group: 'screen', when: () => mode === 'sheet', run: () => page(-1) },
    { key: 'Q', label: t`Next open Question`, group: 'screen', run: nextQuestion },
    { key: '→', label: t`Next view on the sheet`, group: 'screen', when: () => mode === 'sheet', run: () => stepView(1) },
    { key: '←', label: t`Previous view on the sheet`, group: 'screen', when: () => mode === 'sheet', run: () => stepView(-1) },
    { key: 'S', label: t`The sheet picker`, group: 'screen', when: () => mode === 'sheet', run: () => setChoosing(true) },
    {
      key: 'Esc',
      label: t`Back to the list; in the list, clear the focus`,
      group: 'screen',
      when: () => mode === 'sheet' || panel !== null || focused !== null,
      run: () => {
        if (panel) setPanel(null)
        else if (mode === 'sheet' && view !== null) setView(null)
        else if (mode === 'sheet') toList()
        else {
          setFocused(null)
          ;(document.activeElement as HTMLElement | null)?.blur()
        }
      },
    },
  ])

  const spaceLabel = t`Open the focused sheet, or go back to the list`
  const fromList = () => {
    const row = rowByKey(focused) ?? model.rows.find((r) => r.sheets.length > 0) ?? null
    if (row && row.sheets.length > 0) openRow(row)
  }

  const selection = panel === 'coverage' ? (
    <CoveragePanel
      coverage={coverage}
      held={model.queue.filter((e) => e.question.kind === 'file_misread' && e.question.subject_id && model.fileNames[e.question.subject_id]).map((e) => model.fileNames[e.question.subject_id!]!)}
    />
  ) : focusedRow ? (
    <>
      {focusedRow.question ? <QuestionCard entry={focusedRow.question} readOnly={readOnly} model={model} /> : null}
      <SheetFacts
        row={focusedRow}
        showTitle={mode === 'list'}
        readOnly={readOnly !== null}
        onExclude={focusedRow.sheets.length > 0 ? () => setPicker(focusedRow) : undefined}
        onConfirmBackIn={() => void confirmRow(focusedRow, false)}
      />
    </>
  ) : (
    <Overview model={model} projectName={project.name} readOnly={readOnly} />
  )

  const pasteSection = listFor ? model.disciplines.find((d) => d.discipline === listFor) : undefined
  const pasteFile = pasteSection?.rows[0]?.sheets[0]?.file_name ?? ''

  return (
    <div className="absolute inset-0 flex flex-col">
      <SlotFill slot="toolbar.end" order={0}>
        <ModeSwitch mode={mode} onList={() => mode === 'sheet' && toList()} onSheet={() => mode === 'list' && fromList()} />
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
          <QuestionsTab model={model} readOnly={readOnly} />
        </div>
      </SlotFill>

      {mode === 'list' ? (
        <ListRegion label={spaceLabel} onSpace={fromList}>
          <SheetList
            ref={listRef}
            model={model}
            focused={focused}
            onFocusRow={setFocused}
            onOpenRow={(key) => {
              const row = rowByKey(key)
              if (row) openRow(row)
            }}
            onPasteList={readOnly ? null : setListFor}
          />
        </ListRegion>
      ) : open ? (
        <SheetMode
          projectId={project.id}
          sheet={open}
          label={spaceLabel}
          onSpace={toList}
          onPage={page}
          held={!!rowOfSheet(open.id)?.question}
          view={view}
          onSelectView={setView}
          onChoose={() => setChoosing(true)}
        />
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10">
        {picker ? (
          <ExclusionPicker
            row={picker}
            onCancel={() => setPicker(null)}
            onPick={(reason, text) => {
              const row = picker
              setPicker(null)
              void acts.excludeSheets(row.sheets, reason, text).then((done) => {
                if (done && mode === 'sheet' && openSheet) openNextProposal(openSheet)
              })
            }}
          />
        ) : bar ? (
          <Bar spec={bar} />
        ) : null}
      </div>

      {choosing ? (
        <SheetPicker
          model={model}
          current={openSheet}
          onClose={() => setChoosing(false)}
          onPick={(row) => {
            setChoosing(false)
            openRow(row)
          }}
        />
      ) : null}

      {listFor ? (
        <DrawingListDialog
          projectId={project.id}
          discipline={listFor}
          fileName={pasteFile}
          example={pasteSection?.numbering ? { first: pasteSection.numbering.first, last: pasteSection.numbering.last } : null}
          given={pasteSection?.list && pasteSection.list.source !== 'sheet' ? pasteSection.list.numbers.join('\n') : ''}
          readOnly={readOnly !== null}
          onClose={() => setListFor(null)}
          onUse={(text) => acts.setDrawingList(listFor, text)}
        />
      ) : null}
    </div>
  )
}

const MODE_PART = cn(
  'inline-flex h-control items-center border border-border-strong px-2 text-xs font-medium whitespace-nowrap text-muted-foreground',
  'hover:text-foreground aria-pressed:bg-paper aria-pressed:text-foreground',
)

/** The toolbar's "List | Sheet" (§6.1, §6.5): two toggle buttons, Space doing the same by key. */
function ModeSwitch({ mode, onList, onSheet }: { mode: 'list' | 'sheet'; onList: () => void; onSheet: () => void }) {
  const { t } = useLingui()
  return (
    <div role="group" aria-label={t`List or sheet`} className="inline-flex items-center">
      <button type="button" aria-pressed={mode === 'list'} title={t`The list: Space from a sheet`} onClick={onList} className={cn(MODE_PART, 'rounded-s-md')}>
        <Trans>List</Trans>
      </button>
      <button type="button" aria-pressed={mode === 'sheet'} title={t`The focused sheet: Space`} onClick={onSheet} className={cn(MODE_PART, 'rounded-e-md border-s-0')}>
        <Trans>Sheet</Trans>
      </button>
    </div>
  )
}

/** The list's key region: Space opens the focused sheet (m0-screens §6.1, 2.3 item 10). */
function ListRegion({ label, onSpace, children }: { label: string; onSpace: () => void; children: ReactNode }) {
  const { t } = useLingui()
  return (
    <KeyRegion name="list" role="grid" aria-label={t`Sheets`} className="min-h-0 flex-1 overflow-auto pb-24">
      <SpaceKey label={label} run={onSpace} />
      {children}
    </KeyRegion>
  )
}

function SpaceKey({ label, run }: { label: string; run: () => void }) {
  useKeys([{ key: 'Space', label, group: 'screen', run }])
  return null
}

/** Sheet mode (§6.5): the open sheet in the viewer with its views' outlines and the legend; its label and paging in the toolbar. */
function SheetMode({
  projectId,
  sheet,
  label,
  onSpace,
  onPage,
  held,
  view,
  onSelectView,
  onChoose,
}: {
  projectId: string
  sheet: ProposalOut
  label: string
  onSpace: () => void
  onPage: (by: number) => void
  held: boolean
  view: string | null
  onSelectView: (key: string | null) => void
  onChoose: () => void
}) {
  const { t, i18n } = useLingui()
  const render = useQuery(renderQuery(projectId, sheet.sheet_id))
  const region = useRef<HTMLDivElement>(null)
  const name = sheet.number ?? sheet.title
  const outlines = useMemo(
    () =>
      (sheet.views ?? []).map((v) => {
        const kind = i18n._(VIEW_KIND_NAMES[v.kind] ?? OTHER_VIEW_KIND)
        const scale = v.not_to_scale ? i18n._(NOT_TO_SCALE) : v.stated_scale
        return {
          key: String(v.ordinal),
          box: v.box.map(Number) as unknown as readonly [number, number, number, number],
          tag: scale ? `${kind}, ${scale}` : kind,
          question: held,
          excluded: v.decision === 'excluded' || sheet.decision === 'excluded',
        }
      }),
    [sheet, held, i18n],
  )

  // Focus follows the sheet into the canvas as it opens and as it pages (§6.1).
  useLayoutEffect(() => {
    const el = region.current
    if (!el) return
    const canvas = el.querySelector<HTMLElement>('[role="group"][tabindex]')
    if (canvas) canvas.focus({ preventScroll: true })
    else if (!el.contains(document.activeElement)) el.focus({ preventScroll: true })
  }, [render.data, sheet.id])

  return (
    <>
      <SlotFill slot="toolbar.start" order={1}>
        <button
          type="button"
          onClick={onChoose}
          aria-keyshortcuts="S"
          title={t`The sheet picker: S`}
          className="inline-flex h-control max-w-[250px] min-w-0 items-center gap-1 rounded-md px-1.5 text-sm hover:bg-hover"
        >
          <span className="font-semibold">
            <SheetName sheets={[sheet]} />
          </span>
          <DrawingText kind="title" text={sheet.title} className="min-w-0 text-ink-secondary" />
          <ChevronDown aria-hidden strokeWidth={1.5} className="size-3.5 shrink-0" />
        </button>
        <IconButton label={t`Previous sheet`} combo="[" onClick={() => onPage(-1)}>
          <ChevronLeft strokeWidth={1.5} className="rtl:-scale-x-100" />
        </IconButton>
        <IconButton label={t`Next sheet`} combo="]" onClick={() => onPage(1)}>
          <ChevronRight strokeWidth={1.5} className="rtl:-scale-x-100" />
        </IconButton>
      </SlotFill>
      <KeyRegion name="sheet" className="relative min-h-0 flex-1">
        <SpaceKey label={label} run={onSpace} />
        <div ref={region} tabIndex={-1} className="absolute inset-0 outline-none">
          {render.data ? (
            <SheetViewer
              key={sheet.id}
              buffer={render.data}
              label={name}
              onRetry={() => void render.refetch()}
              outlines={outlines}
              selected={view}
              onSelect={onSelectView}
              toolbarLabel={false}
            />
          ) : render.error ? (
            <LoadProblem error={render.error} onRetry={() => void render.refetch()} className="m-4" />
          ) : (
            <Skeleton rows={6} className="m-6" status={<Trans>Opening <SheetName sheets={[sheet]} />…</Trans>} />
          )}
        </div>
        <Legend sheet={sheet} held={held} />
      </KeyRegion>
    </>
  )
}

/** 4.6's legend, counting the sheet's views (§6.5): "Proposal 2 · Assigned 0 · Question 0 · Excluded 0". */
function Legend({ sheet, held }: { sheet: ProposalOut; held: boolean }) {
  const f = useFormat()
  const views = sheet.views ?? []
  const out = (v: (typeof views)[number]) => v.decision === 'excluded' || sheet.decision === 'excluded'
  const count = { proposal: 0, assigned: 0, question: 0, excluded: 0 }
  for (const v of views) {
    if (out(v)) count.excluded += 1
    else if (held) count.question += 1
    else if (sheet.decision === 'confirmed') count.assigned += 1
    else count.proposal += 1
  }
  const proposal = f.integer(count.proposal)
  const assigned = f.integer(count.assigned)
  const question = f.integer(count.question)
  const excluded = f.integer(count.excluded)
  return (
    <div data-legend="" className="pointer-events-none absolute inset-x-0 top-2 z-[1] flex justify-center">
      <span className="rounded-md border border-border bg-popover px-2 py-0.5 text-xs text-ink-secondary shadow-1">
        <Trans>
          Proposal {proposal} · Assigned {assigned} · Question {question} · Excluded {excluded}
        </Trans>
      </span>
    </div>
  )
}

/** The sheet picker (§6.5, `S`): "Sheets, in list order", grouped as the list. */
function SheetPicker({ model, current, onClose, onPick }: { model: Step1Model; current: string | null; onClose: () => void; onPick: (row: Row) => void }) {
  const { t } = useLingui()
  const rows = model.rows.filter((r) => r.sheets.length > 0)
  return (
    <KeyScope level="dialog" name="sheet-picker">
      <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              <Trans>Sheets, in list order</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>Tab or click a sheet to open it; Esc closes.</Trans>
            </DialogDescription>
          </DialogHeader>
          <ul aria-label={t`Sheets`} className="flex max-h-[50vh] flex-col overflow-y-auto">
            {rows.map((row) => (
              <li key={row.key}>
                <button
                  type="button"
                  autoFocus={row.sheets.some((s) => s.id === current)}
                  onClick={() => onPick(row)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-start text-sm hover:bg-hover focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring"
                >
                  <span className="w-24 shrink-0 font-semibold">
                    <SheetName sheets={row.sheets} />
                  </span>
                  <DrawingText kind="title" text={row.sheets[0]?.title ?? ''} className="min-w-0" />
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </KeyScope>
  )
}
