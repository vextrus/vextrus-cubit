/*
 * Desktop only (docs/design/m0-screens.md §1.5; ADR 0016): the QS screens need 1280 px. Under
 * 640 px every screen after sign-in is replaced by the phone notice; from 640 to 1279 px the page
 * keeps its 1280 px layout and scrolls sideways, with the narrow notice above it. Sign-in does not
 * use this wrapper: it works at any width.
 */
import { useSyncExternalStore, type ReactNode } from 'react'
import { Trans } from '@lingui/react/macro'
import { BrandMark } from './glyphs'
import { Button } from './Button'
import { cn } from './cn'

/** The widths m0-screens §1.5 sets. */
export const PHONE_BELOW_PX = 640
export const DESKTOP_FROM_PX = 1280

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (listener) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', listener)
      return () => list.removeEventListener('change', listener)
    },
    () => window.matchMedia(query).matches,
  )
}

/** "Vextrus needs a desktop": fills its container (the whole screen under 640 px). */
export function PhoneNotice({ onSignOut, className }: { onSignOut?: () => void; className?: string }) {
  const width = DESKTOP_FROM_PX
  return (
    <main className={cn('flex min-h-full flex-col items-center justify-center gap-4 bg-background px-8 py-12 text-center', className)}>
      <BrandMark size={32} />
      <h1 className="text-xl">
        <Trans>Vextrus needs a desktop</Trans>
      </h1>
      <p className="max-w-[34ch] text-md text-ink-secondary">
        <Trans>Open it on a screen {width} px wide or more. Your work is saved; nothing is lost.</Trans>
      </p>
      {onSignOut ? (
        <Button variant="ghost" onClick={onSignOut} className="text-ink-link underline underline-offset-2">
          <Trans>Sign out</Trans>
        </Button>
      ) : null}
    </main>
  )
}

/** The 28 px bar above a page seen at 640–1279 px. */
export function NarrowNotice({ className }: { className?: string }) {
  const width = DESKTOP_FROM_PX
  return (
    <div role="note" className={cn('flex h-notice-bar items-center border-b border-border bg-question-surface px-3 text-xs text-foreground', className)}>
      <Trans>This screen is built for {width} px or wider. Some of it may be cut off; scroll sideways to see it.</Trans>
    </div>
  )
}

export function DesktopOnly({ children, onSignOut }: { children: ReactNode; onSignOut?: () => void }) {
  const phone = useMedia(`(max-width: ${PHONE_BELOW_PX - 1}px)`)
  const narrow = useMedia(`(max-width: ${DESKTOP_FROM_PX - 1}px)`)
  if (phone) return <PhoneNotice onSignOut={onSignOut} className="min-h-dvh" />
  if (!narrow) return <>{children}</>
  return (
    <>
      <NarrowNotice className="sticky start-0 top-0 z-(--z-sticky) w-dvw" />
      <div className="min-w-[1280px]">{children}</div>
    </>
  )
}
