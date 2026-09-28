/*
 * A status in CONTEXT.md's words: glyph + word in its status colour (docs/design/system.md §2,
 * m0-screens §3). The compact form is the glyph alone, the word kept as screen-reader text and
 * tooltip. Colour never carries a status alone.
 */
import { useLingui } from '@lingui/react/macro'
import type { ComponentType } from 'react'
import { cn } from './cn'
import { ConfirmedGlyph, ExcludedGlyph, ProposalGlyph, QuestionGlyph, type GlyphProps } from './glyphs'

export type Status = 'proposal' | 'confirmed' | 'question' | 'excluded'

const LOOK: Record<Status, { Glyph: ComponentType<GlyphProps>; colour: string }> = {
  proposal: { Glyph: ProposalGlyph, colour: 'text-proposal' },
  confirmed: { Glyph: ConfirmedGlyph, colour: 'text-confirmed' },
  question: { Glyph: QuestionGlyph, colour: 'text-question' },
  excluded: { Glyph: ExcludedGlyph, colour: 'text-excluded' },
}

export function StatusMark({
  status,
  questionId,
  compact,
  className,
}: {
  status: Status
  /** A Question's tag, "Q3": the mark reads "Question Q3". */
  questionId?: string
  compact?: boolean
  className?: string
}) {
  const { t } = useLingui()
  const tag = questionId ?? ''
  const word = {
    proposal: t`Proposal`,
    confirmed: t`Confirmed`,
    question: questionId ? t`Question ${tag}` : t`Question`,
    excluded: t`Excluded`,
  }[status]
  const { Glyph, colour } = LOOK[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', colour, className)} title={compact ? word : undefined}>
      <Glyph size={14} className="shrink-0" />
      <span className={compact ? 'sr-only' : undefined}>{word}</span>
    </span>
  )
}
