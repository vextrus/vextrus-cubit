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
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { AppLink, PATHS } from '@/app/AppLink'
import { sessionQuery, type ProjectSummary, type Session } from '@/app/session'
import { SlotFill } from '@/app/slots'
import { LoadProblem, readOnlyRole, useReadOnlyToast } from '@/auth'
import { SheetViewer } from '@/sheet'
import { Button, DrawingText, Empty, IconButton, KeyCombo, KeyRegion, KeyScope, Skeleton, SheetsGlyph, buttonVariants, useKeys } from '@/ui'
import { SheetName, useStep1Acts } from './acts'
import { Bar, ExclusionPicker, useBar } from './Bar'
import { renderQuery, useStep1, type CoverageOut, type ProposalOut } from './data'
import { DrawingListDialog } from './DrawingListDialog'
import { nextOpenRow, step1Model, type Reason, type Row, type Step1Model } from './model'
import { SheetList } from './SheetList'
import { CoverageLine, CoveragePanel, Overview, QuestionCard, QuestionsTab, SheetFacts } from './Step1Inspector'

const projectRoute = getRouteApi('/_app/p/$code')

export function Step1Page() {
  const { data: session } = useSuspenseQuery(sessionQuery)
  const project = projectRoute.useLoaderData()
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

  const bar = useBar({
    model,
    row: focusedRow,
    mode,
    readOnly,
    bulk: () => void acts.bulk(model.bulk.confirm, model.bulk.leaveOut),
    confirmRow: (row, thenNext) => void confirmRow(row, thenNext),
    nextOpen,
    openRow,
  })

  const page = (by: number) => {
    if (mode !== 'sheet' || !open) return
    const at = order.findIndex((s) => s.id === open.id)
    const next = order[at + by]
    if (next) setOpenSheet(next.id)
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
    { key: 'Q', label: t`Next open Question`, group: 'screen', run: () => {
      const next = nextOpenRow(model.rows, mode === 'sheet' ? (rowOfSheet(openSheet)?.key ?? focused) : focused, true)
      if (!next) return
      if (mode === 'sheet') setMode('list')
      focusRow(next.key)
    } },
    {
      key: 'Esc',
      label: t`Back to the list; in the list, clear the focus`,
      group: 'screen',
      when: () => mode === 'sheet' || panel !== null || focused !== null,
      run: () => {
        if (panel) setPanel(null)
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
      {focusedRow.question ? <QuestionCard entry={focusedRow.question} readOnly={readOnly} names={model.fileNames} /> : null}
      <SheetFacts row={focusedRow} showTitle={mode === 'list'} readOnly={readOnly !== null} />
    </>
  ) : (
    <Overview model={model} projectName={project.name} readOnly={readOnly} />
  )

  const pasteSection = listFor ? model.disciplines.find((d) => d.discipline === listFor) : undefined
  const pasteFile = pasteSection?.rows[0]?.sheets[0]?.file_name ?? ''

  return (
    <div className="absolute inset-0 flex flex-col">
      {mode === 'sheet' ? (
        <SlotFill slot="toolbar.end" order={0}>
          <Button variant="ghost" onClick={toList} aria-keyshortcuts="Space" /* eslint-disable-line lingui/no-unlocalized-strings -- a key name */>
            <Trans>Back to the list</Trans>
            <KeyCombo combo="Space" />
          </Button>
        </SlotFill>
      ) : null}
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
        <SheetMode projectId={project.id} sheet={open} label={spaceLabel} onSpace={toList} onPage={page} />
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

      {listFor ? (
        <DrawingListDialog
          projectId={project.id}
          discipline={listFor}
          fileName={pasteFile}
          given={pasteSection?.list && pasteSection.list.source !== 'sheet' ? pasteSection.list.numbers.join('\n') : ''}
          readOnly={readOnly !== null}
          onClose={() => setListFor(null)}
          onUse={(text) => acts.setDrawingList(listFor, text)}
        />
      ) : null}
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

/** Sheet mode (§6.5): the open sheet in the viewer, its title and paging in the toolbar. */
function SheetMode({
  projectId,
  sheet,
  label,
  onSpace,
  onPage,
}: {
  projectId: string
  sheet: ProposalOut
  label: string
  onSpace: () => void
  onPage: (by: number) => void
}) {
  const { t } = useLingui()
  const render = useQuery(renderQuery(projectId, sheet.sheet_id))
  const region = useRef<HTMLDivElement>(null)
  const name = sheet.number ?? sheet.title

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
        <DrawingText kind="title" text={sheet.title} className="max-w-[250px] text-sm text-ink-secondary" />
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
            <SheetViewer key={sheet.id} buffer={render.data} label={name} onRetry={() => void render.refetch()} />
          ) : render.error ? (
            <LoadProblem error={render.error} onRetry={() => void render.refetch()} className="m-4" />
          ) : (
            <Skeleton rows={6} className="m-6" status={<Trans>Opening <SheetName sheets={[sheet]} />…</Trans>} />
          )}
        </div>
      </KeyRegion>
    </>
  )
}
