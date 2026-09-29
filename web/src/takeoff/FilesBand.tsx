/*
 * The files band above the sheet list (m0-screens §6.2): one chip per file of the Drawing Set, a click
 * opening that file's report in the inspector (4.5's report, as other panels are, 4.1). A read DWG
 * reads "✓ KR-STR-R0.dwg 13 sheets"; a PDF that matched sheets "✓ KR-STR-R0.pdf Plot"; a held file is
 * an amber chip "KR-STR-old.dwg held"; a file still reading says so; any other state names it through
 * the Drawing Set's own words (its status message). It wraps to a second line where it must.
 */
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useQuery } from '@tanstack/react-query'
import { filesQuery, isMoving, type FileOut } from '@/drawing-set/data'
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
            tabIndex={-1}
            onClick={() => onOpen(file)}
            className={cn(
              'inline-flex h-6 items-center gap-1.5 rounded-sm border px-2 hover:bg-hover',
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
  const name = <DrawingText kind="file-name" text={file.name} truncate={false} className="text-foreground" />
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
  if (file.state === 'read' && file.format === 'pdf')
    return file.plot_for.length > 0 ? (
      <Trans>
        ✓ {name} Plot
      </Trans>
    ) : (
      <Trans>
        ✓ {name} matched no sheet
      </Trans>
    )
  if (file.state === 'read') {
    const n = file.sheets_found ?? 0
    return (
      <>
        ✓ {name} <Plural value={n} one="# sheet" other="# sheets" />
      </>
    )
  }
  return (
    <>
      {name} <MachineText message={file.status} />
    </>
  )
}
