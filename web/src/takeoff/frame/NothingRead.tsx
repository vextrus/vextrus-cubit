/*
 * An empty route (m0-screens §8): nothing read for the step yet, one sentence saying why, and the one
 * action that reads it (the contract's `POST steps/{step}/read`, which answers 202 and runs behind).
 */
import { useState } from 'react'
import { Trans } from '@lingui/react/macro'
import { Button, ColumnGlyph, Empty, GridGlyph, LevelGlyph, useToast } from '@/ui'
import { readStep, type StepKey } from './api'

export function NothingRead({ projectId, step }: { projectId: string; step: StepKey }) {
  const toast = useToast()
  const [asked, setAsked] = useState(false)
  const Glyph = step === 'grid' ? GridGlyph : step === 'columns' ? ColumnGlyph : LevelGlyph
  return (
    <div className="flex h-full items-center justify-center">
      <Empty
        glyph={<Glyph />}
        action={
          asked ? null : (
            <Button
              variant="secondary"
              onClick={() => {
                setAsked(true)
                void readStep(projectId, step).catch(() => {
                  setAsked(false)
                  toast.show({ message: <Trans>Reading did not start, so nothing has changed. Try again in a minute.</Trans> })
                })
              }}
            >
              {step === 'grid' ? <Trans>Read the grid</Trans> : step === 'columns' ? <Trans>Read the columns</Trans> : <Trans>Read the storeys</Trans>}
            </Button>
          )
        }
      >
        {asked ? (
          <Trans>Reading the drawings. What is found will appear here.</Trans>
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
