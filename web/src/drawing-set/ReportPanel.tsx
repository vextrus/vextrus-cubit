/*
 * A file's report (docs/design/m0-screens.md §4.5, "The report panel"): the 480 px panel docked on the
 * right when a row is opened. Its header names the file, its Discipline and who added it when, and
 * repeats the row's status; then what Vextrus found, each section in the API's sentences and hidden when
 * it has nothing to say: for a DWG, Readers, Sheets, Bangla text, Fonts and Plot; for a PDF, Made by and
 * Pages. A file not read in full says so first (21a's `takeoff.read_file.not_read_in_full`, the file's
 * `finding`). Esc or the close button closes it.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useCloseOnEsc } from '@/app/shell'
import { LoadProblem } from '@/auth'
import { useFormat } from '@/format'
import { MachineText, type MachineMessage } from '@/format/machine'
import { DrawingText, IconButton, Skeleton } from '@/ui'
import { isMoving, reportQuery, type DisciplineOut, type FileOut } from './data'
import { useDisciplineName } from './discipline'

function Section({ title, messages, children }: { title: ReactNode; messages: readonly MachineMessage[]; children?: ReactNode }) {
  if (messages.length === 0 && !children) return null
  return (
    <section className="flex flex-col gap-1.5 border-b border-border py-3 last:border-b-0">
      <h3 className="text-sm font-semibold">{title}</h3>
      {messages.map((m, i) => (
        <p key={i} className="text-sm">
          <MachineText message={m} />
        </p>
      ))}
      {children}
    </section>
  )
}

export function ReportPanel({
  projectId,
  file,
  disciplines,
  onClose,
}: {
  projectId: string
  file: FileOut
  disciplines: readonly DisciplineOut[] | undefined
  onClose: () => void
}) {
  const { t } = useLingui()
  const f = useFormat()
  const heading = useRef<HTMLHeadingElement>(null)
  const nameOf = useDisciplineName(disciplines)
  useCloseOnEsc(true, onClose)
  useEffect(() => heading.current?.focus(), [file.id])
  const report = useQuery(reportQuery(projectId, file.id, isMoving(file)))
  const r = report.data

  const date = f.date(file.added_at)
  const name = file.added_by_name
  const by = file.added_by_vextrus ? t`${name} (Vextrus)` : name
  const discipline = file.discipline ? nameOf(file.discipline) : null

  return (
    <section aria-labelledby="report-heading" className="flex h-full flex-col">
      <header className="flex items-start gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 id="report-heading" ref={heading} tabIndex={-1} className="mb-[5px] truncate text-md">
            <DrawingText kind="file-name" text={file.name} />
          </h2>
          <p className="text-xs text-ink-secondary">
            {discipline ? <Trans>{discipline}. Added {date} by {by}</Trans> : <Trans>Added {date} by {by}</Trans>}
          </p>
          <p className="mt-1 text-sm">
            <MachineText message={file.status} />
          </p>
        </div>
        <IconButton label={t`Close`} combo="Esc" onClick={onClose}>
          <X strokeWidth={1.5} />
        </IconButton>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-1">
        {file.finding ? (
          <p className="border-b border-border py-3 text-sm">
            <MachineText message={file.finding} />
          </p>
        ) : null}
        {report.isPending ? (
          <Skeleton rows={4} className="py-3" status={<Trans>Opening the file’s report…</Trans>} />
        ) : report.isError ? (
          <LoadProblem error={report.error} onRetry={() => void report.refetch()} className="my-3" />
        ) : r ? (
          <>
            <Section title={<Trans>Readers</Trans>} messages={r.readers} />
            <Section title={<Trans>Sheets</Trans>} messages={r.sheets} />
            <Section title={<Trans>Bangla text</Trans>} messages={r.bangla} />
            <Section title={<Trans>Fonts</Trans>} messages={r.fonts}>
              {r.font_rows.length ? (
                <table aria-label={t`Fonts`} className="w-full table-fixed border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-1 py-1 text-start text-xs font-semibold text-ink-secondary">
                        <Trans>The drawing asks for</Trans>
                      </th>
                      <th className="px-1 py-1 text-start text-xs font-semibold text-ink-secondary">
                        <Trans>How close</Trans>
                      </th>
                      <th className="w-[64px] px-1 py-1 text-end text-xs font-semibold text-ink-secondary">
                        <Trans>Texts</Trans>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.font_rows.map((row, i) => (
                      <tr key={i} className="border-b border-border last:border-b-0">
                        <td className="px-1 py-1 align-top">
                          <MachineText message={row.asked} />
                        </td>
                        <td className="px-1 py-1 align-top">
                          <MachineText message={row.how_close} />
                        </td>
                        <td className="num px-1 py-1 text-end align-top">{f.integer(row.texts)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </Section>
            <Section title={<Trans>Plot</Trans>} messages={r.plot} />
            <Section title={<Trans>Made by</Trans>} messages={r.made_by} />
            <Section title={<Trans>Pages</Trans>} messages={r.pages} />
          </>
        ) : null}
      </div>
    </section>
  )
}
