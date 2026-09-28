/*
 * The frame's watch on the session (docs/design/m0-screens.md §4.1, "States"), mounted once in the frame:
 * - **Signed out while working:** any request refused as signed out opens the dialog "You were signed
 *   out. Sign in again to carry on; nothing you confirmed is lost." over the page, which stays as it
 *   was, typed text included. Signing in again here as the same person carries on where they were; as
 *   someone else, everything held is cleared first and the page is theirs to open.
 * - **Access ended:** any request refused for want of a Developer (a revoked or ended Membership), or
 *   the session read again finding none, sends the user to 4.1's page for it; what the frame held is
 *   cleared once it has gone.
 * - **Another tab** signed in or out, joined or chose a Developer: this tab reads the session again at
 *   once (tabs.ts), as it does whenever it comes back into view and on every move inside the frame
 *   (gate.ts). Signed out, the dialog above; another person or Developer, the frame starts again for
 *   them (`useFrameIdentity`), never drawing the old page with the new session.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Trans } from '@lingui/react/macro'
import { useSuspenseQuery } from '@tanstack/react-query'
import { onSessionEvent } from '@/api/events'
import { PATHS } from '@/app/AppLink'
import { NoDeveloper, meQuery, sessionQuery } from '@/app/session'
import { Skeleton, useToast } from '@/ui'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/ui/primitives/dialog'
import { identityOf, sessionChanged, tookEnteredHere, useEnter, useHeld, type Held } from './actions'
import { gateHref, signInHref } from './gate'
import { SignInForm } from './SignIn'
import { onOtherTabs } from './tabs'

/** The frame starts again for another person or Developer: nothing held stays, and it opens at the projects. */
async function startAgain({ queryClient, router, clearToast }: Held): Promise<void> {
  sessionChanged(queryClient)
  clearToast()
  router.clearCache()
  queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== sessionQuery.queryKey[0] })
  await router.navigate({ href: PATHS.projects })
  router.clearCache()
}

/**
 * Who the frame is showing, in which Developer, or null while it starts again for another: the session
 * read again answered for a different person or Developer (another tab's act, or this tab's own). The
 * frame waits meanwhile (the caller shows its pending state), so no page is drawn with the new session
 * over what the old one held, and a dialog open for the old Developer is gone with it. Another tab's act
 * is said in a toast; this tab's own was the user's doing and needs no word.
 */
export function useFrameIdentity(): string | null {
  const { data: session } = useSuspenseQuery(sessionQuery)
  const held = useHeld()
  const toast = useToast()
  const identity = identityOf(session.user.id, session.developer.id)
  const [shown, setShown] = useState(identity)
  // The latest of each, for the effect below, which runs only when the identity moves.
  const latest = useRef({ session, held, toast, shownUser: session.user.id })
  useLayoutEffect(() => {
    latest.current = { ...latest.current, session, held, toast }
    if (identity === shown) latest.current.shownUser = session.user.id
  })

  useEffect(() => {
    if (identity === shown) return
    const { held, toast, shownUser } = latest.current
    if (tookEnteredHere(held.queryClient, identity)) {
      setShown(identity)
      return
    }
    let live = true
    void startAgain(held)
      .catch(() => undefined)
      .then(() => {
        if (!live) return
        const now = latest.current.session
        const developer = now.developer.name
        const name = now.user.name
        setShown(identity)
        toast.show({
          message: now.user.id === shownUser ? <Trans>Switched to {developer} in another tab.</Trans> : <Trans>Signed in as {name} in another tab.</Trans>,
        })
      })
    return () => {
      live = false
    }
  }, [identity, shown])

  return identity === shown ? identity : null
}

export function SessionWatch() {
  const { data: session, error } = useSuspenseQuery(sessionQuery)
  const held = useHeld()
  const { queryClient, router } = held
  const enter = useEnter()
  const [signedOut, setSignedOut] = useState(false)
  const leaving = useRef(false)

  const leave = useCallback(() => {
    if (leaving.current) return
    leaving.current = true
    const here = router.state.location.pathname + router.state.location.searchStr
    void queryClient
      .fetchQuery(meQuery)
      .then((me) => router.navigate({ href: me ? gateHref(me, here) : signInHref(here) }))
      .then(() => {
        // Gone from the frame: nothing it held stays, neither its rows, its cached pages nor a toast.
        sessionChanged(queryClient)
        held.clearToast()
        router.clearCache()
        queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== meQuery.queryKey[0] })
      })
      .finally(() => {
        leaving.current = false
      })
  }, [held, queryClient, router])

  useEffect(
    () =>
      onSessionEvent((event) => {
        if (event === 'signed-out') {
          setSignedOut(true)
          return
        }
        leave()
      }),
    [leave],
  )

  // Another tab's news: read the session again now.
  useEffect(() => onOtherTabs(queryClient, () => void queryClient.refetchQueries({ queryKey: sessionQuery.queryKey, type: 'active' })), [queryClient])

  // Read again (a move, a tab's news, coming back into view), the session has no Developer to work in.
  useEffect(() => {
    if (error instanceof NoDeveloper) leave()
  }, [error, leave])

  // Read again after the dialog opened, the session answered: signed in again (here or in another tab).
  useEffect(() => {
    if (!signedOut) return
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'success' && event.query.queryKey[0] === sessionQuery.queryKey[0]) setSignedOut(false)
    })
  }, [signedOut, queryClient])

  return (
    <SignedOutDialog
      open={signedOut}
      email={session.user.email}
      onClose={() => setSignedOut(false)}
      onSignedIn={async (out) => {
        if (out.user.id === session.user.id && out.developer_id === session.developer.id) {
          setSignedOut(false)
          await queryClient.invalidateQueries()
          return
        }
        await enter(out)
      }}
    />
  )
}

export function SignedOutDialog({
  open,
  email,
  onClose,
  onSignedIn,
}: {
  open: boolean
  email: string
  onClose: () => void
  onSignedIn: Parameters<typeof SignInForm>[0]['onSignedIn']
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>
            <Trans>You were signed out.</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Sign in again to carry on; nothing you confirmed is lost.</Trans>
          </DialogDescription>
        </DialogHeader>
        <SignInForm initialEmail={email} onSignedIn={onSignedIn} />
      </DialogContent>
    </Dialog>
  )
}

/** First load (§4.1): the top bar's place at once, and below it the page's skeleton. */
export function FramePending() {
  return (
    <div className="flex h-dvh flex-col bg-background">
      <div className="h-topbar shrink-0 border-b border-border bg-chrome" />
      <div className="mx-auto w-[1120px] max-w-full py-6">
        <Skeleton rows={5} status={<Trans>Opening Vextrus…</Trans>} />
      </div>
    </div>
  )
}
