import type { ReactNode } from 'react'
import { Trans } from '@lingui/react/macro'
import type { ProposalOut } from './data'

/**
 * A one-source sheet's line when a value was typed by the QS (a correction), as the inspector says it: not
 * "from its title block" (design gate of #706). None when neither value was typed.
 */
export function typedSourceWords(sheet: ProposalOut | undefined, name: ReactNode): ReactNode {
  const typedNumber = sheet?.number_source === 'typed'
  const typedTitle = sheet?.title_source === 'typed'
  if (typedNumber && typedTitle) return <Trans>{name} has one source: its number and title as you typed them.</Trans>
  if (typedTitle) return <Trans>{name} has one source: its title as you typed it, and its number from its title block.</Trans>
  // A typed number beside a title read from the sheet's one view: the title's source is the view, as the inspector says (#667).
  if (typedNumber && sheet?.title_source === 'view_title') return <Trans>{name} has one source: its number as you typed it, and its title is the title of its view.</Trans>
  if (typedNumber) return <Trans>{name} has one source: its number as you typed it, and its title from its title block.</Trans>
  return null
}
