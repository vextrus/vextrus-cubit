/*
 * The inspector's Selection tab for a focused group (S16-W1): what the group holds, proposal by
 * proposal, with each one's Trace (the fact, and the sheet it was read from), which opens the sheet
 * viewer on that sheet.
 */
import { Trans } from '@lingui/react/macro'
import { DrawingText } from '@/ui'
import type { FrameGroup, StepKey, TraceOut } from './api'
import { groupState, valueText } from './model'
import { QuestionLine, StateMark, TraceButton } from './parts'

export function GroupInspector({ group, sheetOf, onOpen, step }: { group: FrameGroup; sheetOf: (viewId: string) => string | null; onOpen: (trace: TraceOut) => void; step: StepKey }) {
  return (
    <section aria-label={group.label} className="flex flex-col gap-2 p-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <StateMark state={groupState(group)} />
        <DrawingText kind={step === 'grid' ? 'grid' : 'mark'} text={group.label} />
      </h3>
      <ul className="flex flex-col gap-2">
        {group.proposals.map((p) => {
          const at = valueText(p.values, 'at')
          const b = valueText(p.values, 'section_b')
          const d = valueText(p.values, 'section_d')
          const unit = valueText(p.values, 'unit')
          const axis = valueText(p.values, 'axis')
          const offset = valueText(p.values, 'offset')
          return (
            <li key={p.id} className="flex flex-col gap-0.5 border-b border-border pb-2 text-sm">
              <span className="flex items-center gap-2">
                <StateMark state={p.questions.length > 0 && p.state === 'proposal' ? 'question' : p.state === 'confirmed' ? 'confirmed' : p.state === 'excluded' ? 'excluded' : 'proposal'} />
                <span className="font-semibold">
                  <DrawingText kind={step === 'grid' ? 'grid' : 'mark'} text={p.mark} truncate={false} />
                </span>
                {at ? (
                  <span className="num text-xs text-ink-secondary" dir="ltr">
                    {at}
                  </span>
                ) : null}
              </span>
              {b !== null && d !== null ? (
                <span className="num text-xs text-ink-secondary" dir="ltr">
                  {b} × {d} {unit ?? ''}
                </span>
              ) : null}
              {axis !== null && offset !== null ? (
                <span className="num text-xs text-ink-secondary" dir="ltr">
                  {axis} {offset}
                </span>
              ) : null}
              {p.questions.map((q, i) => (
                <span key={i} className="text-xs text-question">
                  <QuestionLine question={q} />
                </span>
              ))}
              {p.trace.length === 0 ? (
                <span className="text-xs text-ink-secondary">
                  <Trans>No Trace on a sheet for this one.</Trans>
                </span>
              ) : (
                p.trace.map((tr, i) => <TraceButton key={`${tr.view_id}-${tr.fact}-${i}`} trace={tr} sheet={sheetOf(tr.view_id)} onOpen={onOpen} />)
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
