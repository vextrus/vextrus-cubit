/*
 * "Access ended" and "No access to anything" (docs/design/m0-screens.md §4.1, "States"): full pages
 * outside the frame. Access ended names the Developer, and the projects when the access was to chosen
 * ones; who revoked it and when, or the day it ended by its date; that what the person did is kept;
 * [Choose another Developer] only when another Membership is current, and [Sign out].
 */
import { useState, type ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { endedAccessProjects } from '@/api/until75'
import { AppLink, PATHS } from '@/app/AppLink'
import { gateOf, meQuery, type EndedAccess } from '@/app/session'
import { FormatProvider, useFormat, type MarketFormat } from '@/format'
import { Button, SkeletonBar, buttonVariants } from '@/ui'
import { useSignOut } from './actions'
import { CodeList } from './lists'
import { OutsidePage } from './OutsidePage'
import { ProblemBar, problemOf, type SignInProblem } from './SignIn'

/** A scoped Membership's project codes, from #75's `/api/ended-access/projects`. */
export const endedProjectsQuery = {
  queryKey: ['ended-access-projects'] as const,
  queryFn: endedAccessProjects,
  staleTime: Infinity,
}

/** 4.1's sentence for an ended access; `codes` names its projects, or null for every project. */
export function EndedWords({ ended, codes }: { ended: EndedAccess; codes: readonly string[] | null }) {
  const f = useFormat()
  const developer = ended.developer.name
  const date = f.date(ended.endedAt)
  const revoker = ended.revokedBy ?? ''
  const list = codes && codes.length > 0 ? <CodeList codes={codes} /> : null
  if (ended.how === 'expired') {
    return list ? (
      <Trans>
        Your access to {list} at {developer} ended on {date}. Ask {developer} to renew it.
      </Trans>
    ) : (
      <Trans>
        Your access to {developer} ended on {date}. Ask {developer} to renew it.
      </Trans>
    )
  }
  if (ended.revokedBy) {
    return list ? (
      <Trans>
        Your access to {list} at {developer} has ended. {revoker} revoked it on {date}. What you did before then is kept under your name.
      </Trans>
    ) : (
      <Trans>
        Your access to {developer} has ended. {revoker} revoked it on {date}. What you did before then is kept under your name.
      </Trans>
    )
  }
  return list ? (
    <Trans>
      Your access to {list} at {developer} was ended on {date}. What you did before then is kept under your name.
    </Trans>
  ) : (
    <Trans>
      Your access to {developer} was ended on {date}. What you did before then is kept under your name.
    </Trans>
  )
}

function Actions({ another }: { another: boolean }) {
  const signOut = useSignOut()
  const [problem, setProblem] = useState<SignInProblem>(null)
  return (
    <div className="mt-5 flex flex-col gap-3">
      <ProblemBar problem={problem} />
      <div className="flex flex-wrap gap-2">
        {another ? (
          <AppLink to={PATHS.chooseDeveloper} className={buttonVariants({ variant: 'primary' })}>
            <Trans>Choose another Developer</Trans>
          </AppLink>
        ) : null}
        <Button variant={another ? 'secondary' : 'primary'} onClick={() => void signOut().catch((error: unknown) => setProblem(problemOf(error)))}>
          <Trans>Sign out</Trans>
        </Button>
      </div>
    </div>
  )
}

/**
 * The Developer's own Market for a page outside the frame (the orchestrator's ruling, 29 Sep 2026):
 * its locale and time zone for every date, never the browser's. Only an API before #75 sends none.
 */
export function InMarket({ market, children }: { market: MarketFormat | null; children: ReactNode }) {
  return market ? <FormatProvider profile={market}>{children}</FormatProvider> : <>{children}</>
}

function Sentence({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-foreground">{children}</p>
}

export function AccessEndedPage() {
  const { t } = useLingui()
  const { data: me } = useSuspenseQuery(meQuery)
  const gate = me ? gateOf(me) : null
  const ended = gate?.to === 'ended' ? gate.ended : null
  const scoped = (ended?.projectIds.length ?? 0) > 0
  const projects = useQuery({ ...endedProjectsQuery, enabled: scoped })
  const codes = scoped ? (projects.data?.find((p) => p.membership_id === ended?.membershipId)?.codes ?? null) : null
  return (
    <OutsidePage title={t`Access ended`} wide>
      {ended ? (
        <>
          <h1 className="mb-3 text-xl">
            <Trans>Access ended</Trans>
          </h1>
          {scoped && projects.isPending ? (
            <SkeletonBar className="h-4 w-[80%]" />
          ) : (
            <InMarket market={ended.market}>
              <Sentence>
                <EndedWords ended={ended} codes={codes} />
              </Sentence>
            </InMarket>
          )}
          <Actions another={(me?.memberships.length ?? 0) > 0} />
        </>
      ) : null}
    </OutsidePage>
  )
}

export function NoAccessPage() {
  const { t } = useLingui()
  return (
    <OutsidePage title={t`No access`} wide>
      <h1 className="mb-3 text-xl">
        <Trans>No access</Trans>
      </h1>
      <Sentence>
        <Trans>You have no access to any Developer at the moment. Ask your MD, or Vextrus, for an invitation.</Trans>
      </Sentence>
      <Actions another={false} />
    </OutsidePage>
  )
}
