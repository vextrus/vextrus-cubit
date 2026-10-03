/*
 * The files band above the sheet list (m0-screens §6.2): one chip per file of the Drawing Set, a click
 * opening that file's report in the inspector (4.5's report, as other panels are, 4.1). A read DWG
 * reads "✓ KR-STR-R0.dwg 13 sheets, two readers agree" (an amber "Bangla font" where flagged); a PDF
 * "✓ KR-STR-R0.pdf Plot for 12 of 13 pages"; a held file is
 * an amber chip "KR-STR-old.dwg held"; a file still reading says so; any other state names it through
 * the Drawing Set's own words (its status message). It wraps to a second line where it must.
 */
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useQuery } from '@tanstack/react-query'
import { filesQuery, isMoving, type FileOut } from '@/drawing-set/data'
import { useFormat } from '@/format'
import { MachineText } from '@/format/machine'
import { DrawingText, cn } from '@/ui'

export function FilesBand({ projectId, onOpen }: { projectId: string; onOpen: (file: FileOut) => void }) {
  const { t } = useLingui()
  const files = useQuery(filesQuery(projectId))
  const list = files.data?.files ?? []
  if (list.length === 0) return null
  return (
    <div role="list" aria-label={t`The Drawing Set’s files`} className="flex flex-wrap gap-1.5 border-b border-border bg-chrome px-3 py-1.5 text-xs">
      {list.map((file) => (
        <span role="listitem" key={file.id}>
          <button
            type="button"
            onClick={() => onOpen(file)}
            className={cn(
              'inline-flex h-6 items-center gap-1.5 rounded-sm border px-2 hover:bg-hover focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring',
              file.state === 'held' ? 'border-question bg-question-surface text-question' : 'border-border bg-paper text-ink-secondary',
            )}
          >
            <FileChip file={file} />
          </button>
        </span>
      ))}
    </div>
  )
}

function FileChip({ file }: { file: FileOut }) {
  const f = useFormat()
  const name = <DrawingText kind="file-name" text={file.name} truncate={false} className="text-foreground" />
  const code = file.status.code
  const params = file.status.params as Record<string, unknown>
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
