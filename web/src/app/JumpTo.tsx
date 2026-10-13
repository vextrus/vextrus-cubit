/*
 * Jump to (Ctrl K; docs/design/m0-screens.md §2.2, §4.1): the projects the member may open (story 102;
 * a member given chosen projects sees only those), and inside a project its Drawing Set, Step 1 and
 * Members and access (not for a Guest, §1.4), and its Step 1 sheets by number or title (S25-D4).
 */
import { Trans, useLingui } from '@lingui/react/macro'
import { defaultFilter } from 'cmdk'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/ui/primitives/command'
import { useQuery } from '@tanstack/react-query'
import { disciplinesQuery, useDisciplineName } from '@/drawing-set'
import { useFormat } from '@/format'
import { proposalsQuery, questionsQuery, type ProposalOut } from '@/takeoff/data'
import { requestSheet } from '@/takeoff/jump'
import { holdsItsSheets, questionQueue } from '@/takeoff/model'
import { step1AddressFor } from '@/takeoff/paths'
import { Copy } from '@/takeoff/questionWords'
import { DrawingText, StatusMark, type Status } from '@/ui'
import { PATHS, useGo } from './AppLink'
import type { ProjectSummary, Session } from './session'

const SHEET = 'sheet:'

/**
 * cmdk's own filter matches letters in order anywhere in the text, so "S-99" would find any sheet whose text
 * holds an S, a 9 and a dash. A sheet is found when every typed word starts a word of its number or title;
 * everything else keeps cmdk's.
 */
export function jumpFilter(value: string, search: string, keywords?: string[]): number {
  if (!value.startsWith(SHEET)) return defaultFilter(value, search, keywords)
  const typed = words(search)
  if (typed.length === 0) return 1
  const [number = '', title = ''] = keywords ?? []
  // The option as shown: its number, then its title; each word as written, past its leading marks, and in its parts ("GROUND-FLOOR", "PLINTH/GRADE").
  const shown = words(`${number} ${title}`).flatMap((w) => [w, w.replace(/^[^\p{L}\p{M}\p{N}]+/u, ''), ...w.split(/[^\p{L}\p{M}\p{N}]+/u)])
  if (!typed.every((token) => shown.some((w) => w.startsWith(token)))) return 0
  return number.toLowerCase().startsWith(typed[0]!) ? 1 : 0.5
}

/** The one tokenizer for what is typed and for what is shown: the text's words between spaces, as written (so "C-1", "&" and Bangla words stay whole). */
function words(text: string): string[] {
  return text.normalize('NFC').toLowerCase().split(/\s+/u).filter(Boolean)
}

/** A copy sharing its number with another, told apart by revision and date ("rev A, 12 Sep 2026", the list's form). */
function CopyOf({ sheet }: { sheet: ProposalOut }) {
  const f = useFormat()
  const date = sheet.issue_date ? f.day(sheet.issue_date) : null
  if (!sheet.revision_mark.trim()) return <>{date}</>
  const mark = <Copy sheet={sheet} />
  return date ? <Trans>{mark}, {date}</Trans> : mark
}

export function JumpTo({
  open,
  onOpenChange,
  session,
  project,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: Session
  project: ProjectSummary | undefined
}) {
  const { t } = useLingui()
  const go = useGo()
  const jump = (to: string) => {
    onOpenChange(false)
    go(to)
  }
  const name = project?.name ?? ''
  // The Step's sheets, read only once Jump to is open inside a project (the list is the Step's own cache).
  const disciplines = useQuery({ ...disciplinesQuery(project?.id ?? ''), enabled: open && project !== undefined }).data
  const disciplineName = useDisciplineName(disciplines)
  const sheets = useQuery({ ...proposalsQuery(project?.id ?? ''), enabled: open && project !== undefined }).data
  const questions = useQuery({ ...questionsQuery(project?.id ?? ''), enabled: open && project !== undefined }).data
  // A sheet an open Question holds shows the Question mark, as the list's State column does: a Discipline's gaps
  // Question leaves the sheets beside its gaps in their rows, so they keep their own mark (the model's rule).
  // Worked out only while Jump to is open: the frame draws it on every screen, whatever the cache holds.
  const asked = new Set(open && sheets?.length && questions ? questionQueue(questions, sheets).filter(holdsItsSheets).flatMap((e) => e.holds.map((h) => h.id)) : [])
  const statusOf = (p: ProposalOut): Status => (asked.has(p.id) ? 'question' : p.decision === 'confirmed' ? 'confirmed' : p.decision === 'excluded' ? 'excluded' : 'proposal')
  return (
    <CommandDialog filter={jumpFilter} open={open} onOpenChange={onOpenChange} title={t`Jump to`} description={t`Go to a project, or to a place or sheet in this one.`}>
      <CommandInput placeholder={t`Jump to a project, a place or a sheet number…`} />
      <CommandList>
        <CommandEmpty>
          <Trans>Nothing here by that name.</Trans>
        </CommandEmpty>
        {project ? (
          <CommandGroup heading={t`In ${name}`}>
            <CommandItem value={`drawing-set ${t`Drawing Set`}`} onSelect={() => jump(PATHS.drawingSet(project.code))}>
              <Trans>Drawing Set</Trans>
            </CommandItem>
            <CommandItem value={`step-1 ${t`Step 1, Sheets`}`} onSelect={() => jump(PATHS.takeoff(project.code, 1))}>
              <Trans>Step 1, Sheets</Trans>
            </CommandItem>
            {session.role !== 'guest' ? (
              <CommandItem value={`members ${t`Members and access`}`} onSelect={() => jump(PATHS.members)}>
                <Trans>Members and access</Trans>
              </CommandItem>
            ) : null}
          </CommandGroup>
        ) : null}
        {project && sheets?.length ? (
          <CommandGroup heading={t`Sheets`}>
            {sheets.map((p) => {
              // Copies of one number (revisions, or one number in two Disciplines) are told apart by revision and date,
              // and by Discipline only where the copies' Disciplines differ.
              const others = sheets.filter((o) => o.number === p.number && o.sheet_id !== p.sheet_id)
              const differs = others.some((o) => o.discipline !== p.discipline)
              return (
                <CommandItem
                  key={p.id}
                  value={`${SHEET}${p.sheet_id}`}
                  keywords={[p.number ?? '', p.title ?? '']}
                  onSelect={() => {
                    requestSheet(p.sheet_id)
                    jump(step1AddressFor(project.code, p, sheets))
                  }}
                >
                  <StatusMark status={statusOf(p)} compact />
                  <DrawingText kind="sheet-number" text={p.number ?? ''} truncate={false} className="num text-xs text-muted-foreground" />
                  <DrawingText kind="title" text={p.title ?? ''} className="min-w-0 flex-1" />
                  {others.length > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      <CopyOf sheet={p} />
                      {differs ? <> · {disciplineName(p.discipline ?? '')}</> : null}
                    </span>
                  ) : null}
                </CommandItem>
              )
            })}
          </CommandGroup>
        ) : null}
        <CommandGroup heading={t`Projects`}>
          {session.projects.map((p) => (
            <CommandItem key={p.code} value={`project ${p.code} ${p.name}`} onSelect={() => jump(PATHS.takeoff(p.code, 1))}>
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <bdi dir="ltr" className="num text-xs text-muted-foreground">
                {p.code}
              </bdi>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
