/*
 * A page that could not open, in words (never the router's own "Something went wrong!" with a code in
 * it, m0-screens §1.1): a refusal in the API's words; an unreachable server as the frame says it;
 * anything else, that the page could not be opened and to reload it. With [Reload], and the way back:
 * [Your projects] in the frame, [Sign in] outside it (someone there may not be signed in).
 */
import { Trans, useLingui } from '@lingui/react/macro'
import { ApiRefused } from '@/api/client'
import { AppLink, PATHS } from '@/app/AppLink'
import { MachineText } from '@/format/machine'
import { Button, ErrorBar, buttonVariants } from '@/ui'
import { OutsidePage } from './OutsidePage'

function CouldNotOpen({ error, outside }: { error: unknown; outside: boolean }) {
  const { t } = useLingui()
  let words
  if (error instanceof ApiRefused && error.refusal) words = <MachineText message={error.refusal} />
  else if (error instanceof TypeError) words = <Trans>Vextrus can’t be reached. Check your connection and try again.</Trans>
  else words = <Trans>This page could not be opened. Reload it to try again.</Trans>
  return (
    <OutsidePage title={t`Page could not be opened`} wide>
      <div className="flex flex-col gap-4">
        <ErrorBar>{words}</ErrorBar>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => window.location.reload()}>
            <Trans>Reload</Trans>
          </Button>
          {outside ? (
            <AppLink to={PATHS.signIn} className={buttonVariants({ variant: 'secondary' })}>
              <Trans>Sign in</Trans>
            </AppLink>
          ) : (
            <AppLink to={PATHS.projects} className={buttonVariants({ variant: 'secondary' })}>
              <Trans>Your projects</Trans>
            </AppLink>
          )}
        </div>
      </div>
    </OutsidePage>
  )
}

/** The frame's error page. */
export function RouteError({ error }: { error: unknown }) {
  return <CouldNotOpen error={error} outside={false} />
}

/** The error page of a page outside the frame. */
export function OutsideRouteError({ error }: { error: unknown }) {
  return <CouldNotOpen error={error} outside />
}
