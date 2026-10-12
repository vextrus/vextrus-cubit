/*
 * An empty route (m0-screens §8): nothing read for the step yet, one sentence saying why, and the one
 * action that reads it (the contract's `POST steps/{step}/read`, which answers 202 and runs behind).
 * Once asked, the screen asks for the step's answers again every POLL_MS until they come (the page
 * replaces this empty state itself); the MD and a Guest are told, with no action, that the QS reads.
 */
import { useEffect, useState } from 'react'
import { Trans } from '@lingui/react/macro'
import { useLingui } from '@lingui/react'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { sessionQuery } from '@/app/session'
import { readOnlyRole } from '@/auth'
import { problemOf, problemText } from '@/auth/problem'
import { POLL_MS } from '@/drawing-set/data'
import { useFormat } from '@/format'
import { Button, ColumnGlyph, Empty, GridGlyph, LevelGlyph, useToast } from '@/ui'
import { frameKey, readStep, type StepKey } from './api'

export function NothingRead({ projectId, step }: { projectId: string; step: StepKey }) {
  const toast = useToast()
  const qc = useQueryClient()
  const f = useFormat()
  const { i18n } = useLingui()
  const { data: session } = useSuspenseQuery(sessionQuery)
  const readOnly = readOnlyRole(session) !== null
  const [asked, setAsked] = useState(false)
  const Glyph = step === 'grid' ? GridGlyph : step === 'columns' ? ColumnGlyph : LevelGlyph

  // A read under way: the proposals are asked for again until some arrive (this component then goes).
  useEffect(() => {
    if (!asked) return
    const timer = setInterval(() => void qc.invalidateQueries({ queryKey: frameKey(projectId) }), POLL_MS)
    return () => clearInterval(timer)
  }, [asked, qc, projectId])

  async function read() {
    setAsked(true)
    try {
      await readStep(projectId, step)
      await qc.invalidateQueries({ queryKey: frameKey(projectId) })
    } catch (error) {
      setAsked(false)
      try {
        const problem = problemOf(error)
        if (problem) toast.show({ message: problemText(problem, f, i18n) })
      } catch {
        toast.show({ message: problemText({ failed: true }, f, i18n) })
      }
    }
  }

  return (
    <div className="flex h-full items-center justify-center">
      <Empty
        glyph={<Glyph />}
        action={
          asked || readOnly ? null : (
            <Button variant="secondary" onClick={() => void read()}>
              {step === 'grid' ? <Trans>Read the grid</Trans> : step === 'columns' ? <Trans>Read the columns</Trans> : <Trans>Read the storeys</Trans>}
            </Button>
          )
        }
      >
        {asked ? (
          <Trans>Reading the drawings. What is found will appear here.</Trans>
        ) : readOnly ? (
          step === 'grid' ? (
            <Trans>No grid lines yet. The QS starts the reading once the plans are confirmed in Step 1.</Trans>
          ) : step === 'columns' ? (
            <Trans>No columns yet. The QS starts the reading once the plans are confirmed in Step 1.</Trans>
          ) : (
            <Trans>No storeys yet. The QS starts the reading once the plans are confirmed in Step 1.</Trans>
          )
        ) : step === 'grid' ? (
          <Trans>No grid lines yet. They are read from the plans you confirmed in Step 1.</Trans>
        ) : step === 'columns' ? (
          <Trans>No columns yet. They are read from the plans you confirmed in Step 1.</Trans>
        ) : (
          <Trans>No storeys yet. They are read from the plans you confirmed in Step 1.</Trans>
        )}
      </Empty>
    </div>
  )
}
