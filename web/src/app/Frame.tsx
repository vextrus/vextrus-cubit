/*
 * The app frame (docs/design/m0-screens.md §4.1): one frame every screen after sign-in sits in, so the
 * chrome never moves between screens and later tickets only fill regions. It holds the session's
 * Market for the formatters, the page's language from the Market's language data (§1.8, §1.9), the
 * top bar, the ErrorBar when Vextrus can't be reached, the phone and narrow notices (§1.5) and the
 * shell's keys; below the top bar, a page screen (PageLayout) or a canvas screen (CanvasFrame).
 */
import { useLayoutEffect, useSyncExternalStore, type ReactNode } from 'react'
import { Trans } from '@lingui/react/macro'
import { i18n } from '@lingui/core'
import { onlineManager, useQueryClient, useSuspenseQuery, type Query, type QueryClient } from '@tanstack/react-query'
import { useParams, useRouterState } from '@tanstack/react-router'
import { SearchX } from 'lucide-react'
import { FormatProvider, type MarketFormat } from '@/format'
import { activateLanguage, currentLanguage, useLanguage } from '@/i18n/activate'
import { englishMessages } from '@/i18n/catalogues'
import { DesktopOnly, Empty, ErrorBar, buttonVariants, cn } from '@/ui'
import { AppLink, PATHS, useGo } from './AppLink'
import { languageIsOverridden } from './dev-language'
import { projectFor, sessionQuery } from './session'
import { ShellProvider } from './shell'
import { SlotsProvider } from './slots'
import { TopBar } from './TopBar'

/**
 * The page's language comes from the Market's language data (English, left to right), and Lingui
 * formats a plural's count with the locale the Market's language borrows, so "#" groups as the Market
 * groups. A development-only `?lang=` (the test-only pseudo language) wins over the Market.
 */
function useMarketLanguage(market: MarketFormat) {
  const language = useLanguage()
  useLayoutEffect(() => {
    if (!languageIsOverridden() && currentLanguage().code !== market.language.code) {
      activateLanguage(market.language, englishMessages())
      return
    }
    i18n.activate(language.code, [market.locale])
  }, [language, market])
}

/** Failed tries in a row before the ErrorBar shows (the policy keeps trying after it does). */
const UNREACHABLE_AFTER = 2

function isNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError
}

/** A query whose last try could not reach the server: it failed for good, or is still being tried. */
function cannotReach(state: Query['state']): boolean {
  if (state.status === 'error') return isNetworkFailure(state.error)
  return state.fetchFailureCount >= UNREACHABLE_AFTER && isNetworkFailure(state.fetchFailureReason)
}

function unreachable(client: QueryClient): boolean {
  if (!onlineManager.isOnline()) return true
  return client.getQueryCache().getAll().some((q) => cannotReach(q.state))
}

/** True while the browser is offline or the last try of any query failed to reach the server. */
export function useUnreachable(): boolean {
  const client = useQueryClient()
  return useSyncExternalStore(
    (listener) => {
      const offOnline = onlineManager.subscribe(listener)
      const offCache = client.getQueryCache().subscribe(listener)
      return () => {
        offOnline()
        offCache()
      }
    },
    () => unreachable(client),
  )
}

function Unreachable() {
  if (!useUnreachable()) return null
  return (
    <ErrorBar className="shrink-0">
      <Trans>Vextrus can’t be reached. Check your connection; this page keeps trying.</Trans>
    </ErrorBar>
  )
}

export function AppFrame({ children }: { children: ReactNode }) {
  const { data: session } = useSuspenseQuery(sessionQuery)
  const { code } = useParams({ strict: false }) as { code?: string }
  const project = code ? projectFor(session, code) : undefined
  const go = useGo()
  useMarketLanguage(session.market)
  return (
    <FormatProvider profile={session.market} unitSystem={project?.unitSystem}>
      <SlotsProvider>
        <ShellProvider session={session} project={project}>
          <DesktopOnly onSignOut={() => go(PATHS.signIn)}>
            <div data-frame="" className="flex h-dvh flex-col bg-background max-[1279px]:h-[calc(100dvh-var(--notice-bar))]">
              <TopBar session={session} project={project} />
              <Unreachable />
              <div className="flex min-h-0 flex-1 flex-col">{children}</div>
            </div>
          </DesktopOnly>
        </ShellProvider>
      </SlotsProvider>
    </FormatProvider>
  )
}

/**
 * A page screen's body (projects, members, the Drawing Set; §4.1): content 1120 px wide, centred
 * (160 px each side at 1440, 80 at 1280), on the grey background; a docked panel (the Drawing Set's
 * report, 480 px) pushes the content towards the start instead of covering it.
 */
export function PageLayout({ children, panel }: { children: ReactNode; panel?: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1">
      <main data-region="page" className="focus-inset min-w-0 flex-1 overflow-auto">
        {/* A docked panel pushes the content left, keeping a 24 px gutter each side (design gate 20a r1);
            with none, the page is as it was: 1120 px, centred. */}
        <div className={cn('mx-auto max-w-full py-6', panel ? 'w-[1168px] px-[24px]' : 'w-[1120px]')}>{children}</div>
      </main>
      {panel ? (
        <aside data-region="panel" className="focus-inset w-[480px] shrink-0 overflow-auto border-s border-border bg-paper">
          {panel}
        </aside>
      ) : null}
    </div>
  )
}

/**
 * "Page not found" (§4.1): for an address with nothing at it, and for another Developer's project or
 * one the member was not given, so a project's existence never leaks (docs/plans/M0.md, "Project scope").
 */
export function NotFound() {
  // Until 20a builds /projects, "Your projects" would lead back to this same page: no action there.
  const here = useRouterState({ select: (s) => s.location.pathname })
  const action =
    here === PATHS.projects ? undefined : (
      <AppLink to={PATHS.projects} className={buttonVariants({ variant: 'primary' })}>
        <Trans>Your projects</Trans>
      </AppLink>
    )
  return (
    <PageLayout>
      <Empty glyph={<SearchX />} action={action}>
        <Trans>
          There is nothing at this address. It may have been a link to another Developer’s project, or to a project you have not been given.
        </Trans>
      </Empty>
    </PageLayout>
  )
}
