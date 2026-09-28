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
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { ApiRefused } from '@/api/client'
import { PageLayout } from '@/app/Frame'
import { roleName } from '@/app/roles'
import { sessionQuery, type Session } from '@/app/session'
import { LoadProblem, ProblemBar, can, problemOf, sameSession, usePageTitle, useSignedInAgain, type Problem } from '@/auth'
import { EMPTY, useFormat } from '@/format'
import { Button, Skeleton, cn, useToast } from '@/ui'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/primitives/dialog'
import { ActsPanel } from './ActsPanel'
import { InviteDialog } from './InviteDialog'
import { LinkShown } from './LinkShown'
import { inviteLink, membersFrom, membersQuery, newLink, renew, revoke, withdraw, type InvitationRow, type MemberAction, type Members, type PersonRow } from './data'


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
function useUntilText(): (row: PersonRow) => string {
  const { t } = useLingui()
  const f = useFormat()
  return (row) => {
    if (row.ended) {
      // The line may wrap in its cell, but never inside the date.
      const date = f.date(row.ended.at).replace(/ /g, ' ')
      const by = row.ended.by ?? ''
      if (row.ended.how === 'expired') return t`Ended ${date}`
      if (row.ended.by) return t`Revoked by ${by}, ${date}`
      return t`Revoked ${date}`
    }
    return row.until ? f.date(row.until) : EMPTY
  }
}

/** Until, whole: "Revoked by Kamal Uddin, 26 Sep 2026" wraps in its cell rather than being cut (design gate 20a r1). */
function UntilCell({ row }: { row: PersonRow }) {
  const text = useUntilText()(row)
  return <td className="num h-row px-2 py-1 align-middle">{text}</td>
}

function Cell({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <td className={cn('h-row truncate px-2 align-middle', className)} title={title}>
      {children}
    </td>
  )
}

/**
 * A row's acts: never cut, so each button and its focus ring show whole (design gate 20a r1, item 7),
 * and held at the row's end when the table scrolls sideways, so they stay in reach.
 */
function ActsCell({ children }: { children: ReactNode }) {
  return <td className="sticky end-0 h-row bg-paper px-2 py-1 text-end align-middle whitespace-nowrap">{children}</td>
}

function Head({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn('h-row px-2 text-start align-middle text-xs font-semibold text-ink-secondary', className)}>{children}</th>
}

/** A column: its heading, its width, and whether it stays while a person's acts are open beside the page. */
interface Column {
  name: ReactNode
  width: number
  beside?: boolean
}

/** The columns shown: all of them, or, with a person's acts open beside the page, those that stay. */
function shownColumns(columns: readonly Column[], compact: boolean): readonly Column[] {
  return compact ? columns.filter((c) => c.beside) : columns
}

function Table({ label, columns, compact, children }: { label: string; columns: readonly Column[]; compact: boolean; children: ReactNode }) {
  const shown = shownColumns(columns, compact)
  return (
    // Every column fits the page (960 px of 1120), and with a person's acts open the columns that stay
    // fit what is left at 1280. Narrower still, the table scrolls sideways within its section, its
    // acts held at the row's end, rather than cutting a column away.
    <div className="overflow-x-auto rounded-md border border-border">
      <table aria-label={label} style={{ minWidth: shown.reduce((sum, c) => sum + c.width, 0) }} className="w-full table-fixed border-collapse bg-paper text-sm">
        <colgroup>
          {shown.map((c, i) => (
            <col key={i} style={{ width: c.width }} />
          ))}
        </colgroup>
        <thead className="border-b border-border bg-chrome-sunken">
          <tr>
            {shown.map((c, i) => (
              <Head key={i} className={i === shown.length - 1 ? 'sticky end-0 bg-chrome-sunken text-end' : undefined}>
                {c.name}
              </Head>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function Section({ id, title, line, children }: { id: string; title: ReactNode; line?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <div className="flex items-baseline gap-3">
        {/* Focusable, for where focus goes when the row it was on is gone (after Revoke or Withdraw). */}
        <h2 id={id} tabIndex={-1} className="text-md">
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
  const { t } = useLingui()
  const label: Record<MemberAction, ReactNode> = {
    renew: <Trans>Renew 30 days</Trans>,
    revoke: <Trans>Revoke</Trans>,
    copy_link: <Trans>Copy link</Trans>,
    withdraw: <Trans>Withdraw</Trans>,
  }
  // Each button names whom it acts on, its words first (design gate 20a r1): four "Revoke"s tell a
  // screen reader nothing.
  const who = row.kind === 'person' ? row.name : row.email
  const named: Record<MemberAction, string> = {
    renew: t`Renew 30 days for ${who}`,
    revoke: t`Revoke ${who}`,
    copy_link: t`Copy link for ${who}`,
    withdraw: t`Withdraw the invitation for ${who}`,
  }
  return (
    <span className="inline-flex justify-end gap-1.5">
      {row.actions.map((action) => (
        <Button
          key={action}
          variant={action === 'withdraw' ? 'ghost' : 'secondary'}
          className="h-6"
          aria-label={named[action]}
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

function PeopleTable({ session, rows, acts, compact }: { session: Session; rows: readonly PersonRow[]; acts: RowActs; compact: boolean }) {
  const { t, i18n } = useLingui()
  const f = useFormat()
  const developer = session.developer.name
  return (
    <Table
      label={t`People at ${developer}`}
      compact={compact}
      columns={[
        { name: t`Name`, width: 150, beside: true },
        { name: t`Email`, width: 190 },
        { name: t`Role`, width: 70, beside: true },
        { name: t`Projects`, width: 100, beside: true },
        { name: t`Since`, width: 100 },
        { name: t`Until`, width: 150, beside: true },
        { name: <span className="sr-only">{t`Renew or revoke`}</span>, width: 200, beside: true },
      ]}
    >
      {rows.map((row) => {
        const name = row.name
        return (
          <tr key={row.membershipId} className={cn('border-b border-border last:border-b-0', row.ended && 'text-muted-foreground')}>
            <Cell title={row.name}>{row.you ? t`${name} (you)` : <bdi>{name}</bdi>}</Cell>
            {compact ? null : (
              <Cell title={row.email}>
                <bdi>{row.email}</bdi>
              </Cell>
            )}
            <Cell>{roleName(row.role, i18n)}</Cell>
            <Cell>
              <ProjectsCell projects={row.projects} />
            </Cell>
            {compact ? null : <Cell className="num">{f.date(row.since)}</Cell>}
            <UntilCell row={row} />
            <ActsCell>
              <Acts row={row} acts={acts} />
            </ActsCell>
          </tr>
        )
      })}
    </Table>
  )
}

function VextrusTable({
  rows,
  acts,
  onActs,
  actsOpen,
  compact,
}: {
  rows: readonly PersonRow[]
  acts: RowActs
  onActs: (row: PersonRow, from: HTMLElement) => void
  actsOpen: string | null
  compact: boolean
}) {
  const { t } = useLingui()
  const f = useFormat()
  const columns: Column[] = [
    { name: t`Vextrus Engineer`, width: 125, beside: true },
    { name: t`Invited by`, width: 100 },
    { name: t`Projects`, width: 95, beside: true },
    { name: t`From`, width: 95 },
    { name: t`Until`, width: 165, beside: true },
    { name: t`Acts`, width: 160, beside: true },
    { name: <span className="sr-only">{t`Renew or revoke`}</span>, width: 200, beside: true },
  ]
  return (
    <Table label={t`Vextrus access`} compact={compact} columns={columns}>
      {rows.length === 0 ? (
        <EmptyRow span={shownColumns(columns, compact).length}>
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
              {compact ? null : <Cell>{row.invitedBy ? <bdi>{row.invitedBy}</bdi> : EMPTY}</Cell>}
              <Cell>
                <ProjectsCell projects={row.projects} />
              </Cell>
              {compact ? null : <Cell className="num">{f.date(row.since)}</Cell>}
              <UntilCell row={row} />
              {/* Whole, never cut: it may wrap. */}
              <td className="h-row px-2 py-1 align-middle">
                <button
                  type="button"
                  aria-expanded={actsOpen === row.membershipId}
                  onClick={(event) => onActs(row, event.currentTarget)}
                  className="rounded-xs text-start text-primary underline-offset-2 hover:underline"
                >
                  {count === 0 ? <Trans>No acts yet</Trans> : <Plural value={count} one={`# act, last ${last}`} other={`# acts, last ${last}`} />}
                </button>
              </td>
              <ActsCell>
                <Acts row={row} acts={acts} />
              </ActsCell>
            </tr>
          )
        })
      )}
    </Table>
  )
}

function InvitationsTable({ rows, acts, compact }: { rows: readonly InvitationRow[]; acts: RowActs; compact: boolean }) {
  const { t, i18n } = useLingui()
  const f = useFormat()
  const columns: Column[] = [
    { name: t`Email`, width: 240, beside: true },
    { name: t`Role`, width: 100, beside: true },
    { name: t`Projects`, width: 130 },
    { name: t`Link works until`, width: 200, beside: true },
    { name: <span className="sr-only">{t`Copy or withdraw`}</span>, width: 200, beside: true },
  ]
  return (
    <Table label={t`Invitations not used yet`} compact={compact} columns={columns}>
      {rows.length === 0 ? (
        <EmptyRow span={shownColumns(columns, compact).length}>
          <Trans>No invitations are waiting to be used.</Trans>
        </EmptyRow>
      ) : (
        rows.map((row) => (
          <tr key={row.membershipId} className="border-b border-border last:border-b-0">
            <Cell title={row.email}>
              <bdi>{row.email}</bdi>
            </Cell>
            <Cell>{roleName(row.role, i18n)}</Cell>
            {compact ? null : (
              <Cell>
                <ProjectsCell projects={row.projects} />
              </Cell>
            )}
            <Cell className="num">{f.date(row.linkWorksUntil)}</Cell>
            <ActsCell>
              <Acts row={row} acts={acts} />
            </ActsCell>
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

/**
 * The page: its header once, whatever the data's state (so the heading and Invite never remount when
 * the rows arrive), then the rows, their loading skeleton, or the API's refusal.
 */
export function MembersView({ session, members, failed, onRetry }: { session: Session; members: Members | undefined; failed?: unknown; onRetry?: () => void }) {
  const f = useFormat()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [inviting, setInviting] = useState(false)
  const [actsOf, setActsOf] = useState<PersonRow | null>(null)
  const actsOpener = useRef<HTMLElement | null>(null)
  const [revoking, setRevoking] = useState<PersonRow | null>(null)
  const [shown, setShown] = useState<{ email: string; link: string; worksUntil: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  // After Revoke or Withdraw, the row's button is gone with its row: focus goes to its section's heading
  // rather than to nowhere (design gate 20a r1).
  const refocus = useRef<string | null>(null)
  useEffect(() => {
    const id = refocus.current
    if (!id || !members) return
    const lost = document.activeElement === null || document.activeElement === document.body
    if (lost) {
      refocus.current = null
      document.getElementById(id)?.focus()
    }
  }, [members])
  const [problem, setProblem] = useState<Problem>(null)
  useSignedInAgain(setProblem)
  const developer = session.developer.name
  const manages = can(session, 'access')

  /**
   * One row's act. Its answer is said, and the rows read again, only while the session is still the one
   * that asked: signed out, switched or someone else meanwhile, the answer belongs to no one on screen.
   */
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
      if (current()) await queryClient.invalidateQueries({ queryKey: membersQuery.queryKey })
    }
  }

  const acts: RowActs = {
    busy,
    act(action, row) {
      const key = `${action}:${row.membershipId}`
      if (action === 'revoke' && row.kind === 'person') return setRevoking(row)
      if (action === 'renew' && row.kind === 'person') {
        const name = row.name
        return void run(key, async (current) => {
          const { expires_at } = await renew(row.membershipId)
          const date = f.date(expires_at)
          if (current()) toast.show({ message: <Trans>{name}’s access now ends on {date}.</Trans> })
        })
      }
      if (action === 'withdraw') {
        refocus.current = 'invitations'
        return void run(key, async (current) => {
          await withdraw(row.membershipId)
          if (current()) toast.show({ message: <Trans>Invitation withdrawn. The link no longer works.</Trans> })
        })
      }
      if (action === 'copy_link' && row.kind === 'invitation') {
        return void run(key, async (current) => {
          const link = await newLink(row.membershipId)
          if (current()) setShown({ email: row.email, link: inviteLink(link.token), worksUntil: link.link_expires_at })
        })
      }
    },
  }

  const revokingName = revoking?.name ?? ''
  const email = shown?.email ?? ''
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
      <ProblemBar problem={problem} className="mb-4" />
      {members ? (
        <div className="flex flex-col gap-6">
          <Section id="people" title={<Trans>People at {developer}</Trans>}>
            <PeopleTable session={session} rows={members.people} acts={acts} compact={actsOf !== null} />
          </Section>
          {manages ? (
            <>
              <Section
                id="vextrus"
                title={<Trans>Vextrus access</Trans>}
                line={
                  // The owner's ruling (29 Sep 2026): the MD can end any Vextrus access, a QS only the access they gave.
                  session.role === 'md' ? (
                    <Trans>Vextrus sees your data only while an invitation below is current. You can end it at any time.</Trans>
                  ) : (
                    <Trans>Vextrus sees your data only while an invitation below is current. You can end the access you gave; your MD can end any.</Trans>
                  )
                }
              >
                <VextrusTable
                  compact={actsOf !== null}
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
                <InvitationsTable rows={members.invitations} acts={acts} compact={actsOf !== null} />
              </Section>
            </>
          ) : null}
        </div>
      ) : failed ? (
        <LoadProblem error={failed} onRetry={() => onRetry?.()} />
      ) : (
        <MembersLoading />
      )}

      {manages ? <InviteDialog session={session} open={inviting} onOpenChange={setInviting} /> : null}

      <Dialog open={revoking !== null} onOpenChange={(open) => (open ? undefined : setRevoking(null))}>
        <DialogContent
          className="sm:max-w-[420px]"
          onCloseAutoFocus={(event) => {
            // Confirmed: the Revoke button goes with its row, so focus goes to the section's heading;
            // cancelled, back to the Revoke button, as a dialog's close does.
            const id = refocus.current
            if (!id) return
            event.preventDefault()
            refocus.current = null
            document.getElementById(id)?.focus()
          }}
        >
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
                if (row) refocus.current = row.role === 'vextrus_engineer' ? 'vextrus' : 'people'
                if (!row) return
                const name = row.name
                void run(`revoke:${row.membershipId}`, async (current) => {
                  await revoke(row.membershipId)
                  if (current()) toast.show({ message: <Trans>{name}’s access has ended.</Trans> })
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
              <Trans>New link for {email}</Trans>
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
  // Out of reach, the query keeps trying and the frame says so, over the skeleton; a refusal or a
  // server fault is said in place.
  const failed = members.error instanceof ApiRefused ? members.error : null
  return <MembersView session={session} members={members.data} failed={failed} onRetry={() => void members.refetch()} />
}
