/*
 * An invitation link's page, `/join#<token>` (docs/design/m0-screens.md §4.2, "Invitation link
 * opened"): "Join Shapla Homes Ltd", who invited you as what, to which projects and until when; then
 * what joining needs.
 *
 * The token is read from the fragment only (the browser never sends a fragment, so no server logs it),
 * held in this page's memory, sent only in a POST body, and cleared from the address bar once looked
 * up. It never enters a query string, `?next=`, the router's search, a query key or a log.
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
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Plural, Select, Trans, useLingui } from '@lingui/react/macro'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { ApiRefused, api, unwrap } from '@/api/client'
import { lookUpProjects, type LinkProjectOut, type LookUpOut, type MeOut75 } from '@/api/until75'
import { AppLink, PATHS } from '@/app/AppLink'
import { meFrom, meQuery, type Me } from '@/app/session'
import { useFormat } from '@/format'
import { MachineText, type MachineMessage } from '@/format/machine'
import { Button, ErrorBar, Skeleton, TextField, buttonVariants } from '@/ui'
import { enter, forgetAll, signIn } from './actions'
import { ProjectNameList } from './lists'
import { OutsidePage } from './OutsidePage'
import { ProblemBar, problemOf, type SignInProblem } from './SignIn'

/** What the link's page knows once looked up. */
export interface Invitation {
  link: LookUpOut
  /** Its projects by code and name; empty when it gives every project. */
  projects: readonly LinkProjectOut[]
}

const MAX_TOKEN = 200

/** The token in an address's fragment, or null. */
export function tokenOf(hash: string): string | null {
  const token = hash.replace(/^#/, '').trim()
  return token.length > 0 && token.length <= MAX_TOKEN && !/[\s/?#]/.test(token) ? token : null
}

async function lookUp(token: string): Promise<Invitation> {
  // The generated type of this answer is wrong (until75.ts, LookUpOut).
  const link = (await unwrap(api.POST('/api/invitations/look-up', { body: { token } }))) as unknown as LookUpOut
  const projects = link.project_ids.length > 0 ? await lookUpProjects(token) : []
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
  const as = <Select value={role} _qs="QS" _md="MD" _guest="a Guest" _vextrus_engineer="a Vextrus Engineer" other="a member" />
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
type Stage = { at: 'reading' } | { at: 'unusable' } | { at: 'unreachable' } | { at: 'ready'; invitation: Invitation; token: string }

export function JoinPage() {
  const { t } = useLingui()
  const router = useRouter()
  const queryClient = useQueryClient()
  // Read once, from the fragment, and held only here.
  const [token] = useState(() => tokenOf(router.state.location.hash))
  const [stage, setStage] = useState<Stage>(() => (token ? { at: 'reading' } : { at: 'unusable' }))
  const [me, setMe] = useState<Me | null | undefined>(undefined)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const clear = () => router.history.replace(PATHS.join)
    void queryClient
      .fetchQuery({ ...meQuery, retry: false })
      .then(setMe)
      .catch(() => setMe(null))
    if (!token) {
      clear()
      return
    }
    lookUp(token)
      .then((invitation) => setStage({ at: 'ready', invitation, token }))
      .catch((error: unknown) => setStage(error instanceof ApiRefused ? { at: 'unusable' } : { at: 'unreachable' }))
      .finally(clear)
  }, [router, queryClient, token])

  const developer = stage.at === 'ready' ? stage.invitation.link.developer_name : ''
  return (
    <OutsidePage title={stage.at === 'ready' ? t`Join ${developer}` : t`Invitation`} wide>
      {stage.at === 'reading' || me === undefined ? (
        <Skeleton rows={3} status={<Trans>Opening the invitation…</Trans>} />
      ) : stage.at === 'unusable' ? (
        <Unusable />
      ) : stage.at === 'unreachable' ? (
        <ProblemBar problem={{ unreachable: true }} />
      ) : (
        <Ready
          invitation={stage.invitation}
          me={me}
          token={stage.token}
          onSignedIn={setMe}
          onSignedOut={() => setMe(null)}
          onJoined={(out) => enter(queryClient, router, out)}
          onSignOut={() => signOutHere(queryClient)}
        />
      )}
    </OutsidePage>
  )
}

/** Signs out without leaving the page, which keeps the token it holds. */
async function signOutHere(queryClient: ReturnType<typeof useQueryClient>): Promise<void> {
  try {
    await unwrap(api.POST('/api/auth/sign-out'))
  } catch (error) {
    if (!(error instanceof ApiRefused && error.status === 401)) throw error
  }
  await forgetAll(queryClient)
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
  onJoined: (out: MeOut75) => Promise<unknown>
  onSignOut: () => Promise<void>
}) {
  const { t } = useLingui()
  const { link, projects } = invitation
  const developer = link.developer_name
  const [refusal, setRefusal] = useState<MachineMessage | null>(null)
  const [problem, setProblem] = useState<SignInProblem>(null)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [fieldError, setFieldError] = useState<{ name?: MachineMessage | string; password?: MachineMessage | string }>({})
  const nameRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

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
      const out = (await unwrap(api.POST('/api/invitations/accept', { body }))) as MeOut75
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
          <InvitedLine invitation={invitation} />
          {link.role === 'guest' ? (
            <>
              {' '}
              <GuestLine projects={projects.length} />
            </>
          ) : null}
        </p>
      </div>

      {other ? (
        <>
          <ErrorBar>
            <MachineText message={{ code: 'platform.invitations.wrong_account', params: { email: link.email } }} />
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
        <p className="text-sm text-foreground">
          <MachineText message={{ code: 'platform.invitations.engineer_not_staff', params: {} }} />
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
              <MachineText message={refusal} />
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

