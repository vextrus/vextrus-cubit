/*
 * Why an act or a page failed, and its words (m0-screens §1.1: what happened, what to do): the API's
 * refusal in its own words; a server out of reach; or a failure that carries no words at all (a
 * server fault, a proxy's error page), which is said plainly rather than not at all.
 *
 *   try { await act() } catch (error) { setProblem(problemOf(error)) }
 *   <ProblemBar problem={problem} />
 */
import { Trans } from '@lingui/react/macro'
import type { I18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { ApiRefused } from '@/api/client'
import type { Format } from '@/format'
import { MachineText, machineText, type MachineMessage } from '@/format/machine'
import { Button, ErrorBar } from '@/ui'

export type Problem = { refusal: MachineMessage } | { unreachable: true } | { failed: true } | null

/** The problem an error from the API means; anything else is a bug, and is thrown on. */
export function problemOf(error: unknown): Problem {
  if (error instanceof ApiRefused) return error.refusal ? { refusal: error.refusal } : { failed: true }
  if (error instanceof TypeError) return { unreachable: true }
  throw error
}

const UNREACHABLE = msg`Vextrus can’t be reached. Check your connection and try again.`
const FAILED = msg`Vextrus could not do that just now. Try again in a minute.`

/** The words as plain text, for a toast. */
export function problemText(problem: NonNullable<Problem>, f: Format, i18n: I18n): string {
  if ('refusal' in problem) return machineText(problem.refusal, f, i18n)
  return i18n._('unreachable' in problem ? UNREACHABLE : FAILED)
}

export function ProblemWords({ problem }: { problem: NonNullable<Problem> }) {
  if ('refusal' in problem) return <MachineText message={problem.refusal} />
  if ('unreachable' in problem) return <Trans>Vextrus can’t be reached. Check your connection and try again.</Trans>
  return <Trans>Vextrus could not do that just now. Try again in a minute.</Trans>
}

export function ProblemBar({ problem, className }: { problem: Problem; className?: string }) {
  if (!problem) return null
  return (
    <ErrorBar className={className}>
      <ProblemWords problem={problem} />
    </ErrorBar>
  )
}

/**
 * A page's or a panel's data that could not be read. Out of reach, the query keeps trying (the frame
 * says so); refused, the API's words; failed with no words, that it could not be opened, and [Try again].
 */
export function LoadProblem({ error, onRetry, className }: { error: unknown; onRetry: () => void; className?: string }) {
  if (error instanceof ApiRefused && error.refusal) {
    return (
      <ErrorBar className={className}>
        <MachineText message={error.refusal} />
      </ErrorBar>
    )
  }
  if (error instanceof TypeError) {
    return (
      <ErrorBar className={className}>
        <Trans>Vextrus can’t be reached. Check your connection; this page keeps trying.</Trans>
      </ErrorBar>
    )
  }
  return (
    <ErrorBar
      className={className}
      action={
        <Button onClick={onRetry}>
          <Trans>Try again</Trans>
        </Button>
      }
    >
      <Trans>Vextrus could not open this just now. Try again in a minute.</Trans>
    </ErrorBar>
  )
}
