/*
 * The files band above the sheet list (m0-screens §6.2): one chip per file of the Drawing Set, a click
 * opening that file's report in the inspector (4.5's report, as other panels are, 4.1). A read DWG
 * reads "✓ KR-STR-R0.dwg 13 sheets, two readers agree" (an amber "Bangla font" where flagged); a PDF
 * "✓ KR-STR-R0.pdf Plot for 12 of 13 pages"; a held file is
 * an amber chip "KR-STR-old.dwg held" until its Question is answered, then reads by its status code (§6.13:
 * "Held, read anyway…", amber still; "Set aside: waiting for the re-saved file" or "Set aside: sent to
 * Vextrus to check", plain, since nothing of it is read or counted); a file still reading says so; any other state names it through
 * the Drawing Set's own words (its status message). It wraps to a second line where it must, and no further: the rest are behind "n more files".
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { filesQuery, isMoving, type FileOut } from '@/drawing-set/data'
import { useFormat } from '@/format'
import { MachineText } from '@/format/machine'
import { DrawingText, cn } from '@/ui'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/ui/primitives/dropdown-menu'

/** The band's most lines (§6.2: "It wraps to a second line at 1280 and 1440"); the chips that do not fit go behind "n more files". */
const MAX_LINES = 2

export function FilesBand({ projectId, onOpen }: { projectId: string; onOpen: (file: FileOut) => void }) {
  const { t } = useLingui()
  const files = useQuery(filesQuery(projectId))
  const list = files.data?.files ?? []
  const band = useRef<HTMLDivElement>(null)
  // How many chips are drawn: all until they are measured, then as many as two lines hold with "n more files" after them.
  const names = list.map((f) => f.id).join(',')
  const [fit, setFit] = useState<{ names: string; limit: number | null }>({ names, limit: null })
  // A new set of files is measured afresh.
  const limit = fit.names === names ? fit.limit : null
  const setLimit = (next: number | null) => setFit({ names, limit: next })
  const has = list.length > 0
  const width = useRef(0)
  useLayoutEffect(() => {
    const el = band.current
    if (!el) return
    const lines = new Set([...el.querySelectorAll<HTMLElement>('[data-chip], [data-more]')].map((c) => c.offsetTop))
    if (lines.size <= MAX_LINES) return
    const chips = [...el.querySelectorAll<HTMLElement>('[data-chip]')]
    const tops = [...new Set(chips.map((c) => c.offsetTop))].sort((a, b) => a - b)
    const within = chips.filter((c) => c.offsetTop <= (tops[MAX_LINES - 1] ?? Infinity)).length
    // The first pass keeps what two lines hold; each pass after drops one more until "n more files" sits on the second line too.
    setLimit(limit === null ? Math.min(within, list.length - 1) : Math.max(0, limit - 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setLimit only writes this component's own state
  }, [fit, names, files.data])
  useLayoutEffect(() => {
    const el = band.current
    if (!el || typeof ResizeObserver === 'undefined') return
    width.current = el.clientWidth
    const watch = new ResizeObserver(() => {
      if (el.clientWidth === width.current) return
      width.current = el.clientWidth
      setFit({ names, limit: null })
    })
    watch.observe(el)
    return () => watch.disconnect()
  }, [has, names])
  if (list.length === 0) return null
  const shown = limit === null ? list : list.slice(0, limit)
  const rest = limit === null ? [] : list.slice(limit)
  const restHeld = rest.some(heldOpen)
  return (
    <div ref={band} role="list" aria-label={t`The Drawing Set’s files`} className="flex flex-wrap gap-1.5 border-b border-border bg-chrome px-3 py-1.5 text-xs">
      {shown.map((file) => (
        <span role="listitem" key={file.id} data-chip="" className="max-w-full">
          <button type="button" onClick={() => onOpen(file)} className={cn(CHIP, 'max-w-full overflow-hidden whitespace-nowrap', heldOpen(file) ? 'border-question bg-question-surface text-question' : 'border-border bg-paper text-ink-secondary')}>
            <FileChip file={file} />
          </button>
        </span>
      ))}
      {rest.length > 0 ? (
        <span role="listitem" data-more="">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={cn(CHIP, restHeld ? 'border-question bg-question-surface text-question' : 'border-border bg-paper text-ink-secondary')}>
                <Plural value={rest.length} one="# more file" other="# more files" />
                <ChevronDown aria-hidden size={12} strokeWidth={1.5} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" aria-label={t`The Drawing Set’s other files`} className="max-w-[min(32rem,90vw)]">
              {rest.map((file) => (
                <DropdownMenuItem key={file.id} onSelect={() => onOpen(file)} className={cn('h-auto min-h-row whitespace-normal py-1 text-xs', heldOpen(file) && 'text-question')}>
                  <span className="min-w-0">
                    <FileChip file={file} />
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      ) : null}
    </div>
  )
}

const CHIP = 'inline-flex h-6 items-center gap-1.5 rounded-sm border px-2 hover:bg-hover focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring'

/** A held file whose Question is still open: amber. */
const heldOpen = (file: FileOut) => file.state === 'held' && !setAside(file)

/** A held file whose Question was answered "Set this file aside…": none of it is read or counted. */
function setAside(file: FileOut): boolean {
  return file.status.code === 'drawings.files.await_resaved' || file.status.code === 'drawings.files.sent_to_vextrus'
}

function FileChip({ file }: { file: FileOut }) {
  const f = useFormat()
  const name = <DrawingText kind="file-name" text={file.name} truncate={false} className="text-foreground" />
  const code = file.status.code
  const params = file.status.params as Record<string, unknown>
  if (file.state === 'held' && code !== 'drawings.files.held')
    return (
      <>
        {name} <MachineText message={file.status} />
      </>
    )
  if (file.state === 'held')
    return (
      <Trans>
        {name} held
      </Trans>
    )
  if (isMoving(file))
    return (
      <>
        <span aria-hidden className="size-2.5 animate-spin rounded-full border border-current border-t-transparent motion-reduce:animate-none" />
        {name} <MachineText message={file.status} />
      </>
    )
  if (file.state === 'read' && (code === 'drawings.files.plot_matched' || code === 'drawings.files.plot_matched_lines') && typeof params.matched === 'number' && typeof params.pages === 'number') {
    if (params.matched === 0)
      return (
        <span className="text-question">
          <Trans>{name}: no page matched a sheet</Trans>
        </span>
      )
    const matched = f.integer(params.matched)
    const pages = params.pages
    return (
      <>
        ✓ {name} <Plural value={pages} one={`Plot for ${matched} of # page`} other={`Plot for ${matched} of # pages`} />
      </>
    )
  }
  if (file.state === 'read' && (code === 'drawings.files.read' || code === 'drawings.files.read_bangla')) {
    const n = file.sheets_found
    return (
      <>
        ✓ {name} {n === null || n === undefined ? <Trans>two readers agree</Trans> : <Plural value={n} one="# sheet, two readers agree" other="# sheets, two readers agree" />}
        {code === 'drawings.files.read_bangla' ? (
          <span className="rounded-sm bg-question-surface px-1 text-question">
            <Trans>Bangla font</Trans>
          </span>
        ) : null}
      </>
    )
  }
  if (code === 'drawings.files.plot_waiting')
    return (
      <Trans>
        {name} waiting for its DWG
      </Trans>
    )
  return (
    <>
      {name} <MachineText message={file.status} />
    </>
  )
}
