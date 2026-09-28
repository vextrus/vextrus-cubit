/*
 * The frame's watch on the session (docs/design/m0-screens.md §4.1, "States"), mounted once in the frame:
 * - **Signed out while working:** any request refused as signed out opens the dialog "You were signed
 *   out. Sign in again to carry on; nothing you confirmed is lost." over the page, which stays as it
 *   was, typed text included. Signing in again here as the same person carries on where they were; as
 *   someone else, everything held is cleared first and the page is theirs to open.
 * - **Access ended:** any request refused for want of a Developer (a revoked or ended Membership) sends
 *   the user to 4.1's page for it; what the frame held is cleared once it has gone.
 */
import { useEffect, useRef, useState } from 'react'
import { Trans } from '@lingui/react/macro'
import { useSuspenseQuery } from '@tanstack/react-query'
import { onSessionEvent } from '@/api/events'
import { meQuery, sessionQuery } from '@/app/session'
import { Skeleton } from '@/ui'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/ui/primitives/dialog'
import { useEnter, useHeld } from './actions'
import { gateHref, signInHref } from './gate'
import { SignInForm } from './SignIn'

export function SessionWatch() {
  const { data: session } = useSuspenseQuery(sessionQuery)
  const held = useHeld()
  const { queryClient, router } = held
  const enter = useEnter()
  const [signedOut, setSignedOut] = useState(false)
  const leaving = useRef(false)

  useEffect(
    () =>
      onSessionEvent((event) => {
        if (event === 'signed-out') {
          setSignedOut(true)
          return
        }
        if (leaving.current) return
        leaving.current = true
        const here = router.state.location.pathname + router.state.location.searchStr
        void queryClient
          .fetchQuery(meQuery)
          .then((me) => router.navigate({ href: me ? gateHref(me, here) : signInHref(here) }))
          .then(() => {
            // Gone from the frame: nothing it held stays, neither its rows, its cached pages nor a toast.
            held.clearToast()
            router.clearCache()
            queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== meQuery.queryKey[0] })
          })
          .finally(() => {
            leaving.current = false
          })
      }),
    [held, queryClient, router],
  )

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
