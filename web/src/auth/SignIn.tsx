/*
 * Sign-in (docs/design/m0-screens.md §4.2; story 1; wireframes `sign-in-*.svg`): a 360 px card with
 * the brand, "Sign in", Email, Password, the full-width primary "Sign in" and the line about a
 * forgotten password. Enter submits; Tab runs Email → Password → Sign in.
 *
 * An empty field is refused under it; a wrong email or password in an ErrorBar above the button, in
 * the API's words, which never say which was wrong. While signing in the button shows its spinner and
 * "Signing in…" and the fields are locked. Then: one Membership, the projects (or the address the
 * user was sent from, `?next=`); several, "Which Developer?"; none current, 4.1's page for it.
 */
import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useSearch } from '@tanstack/react-router'
import { Button, TextField } from '@/ui'
import { signIn, useEnter } from './actions'
import { OutsidePage } from './OutsidePage'
import { ProblemBar, problemOf, type Problem } from './problem'

export { ProblemBar, problemOf, type Problem as SignInProblem } from './problem'

/** Email and password; `onSignedIn` gets `/api/me` from the API. Used by the page and the Signed-out dialog. */
export function SignInForm({
  initialEmail = '',
  onSignedIn,
  submitLabel,
}: {
  initialEmail?: string
  onSignedIn: (out: Awaited<ReturnType<typeof signIn>>) => Promise<unknown>
  submitLabel?: ReactNode
}) {
  const { t } = useLingui()
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [missing, setMissing] = useState<{ email: boolean; password: boolean }>({ email: false, password: false })
  const [problem, setProblem] = useState<Problem>(null)
  const [busy, setBusy] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const now = { email: email.trim() === '', password: password === '' }
    setMissing(now)
    setProblem(null)
    if (now.email) return emailRef.current?.focus()
    if (now.password) return passwordRef.current?.focus()
    setBusy(true)
    try {
      await onSignedIn(await signIn(email, password))
    } catch (error) {
      setProblem(problemOf(error))
      setBusy(false)
      passwordRef.current?.focus()
    }
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
      <TextField
        ref={emailRef}
        label={t`Email`}
        type="email"
        name="email"
        autoComplete="username"
        size="lg"
        value={email}
        readOnly={busy}
        onChange={(event) => setEmail(event.currentTarget.value)}
        error={missing.email ? t`Enter your email.` : undefined}
      />
      <TextField
        ref={passwordRef}
        label={t`Password`}
        type="password"
        name="password"
        autoComplete="current-password"
        size="lg"
        value={password}
        readOnly={busy}
        onChange={(event) => setPassword(event.currentTarget.value)}
        error={missing.password ? t`Enter your password.` : undefined}
      />
      <ProblemBar problem={problem} />
      <Button type="submit" variant="primary" size="lg" saving={busy} className="w-full">
        {busy ? <Trans>Signing in…</Trans> : (submitLabel ?? <Trans>Sign in</Trans>)}
      </Button>
    </form>
  )
}

export function SignInPage() {
  const { t } = useLingui()
  const enter = useEnter()
  const { next } = useSearch({ strict: false }) as { next?: string }
  return (
    <OutsidePage title={t`Sign in`}>
      <h1 className="mb-4 text-xl">
        <Trans>Sign in</Trans>
      </h1>
      <SignInForm onSignedIn={(out) => enter(out, next)} />
      <p className="mt-4 text-xs text-muted-foreground">
        <Trans>Forgot your password? Ask your MD, or Vextrus, to set a new one.</Trans>
      </p>
    </OutsidePage>
  )
}
