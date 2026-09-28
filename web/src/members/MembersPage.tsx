/*
 * Members and access (docs/design/m0-screens.md §4.4; stories 58–62, 64, 101; wireframes `members-*.svg`):
 * who can open the Developer's projects, and which; invite; see and end Vextrus access and outsiders'.
 * The MD and a QS see the whole page; a Vextrus Engineer the people only, with no Invite; a Guest has
 * no page (the route answers "Page not found", §1.4).
 *
 * 1. People at Shapla Homes Ltd: Name · Email · Role · Projects · Since · Until; "Kamal Uddin (you)".
 * 2. Vextrus access: Vextrus Engineer · Invited by · Projects · From · Until · Acts ("12 acts, last
 *    26 Sep 2026", opening the person's acts in a side panel). Ended access stays, muted: "Revoked by
 *    Kamal Uddin, 26 Sep 2026" or "Ended 26 Oct 2026".
 * 3. Invitations not used yet: Email · Role · Projects · Link works until.
 * Each row offers exactly the acts the API says the signed-in user may do on it ("Renew 30 days",
 * "Revoke", "Copy link", "Withdraw"); an act the API refuses meanwhile is said in its words.
 */
import { useRef, useState, type ReactNode } from 'react'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { ApiRefused } from '@/api/client'
import { PageLayout } from '@/app/Frame'
import { roleName } from '@/app/roles'
import { sessionQuery, type Session } from '@/app/session'
import { can, usePageTitle } from '@/auth'
import { EMPTY, useFormat } from '@/format'
import { MachineText, type MachineMessage } from '@/format/machine'
import { Button, ErrorBar, Skeleton, cn, useToast } from '@/ui'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/primitives/dialog'
import { ActsPanel } from './ActsPanel'
import { InviteDialog } from './InviteDialog'
import { LinkShown } from './LinkShown'
import { inviteLink, membersFrom, membersQuery, newLink, renew, revoke, withdraw, type InvitationRow, type MemberAction, type Members, type PersonRow } from './data'

type Problem = MachineMessage | 'unreachable' | null

/** "All projects", or the codes: "KR-01, BP-02". */
function ProjectsCell({ projects }: { projects: readonly string[] | 'all' }) {
  const { t } = useLingui()
  if (projects === 'all') return <Trans>All projects</Trans>
  if (projects.length === 0) return <>{EMPTY}</>
  let joined = projects[0]!
  for (const code of projects.slice(1)) joined = t`${joined}, ${code}`
  return <bdi dir="ltr">{joined}</bdi>
}

/** Until: the end date, "—", or how the access ended. */
function UntilCell({ row }: { row: PersonRow }) {
  const f = useFormat()
  if (row.ended) {
    const date = f.date(row.ended.at)
    const by = row.ended.by ?? ''
    if (row.ended.how === 'expired') return <Trans>Ended {date}</Trans>
    if (row.ended.by) return <Trans>Revoked by {by}, {date}</Trans>
    return <Trans>Revoked {date}</Trans>
  }
  return <>{row.until ? f.date(row.until) : EMPTY}</>
}

function Cell({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <td className={cn('h-row truncate px-2 align-middle', className)} title={title}>
      {children}
    </td>
  )
}

function Head({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn('h-row px-2 text-start align-middle text-xs font-semibold text-ink-secondary', className)}>{children}</th>
}

function Table({ label, columns, children }: { label: string; columns: readonly [ReactNode, string][]; children: ReactNode }) {
  return (
    <table aria-label={label} className="w-full table-fixed border-collapse overflow-hidden rounded-md border border-border bg-paper text-sm">
      <colgroup>
        {columns.map(([, width], i) => (
          <col key={i} className={width} />
        ))}
      </colgroup>
      <thead className="border-b border-border bg-chrome-sunken">
        <tr>
          {columns.map(([name], i) => (
            <Head key={i} className={i === columns.length - 1 ? 'text-end' : undefined}>
              {name}
            </Head>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

function Section({ id, title, line, children }: { id: string; title: ReactNode; line?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <div className="flex items-baseline gap-3">
        <h2 id={id} className="text-md">
          {title}
        </h2>
        {line ? <p className="text-xs text-ink-secondary">{line}</p> : null}
      </div>
      {children}
    </section>
  )
}

function EmptyRow({ span, children }: { span: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={span} className="h-row px-2 text-ink-secondary">
        {children}
      </td>
    </tr>
  )
}

interface RowActs {
  busy: string | null
  act: (action: MemberAction, row: PersonRow | InvitationRow) => void
}

function Acts({ row, acts }: { row: PersonRow | InvitationRow; acts: RowActs }) {
  const label: Record<MemberAction, ReactNode> = {
    renew: <Trans>Renew 30 days</Trans>,
    revoke: <Trans>Revoke</Trans>,
    copy_link: <Trans>Copy link</Trans>,
    withdraw: <Trans>Withdraw</Trans>,
  }
  return (
    <span className="inline-flex justify-end gap-1.5">
      {row.actions.map((action) => (
        <Button
          key={action}
          variant={action === 'withdraw' ? 'ghost' : 'secondary'}
          className="h-6"
          disabled={acts.busy !== null}
          saving={acts.busy === `${action}:${row.membershipId}`}
          onClick={() => acts.act(action, row)}
        >
          {label[action]}
        </Button>
      ))}
    </span>
  )
}

function PeopleTable({ session, rows, acts }: { session: Session; rows: readonly PersonRow[]; acts: RowActs }) {
  const { t, i18n } = useLingui()
  const f = useFormat()
  const developer = session.developer.name
  return (
    <Table
      label={t`People at ${developer}`}
      columns={[
        [t`Name`, 'w-[180px]'],
        [t`Email`, 'w-[250px]'],
        [t`Role`, 'w-[80px]'],
        [t`Projects`, 'w-[120px]'],
        [t`Since`, 'w-[110px]'],
        [t`Until`, 'w-auto'],
        [<span className="sr-only">{t`Acts on this person`}</span>, 'w-[230px]'],
      ]}
    >
      {rows.map((row) => {
        const name = row.name
        return (
          <tr key={row.membershipId} className={cn('border-b border-border last:border-b-0', row.ended && 'text-muted-foreground')}>
            <Cell title={row.name}>{row.you ? t`${name} (you)` : <bdi>{name}</bdi>}</Cell>
            <Cell title={row.email}>
              <bdi>{row.email}</bdi>
            </Cell>
            <Cell>{roleName(row.role, i18n)}</Cell>
            <Cell>
              <ProjectsCell projects={row.projects} />
            </Cell>
            <Cell className="num">{f.date(row.since)}</Cell>
            <Cell className="num">
              <UntilCell row={row} />
            </Cell>
            <Cell className="text-end">
              <Acts row={row} acts={acts} />
            </Cell>
          </tr>
        )
      })}
    </Table>
  )
}

function VextrusTable({ rows, acts, onActs, actsOpen }: { rows: readonly PersonRow[]; acts: RowActs; onActs: (row: PersonRow, from: HTMLElement) => void; actsOpen: string | null }) {
  const { t } = useLingui()
  const f = useFormat()
  return (
    <Table
      label={t`Vextrus access`}
      columns={[
        [t`Vextrus Engineer`, 'w-[160px]'],
        [t`Invited by`, 'w-[130px]'],
        [t`Projects`, 'w-[120px]'],
        [t`From`, 'w-[110px]'],
        [t`Until`, 'w-[190px]'],
        [t`Acts`, 'w-auto'],
        [<span className="sr-only">{t`Acts on this access`}</span>, 'w-[230px]'],
      ]}
    >
      {rows.length === 0 ? (
        <EmptyRow span={7}>
          <Trans>No one from Vextrus has access.</Trans>
        </EmptyRow>
      ) : (
        rows.map((row) => {
          const last = row.lastActAt ? f.date(row.lastActAt) : ''
          const count = row.acts
          return (
            <tr key={row.membershipId} className={cn('border-b border-border last:border-b-0', row.ended && 'text-muted-foreground')}>
              <Cell title={row.name}>
                <bdi>{row.name}</bdi>
              </Cell>
              <Cell>{row.invitedBy ? <bdi>{row.invitedBy}</bdi> : EMPTY}</Cell>
              <Cell>
                <ProjectsCell projects={row.projects} />
              </Cell>
              <Cell className="num">{f.date(row.since)}</Cell>
              <Cell className="num">
                <UntilCell row={row} />
              </Cell>
              <Cell>
                <button
                  type="button"
                  aria-expanded={actsOpen === row.membershipId}
                  onClick={(event) => onActs(row, event.currentTarget)}
                  className="rounded-xs text-start text-primary underline-offset-2 hover:underline"
                >
                  {count === 0 ? <Trans>No acts yet</Trans> : <Plural value={count} one={`# act, last ${last}`} other={`# acts, last ${last}`} />}
                </button>
              </Cell>
              <Cell className="text-end">
                <Acts row={row} acts={acts} />
              </Cell>
            </tr>
          )
        })
      )}
    </Table>
  )
}

function InvitationsTable({ rows, acts }: { rows: readonly InvitationRow[]; acts: RowActs }) {
  const { t, i18n } = useLingui()
  const f = useFormat()
  return (
    <Table
      label={t`Invitations not used yet`}
      columns={[
        [t`Email`, 'w-[300px]'],
        [t`Role`, 'w-[140px]'],
        [t`Projects`, 'w-[160px]'],
        [t`Link works until`, 'w-auto'],
        [<span className="sr-only">{t`Acts on this invitation`}</span>, 'w-[230px]'],
      ]}
    >
      {rows.length === 0 ? (
        <EmptyRow span={5}>
          <Trans>No invitations are waiting to be used.</Trans>
        </EmptyRow>
      ) : (
        rows.map((row) => (
          <tr key={row.membershipId} className="border-b border-border last:border-b-0">
            <Cell title={row.email}>
              <bdi>{row.email}</bdi>
            </Cell>
            <Cell>{roleName(row.role, i18n)}</Cell>
            <Cell>
              <ProjectsCell projects={row.projects} />
            </Cell>
            <Cell className="num">{f.date(row.linkWorksUntil)}</Cell>
            <Cell className="text-end">
              <Acts row={row} acts={acts} />
            </Cell>
          </tr>
        ))
      )}
    </Table>
  )
}

/** Loading (§4.4): Skeleton rows per section. */
export function MembersLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton rows={3} status={<Trans>Opening Members and access…</Trans>} />
      <Skeleton rows={2} status={null} />
      <Skeleton rows={2} status={null} />
    </div>
  )
}

export function MembersView({ session, members }: { session: Session; members: Members }) {
  const f = useFormat()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [inviting, setInviting] = useState(false)
  const [actsOf, setActsOf] = useState<PersonRow | null>(null)
  const actsOpener = useRef<HTMLElement | null>(null)
  const [revoking, setRevoking] = useState<PersonRow | null>(null)
  const [shown, setShown] = useState<{ email: string; link: string; worksUntil: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<Problem>(null)
  const developer = session.developer.name
  const manages = can(session, 'access')

  async function run(key: string, work: () => Promise<void>) {
    setBusy(key)
    setProblem(null)
    try {
      await work()
    } catch (error) {
      if (error instanceof ApiRefused && error.refusal) setProblem(error.refusal)
      else if (error instanceof TypeError) setProblem('unreachable')
      else throw error
    } finally {
      setBusy(null)
      await queryClient.invalidateQueries({ queryKey: membersQuery.queryKey })
    }
  }

  const acts: RowActs = {
    busy,
    act(action, row) {
      const key = `${action}:${row.membershipId}`
      if (action === 'revoke' && row.kind === 'person') return setRevoking(row)
      if (action === 'renew' && row.kind === 'person') {
        const name = row.name
        return void run(key, async () => {
          const { expires_at } = await renew(row.membershipId)
          const date = f.date(expires_at)
          toast.show({ message: <Trans>{name}’s access now ends on {date}.</Trans> })
        })
      }
      if (action === 'withdraw') {
        return void run(key, async () => {
          await withdraw(row.membershipId)
          toast.show({ message: <Trans>Invitation withdrawn. The link no longer works.</Trans> })
        })
      }
      if (action === 'copy_link' && row.kind === 'invitation') {
        return void run(key, async () => {
          const link = await newLink(row.membershipId)
          setShown({ email: row.email, link: inviteLink(link.token), worksUntil: link.link_expires_at })
        })
      }
    },
  }

  const revokingName = revoking?.name ?? ''
  return (
    <PageLayout
      panel={
        actsOf ? (
          <ActsPanel
            person={actsOf}
            onClose={() => {
              setActsOf(null)
              actsOpener.current?.focus()
            }}
          />
        ) : undefined
      }
    >
      <header className="mb-5 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl">
            <Trans>Members and access</Trans>
          </h1>
          <p className="text-sm text-ink-secondary">
            <Trans>Who can open {developer}’s projects</Trans>
          </p>
        </div>
        {manages ? (
          <Button variant="primary" onClick={() => setInviting(true)}>
            <Trans>Invite</Trans>
          </Button>
        ) : null}
      </header>
      {problem ? (
        <ErrorBar className="mb-4">{problem === 'unreachable' ? <Trans>Vextrus can’t be reached. Check your connection and try again.</Trans> : <MachineText message={problem} />}</ErrorBar>
      ) : null}
      <div className="flex flex-col gap-6">
        <Section id="people" title={<Trans>People at {developer}</Trans>}>
          <PeopleTable session={session} rows={members.people} acts={acts} />
        </Section>
        {manages ? (
          <>
            <Section id="vextrus" title={<Trans>Vextrus access</Trans>} line={<Trans>Vextrus sees your data only while an invitation below is current. You can end it at any time.</Trans>}>
              <VextrusTable
                rows={members.vextrus}
                acts={acts}
                actsOpen={actsOf?.membershipId ?? null}
                onActs={(row, from) => {
                  actsOpener.current = from
                  setActsOf(row)
                }}
              />
            </Section>
            <Section id="invitations" title={<Trans>Invitations not used yet</Trans>}>
              <InvitationsTable rows={members.invitations} acts={acts} />
            </Section>
          </>
        ) : null}
      </div>

      {manages ? <InviteDialog session={session} open={inviting} onOpenChange={setInviting} /> : null}

      <Dialog open={revoking !== null} onOpenChange={(open) => (open ? undefined : setRevoking(null))}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              <Trans>End {revokingName}’s access now?</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>Their next click is refused. What they did stays under their name.</Trans>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setRevoking(null)}>
              <Trans>Cancel</Trans>
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const row = revoking
                setRevoking(null)
                if (!row) return
                const name = row.name
                void run(`revoke:${row.membershipId}`, async () => {
                  await revoke(row.membershipId)
                  toast.show({ message: <Trans>{name}’s access has ended.</Trans> })
                })
              }}
            >
              <Trans>End access</Trans>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shown !== null} onOpenChange={(open) => (open ? undefined : setShown(null))}>
        <DialogContent className="sm:max-w-[480px]" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              <Trans>Copy link</Trans>
            </DialogTitle>
          </DialogHeader>
          {shown ? <LinkShown email={shown.email} link={shown.link} worksUntil={shown.worksUntil} replaced /> : null}
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}

export function MembersPage() {
  const { t } = useLingui()
  const { data: session } = useSuspenseQuery(sessionQuery)
  usePageTitle(t`Members and access`)
  const members = useQuery({ ...membersQuery, select: (out) => membersFrom(out, session) })
  if (members.data) return <MembersView session={session} members={members.data} />
  return (
    <PageLayout>
      <header className="mb-5">
        <h1 className="text-xl">
          <Trans>Members and access</Trans>
        </h1>
      </header>
      {members.error instanceof ApiRefused && members.error.refusal ? (
        <ErrorBar>
          <MachineText message={members.error.refusal} />
        </ErrorBar>
      ) : (
        <MembersLoading />
      )}
    </PageLayout>
  )
}
