/*
 * The storey-titles Question's words (T-W318; S15-E3): Step 1's one `check` Question per Discipline over
 * the sheets whose title names storeys their plans do not agree with (engine.storey_titles.differs).
 * Every answer is recorded only: no sheet and no storey changes, since no Step 1 act edits a plan's
 * storeys yet (story 28), so no word here may promise one (#436's review round 1, scored 70). They sit
 * in the takeoff folder's generic catalogue, beside the Storeys column's words.
 *
 *   STOREY_TITLE_OPTIONS.plans_right                 // an option's words (words.tsx's OPTION_NAMES)
 *   <StoreyTitlesAnswering picked={…} keys={…} hint /> // what answering does
 *   <StoreyTitlesAnswered tag="Q4" option="plans_right" /> // the answered line
 */
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import type { ReactNode } from 'react'

export const STOREY_TITLES = 'engine.storey_titles.differs'

/** The options' words, by the key the backend stores (proposals.py's STOREY_TITLE_OPTIONS). */
export const STOREY_TITLE_OPTIONS: Readonly<Record<'plans_right' | 'title_right', MessageDescriptor>> = {
  plans_right: msg`The plans are right: keep the storeys they name`,
  title_right: msg`The titles are right: the plans name the wrong storeys`,
}

/** What answering does: before a pick (with the keys to pick, as `hint` asks), and for each pick. */
export function StoreyTitlesAnswering({ picked, keys, hint }: { picked?: string | null; keys: ReactNode; hint: boolean }) {
  if (picked === 'plans_right') return <Trans>Answering records that the plans’ storeys are right. Vextrus keeps taking the storeys from the plans.</Trans>
  if (picked === 'title_right') return <Trans>Answering records that the titles are right. Vextrus still takes the storeys from the plans.</Trans>
  if (picked === 'keep_open') return <Trans>Answering keeps this Question open; its sheets wait for the consultant.</Trans>
  return hint ? (
    <Trans>Answering records whether the titles or the plans are right; no sheet changes. Pick an answer: {keys}.</Trans>
  ) : (
    <Trans>Answering records whether the titles or the plans are right; no sheet changes.</Trans>
  )
}

/** The answered line of `plans_right` or `title_right`; null for another option (worded by the caller). */
export function StoreyTitlesAnswered({ tag, option }: { tag: ReactNode; option: string }) {
  if (option === 'plans_right') return <Trans>{tag} answered. Recorded: the plans’ storeys stand.</Trans>
  if (option === 'title_right') return <Trans>{tag} answered. Recorded: the titles are right; the plans’ storeys stay as read.</Trans>
  return null
}
