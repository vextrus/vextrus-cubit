/*
 * An invitation link's page, `/join#<token>` (docs/design/m0-screens.md §4.2, "Invitation link
 * opened"): "Join Shapla Homes Ltd", who invited you as what, to which projects and until when; then
 * what joining needs.
 *
 * The token is read from the fragment only (the browser never sends a fragment, so no server logs it),
 * held in this page's memory, sent only in a POST body, and cleared from the address bar once looked
 * up. It never enters a query string, `?next=`, the router's search, a query key or a log. A new link
 * pasted into the open page (only the fragment changes, so nothing reloads) is looked up in its turn.
 *
 * - Signed in as the invited email: [Join].
 * - Signed in as someone else: the API's `wrong_account` words and [Sign out], after which the page
 *   carries on with the token it holds.
 * - Signed out, the email has an account: its password here, then Join (sign in, then accept).
 * - Signed out, no account: Name and a Password ("At least 12 characters"), then Join; a Vextrus
 *   Engineer's invitation instead shows `engineer_not_staff`'s words and no form (only a Vextrus
 *   account can take it).
 * - A guessed, used, withdrawn or expired link: "This invitation can no longer be used. Ask whoever
 *   sent it for a new one." (it names no Developer: the owner's ruling, 28 Sep 2026); so does `/join`
 *   with no token.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Plural, Select, Trans, useLingui } from '@lingui/react/macro'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter, useRouterState } from '@tanstack/react-router'
import { ApiRefused, api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'
import { AppLink, PATHS } from '@/app/AppLink'
import { marketFormat, meFrom, meQuery, type Me } from '@/app/session'
import { useFormat } from '@/format'
import { MachineText, type MachineMessage } from '@/format/machine'
import { Button, ErrorBar, Skeleton, TextField, buttonVariants } from '@/ui'
import { forgetAll, signIn, useEnter, useHeld, type Held } from './actions'
import { InMarket } from './AccessEnded'
import { ProjectNameList } from './lists'
import { OutsidePage } from './OutsidePage'
import { ProblemBar, problemOf, type Problem } from './problem'

/** What the link's page knows once looked up. */
export interface Invitation {
  link: components['schemas']['InvitationLookUpOut']
  /** Its projects by code and name; empty when it gives every project. */
  projects: readonly components['schemas']['InvitationProjectOut'][]
}

const MAX_TOKEN = 200

/** The token in an address's fragment, or null. */
export function tokenOf(hash: string): string | null {
  const token = hash.replace(/^#/, '').trim()
  return token.length > 0 && token.length <= MAX_TOKEN && !/[\s/?#]/.test(token) ? token : null
}

async function lookUp(token: string): Promise<Invitation> {
  const link = await unwrap(api.POST('/api/invitations/look-up', { body: { token } }))
  const projects = link.project_ids.length > 0 ? await unwrap(api.POST('/api/invitations/look-up/projects', { body: { token } })) : []
  return { link, projects }
}

/** "Kamal Uddin invited you as a Guest to KR-01 Kadam Residence until 26 Oct 2026." */
export function InvitedLine({ invitation }: { invitation: Invitation }) {
  const f = useFormat()
  const { link, projects } = invitation
  const inviter = link.invited_by ?? ''
  const role = link.role
  const date = link.expires_at ? f.date(link.expires_at) : ''
  const list = projects.length > 0 ? <ProjectNameList projects={projects} /> : null
  const as = <Select value={role} _qs="a QS" _md="an MD" _guest="a Guest" _vextrus_engineer="a Vextrus Engineer" other="a member" />
  if (link.invited_by) {
    if (list && date) return <Trans>{inviter} invited you as {as} to {list} until {date}.</Trans>
    if (list) return <Trans>{inviter} invited you as {as} to {list}.</Trans>
    if (date) return <Trans>{inviter} invited you as {as} until {date}.</Trans>
    return <Trans>{inviter} invited you as {as}.</Trans>
  }
  if (list && date) return <Trans>You were invited as {as} to {list} until {date}.</Trans>
  if (list) return <Trans>You were invited as {as} to {list}.</Trans>
  if (date) return <Trans>You were invited as {as} until {date}.</Trans>
  return <Trans>You were invited as {as}.</Trans>
}

/** The Guest's second sentence: what a Guest may do there. */
export function GuestLine({ projects }: { projects: number }) {
  if (projects === 0) return <Trans>You can look at the drawings and Takeoff of every project but not change them.</Trans>
  return (
    <Plural
      value={projects}
      one="You can look at its drawings and Takeoff but not change them."
      other="You can look at their drawings and Takeoff but not change them."
    />
  )
}

/** The page's stage; the token lives only here, in memory, once read from the fragment. */
type Stage = { at: 'reading' } | { at: 'unusable' } | { at: 'failed'; problem: Problem } | { at: 'ready'; invitation: Invitation; token: string }

export function JoinPage() {
  const { t } = useLingui()
  const router = useRouter()
  const queryClient = useQueryClient()
  const held = useHeld()
  const enter = useEnter()
  // Read from the fragment, and held only here.
  const hash = useRouterState({ select: (s) => s.location.hash })
  const [token, setToken] = useState(() => tokenOf(hash))
  const [stage, setStage] = useState<Stage>(() => (token ? { at: 'reading' } : { at: 'unusable' }))
  const [me, setMe] = useState<Me | null | undefined>(undefined)
  const asked = useRef(false)

  // Another link pasted into this open page: only the fragment changes, and nothing reloads.
  const pasted = tokenOf(hash)
  if (pasted && pasted !== token) {
    setToken(pasted)
    setStage({ at: 'reading' })
  }

  useEffect(() => {
    if (asked.current) return
    asked.current = true
    void queryClient
      .fetchQuery({ ...meQuery, retry: false })
      .then(setMe)
      .catch(() => setMe(null))
  }, [queryClient])

  useEffect(() => {
    let current = true
    const clear = () => {
      if (current) router.history.replace(PATHS.join)
    }
    if (!token) {
      clear()
      return
    }
    // The address is cleared once the look-up has answered for good: the link found, or "not found".
    // Out of reach, refused for another reason (a stale page's CSRF) or failed, it stays, so the reload
    // the words ask for opens the same link (the fragment never reaches a server).
    lookUp(token)
      .then((invitation) => {
        if (!current) return
        clear()
        setStage({ at: 'ready', invitation, token })
      })
      .catch((error: unknown) => {
        if (!current) return
        if (error instanceof ApiRefused && error.status === 404) {
          clear()
          setStage({ at: 'unusable' })
        } else setStage({ at: 'failed', problem: problemOf(error) })
      })
    return () => {
      current = false
    }
  }, [router, token])

  const developer = stage.at === 'ready' ? stage.invitation.link.developer_name : ''
  return (
    <OutsidePage title={stage.at === 'ready' ? t`Join ${developer}` : t`Invitation`} wide>
      {stage.at === 'reading' || me === undefined ? (
        <Skeleton rows={3} status={<Trans>Opening the invitation…</Trans>} />
      ) : stage.at === 'unusable' ? (
        <Unusable />
      ) : stage.at === 'failed' ? (
        // The link is still in the address (the look-up never answered for good): a reload opens it again.
        <ProblemBar
          problem={stage.problem}
          action={
            <Button onClick={() => window.location.reload()}>
              <Trans>Try again</Trans>
            </Button>
          }
        />
      ) : (
        <Ready
          invitation={stage.invitation}
          me={me}
          token={stage.token}
          onSignedIn={setMe}
          onSignedOut={() => setMe(null)}
          onJoined={(out) => enter(out)}
          onSignOut={() => signOutHere(held)}
        />
      )}
    </OutsidePage>
  )
}

/** Signs out without leaving the page, which keeps the token it holds. */
async function signOutHere(held: Held): Promise<void> {
  try {
    await unwrap(api.POST('/api/auth/sign-out'))
  } catch (error) {
    if (!(error instanceof ApiRefused && error.status === 401)) throw error
  }
  await forgetAll(held)
}

function Unusable() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-foreground">
        <Trans>This invitation can no longer be used. Ask whoever sent it for a new one.</Trans>
      </p>
      <AppLink to={PATHS.signIn} className={buttonVariants({ variant: 'secondary', className: 'self-start' })}>
        <Trans>Sign in</Trans>
      </AppLink>
    </div>
  )
}

function Ready({
  invitation,
  me,
  token,
  onSignedIn,
  onSignedOut,
  onJoined,
  onSignOut,
}: {
  invitation: Invitation
  me: Me | null
  token: string
  onSignedIn: (me: Me) => void
  onSignedOut: () => void
  onJoined: (out: components['schemas']['MeOut']) => Promise<unknown>
  onSignOut: () => Promise<void>
}) {
  const { t } = useLingui()
  const { link } = invitation
  const developer = link.developer_name
  // The inviting Developer's Market words the line's date (the orchestrator's ruling, 29 Sep 2026).
  const market = useMemo(() => marketFormat(link.market), [link.market])
  const [refusal, setRefusal] = useState<MachineMessage | null>(null)
  const [problem, setProblem] = useState<Problem>(null)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [fieldError, setFieldError] = useState<{ name?: MachineMessage | string; password?: MachineMessage | string }>({})
  const nameRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const email = link.email
  const mine = me !== null && me.user.email.toLowerCase() === link.email.toLowerCase()
  const other = me !== null && !mine
  const newAccount = me === null && !link.has_account
  const engineerWithoutAccount = newAccount && link.role === 'vextrus_engineer'

  async function join(event?: FormEvent) {
    event?.preventDefault()
    if (busy) return
    setRefusal(null)
    setProblem(null)
    setFieldError({})
    if (me === null && link.has_account && password === '') {
      setFieldError({ password: t`Enter your password.` })
      return passwordRef.current?.focus()
    }
    if (newAccount && name.trim() === '') {
      setFieldError({ name: t`Enter your name.` })
      return nameRef.current?.focus()
    }
    if (newAccount && password === '') {
      setFieldError({ password: t`Enter your password.` })
      return passwordRef.current?.focus()
    }
    setBusy(true)
    try {
      // Signed in first, the page is the signed-in one if accepting then fails (and is not asked again).
      if (me === null && link.has_account) onSignedIn(meFrom(await signIn(link.email, password)))
      // A name and password make a new account; for an existing one they are left empty, as the API's defaults.
      const body = newAccount ? { token, name, password } : { token, name: '', password: '' }
      const out = await unwrap(api.POST('/api/invitations/accept', { body }))
      await onJoined(out)
    } catch (error) {
      setBusy(false)
      if (error instanceof ApiRefused && error.refusal) {
        const code = error.refusal.code
        if (code === 'platform.invitations.name_required') setFieldError({ name: error.refusal })
        else if (code.startsWith('platform.auth.password_')) setFieldError({ password: error.refusal })
        else if (code === 'platform.auth.wrong_credentials') {
          setRefusal(error.refusal)
          passwordRef.current?.focus()
        } else setRefusal(error.refusal)
        return
      }
      setProblem(problemOf(error))
    }
  }

  const words = (value: MachineMessage | string | undefined) => (typeof value === 'string' ? value : value ? <MachineText message={value} /> : undefined)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl">
          <Trans>Join {developer}</Trans>
        </h1>
        <p className="text-sm text-foreground">
          <InMarket market={market}>
            <InvitedLine invitation={invitation} />
          </InMarket>
          {link.role === 'guest' ? (
            <>
              {' '}
              <GuestLine projects={link.project_ids.length} />
            </>
          ) : null}
        </p>
      </div>

      {other ? (
        <>
          {/* 20a's words, not 07's `wrong_account`: this page keeps the link, so after signing out the
              invited person signs in right here, with no need to open the link again. */}
          <ErrorBar>
            <Trans>
              This invitation is for {email}. Sign out, then sign in here as {email} to join.
            </Trans>
          </ErrorBar>
          <Button
            variant="secondary"
            className="self-start"
            onClick={() =>
              void onSignOut()
                .then(onSignedOut)
                .catch((error: unknown) => setProblem(problemOf(error)))
            }
          >
            <Trans>Sign out</Trans>
          </Button>
          <ProblemBar problem={problem} />
        </>
      ) : engineerWithoutAccount ? (
        // 20a's words, not 07's `engineer_not_staff` ("Sign in with yours"): this email has no account,
        // and signing in with another would be refused as the wrong account.
        <p className="text-sm text-foreground">
          <Trans>
            This invitation is for a Vextrus Engineer, but {email} has no Vextrus account. Ask whoever sent it to invite your Vextrus email, or to invite you in another
            role.
          </Trans>
        </p>
      ) : (
        <form noValidate onSubmit={(event) => void join(event)} className="flex flex-col gap-3">
          {me === null ? <TextField label={t`Email`} type="email" value={link.email} readOnly autoComplete="username" size="lg" /> : null}
          {newAccount ? (
            <TextField
              ref={nameRef}
              label={t`Name`}
              autoComplete="name"
              size="lg"
              value={name}
              readOnly={busy}
              onChange={(event) => setName(event.currentTarget.value)}
              error={words(fieldError.name)}
            />
          ) : null}
          {me === null ? (
            <TextField
              ref={passwordRef}
              label={t`Password`}
              type="password"
              autoComplete={newAccount ? 'new-password' : 'current-password'}
              size="lg"
              value={password}
              readOnly={busy}
              onChange={(event) => setPassword(event.currentTarget.value)}
              hint={newAccount && !fieldError.password ? t`At least 12 characters` : undefined}
              error={words(fieldError.password)}
            />
          ) : null}
          {refusal ? (
            <ErrorBar>
              {refusal.code === 'platform.auth.csrf_failed' ? (
                // Not the API's "Reload it": the link has left the address bar, so a reload would lose it.
                <Trans>This page is out of date. Open the invitation link again from the message it came in.</Trans>
              ) : (
                <MachineText message={refusal} />
              )}
            </ErrorBar>
          ) : null}
          <ProblemBar problem={problem} />
          <Button type="submit" variant="primary" size="lg" saving={busy} className="w-full">
            {busy ? <Trans>Joining…</Trans> : <Trans>Join</Trans>}
          </Button>
        </form>
      )}
    </div>
  )
}

