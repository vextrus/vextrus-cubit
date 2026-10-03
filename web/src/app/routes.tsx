/*
 * The components src/routes/ mounts (routes hold no words: eslint.config.js). Each reads its route's
 * data and hands it to the frame's pieces.
 */
import { Trans } from '@lingui/react/macro'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Outlet, getRouteApi, useParams, useRouterState } from '@tanstack/react-router'
import { Skeleton } from '@/ui'
import { CanvasFrame, StepNotOpen } from './CanvasFrame'
import { AppFrame, NotFound } from './Frame'
import { projectFor, sessionQuery } from './session'
import { TAKEOFF_STEPS, stepFor } from './steps'

const projectRoute = getRouteApi('/_app/p/$code')

/** "Page not found" for an address nothing matches, inside the frame. */
export function NotFoundInFrame() {
  return (
    <AppFrame>
      <NotFound />
    </AppFrame>
  )
}

/** First load (§4.1): the top bar at once; below it a Skeleton with "Opening Kadam Residence…". */
export function ProjectPending() {
  const { data: session } = useSuspenseQuery(sessionQuery)
  const { code } = useParams({ strict: false }) as { code?: string }
  const name = (code && projectFor(session, code)?.name) || ''
  return <Skeleton rows={8} className="m-6" status={<Trans>Opening {name}…</Trans>} />
}

/** The step in the address: `/p/KR-01/takeoff/7` is Step 7, whichever route draws its canvas. */
function useStepInPath() {
  const path = useRouterState({ select: (s) => s.location.pathname })
  const segment = /\/takeoff\/([^/]+)/.exec(path)?.[1] ?? '1'
  return stepFor(segment) ?? TAKEOFF_STEPS[0]!
}

export function TakeoffLayout() {
  const { data: session } = useSuspenseQuery(sessionQuery)
  const loaded = projectRoute.useLoaderData()
  // The session's copy, which Step 1 keeps up to date with its counts (22), else the loader's.
  const project = session.projects.find((p) => p.id === loaded.id) ?? loaded
  const step = useStepInPath()
  return (
    <CanvasFrame session={session} project={project} step={step}>
      <Outlet />
    </CanvasFrame>
  )
}

/** Steps 2–14: not open in M0. Step 1's canvas is ticket 22's; until it lands, the canvas is empty. */
export function StepCanvas() {
  const project = projectRoute.useLoaderData()
  const step = useStepInPath()
  if (step.open) return null
  return <StepNotOpen project={project} step={step} />
}
