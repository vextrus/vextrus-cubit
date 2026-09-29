/*
 * Step 1's words for what 19a sends as keys (m0-screens §5, §6.7, §6.9): Disciplines, the seven
 * exclusion reasons and their short forms, the Questions' kinds and their options. Every one is in the
 * catalogue; a key with no words here shows a plain sentence, never the key itself (§1.3, §1.7).
 */
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import type { Reason } from './model'

/** Each Discipline's one name (m0-screens §1.1), until the Library's own names reach the web. */
export const DISCIPLINE_NAMES: Readonly<Record<string, MessageDescriptor>> = {
  structural: msg`Structural`,
  architectural: msg`Architectural`,
  electrical: msg`Electrical`,
  plumbing: msg`Plumbing and sanitary`,
  fire: msg`Fire`,
  mechanical: msg`Mechanical (HVAC)`,
  lift: msg`Lift`,
  gas: msg`Gas`,
}

/** The same name in running text, lower case where the language wants it ("the architectural drawing list"). */
export const DISCIPLINE_IN_TEXT: Readonly<Record<string, MessageDescriptor>> = {
  structural: msg`structural`,
  architectural: msg`architectural`,
  electrical: msg`electrical`,
  plumbing: msg`plumbing and sanitary`,
  fire: msg`fire`,
  mechanical: msg`mechanical (HVAC)`,
  lift: msg`lift`,
  gas: msg`gas`,
}

/** The drawing-list dialog's title per Discipline (6.10), one message each. */
export const LIST_TITLES: Readonly<Record<string, MessageDescriptor>> = {
  structural: msg`The structural drawing list`,
  architectural: msg`The architectural drawing list`,
  electrical: msg`The electrical drawing list`,
  plumbing: msg`The plumbing and sanitary drawing list`,
  fire: msg`The fire drawing list`,
  mechanical: msg`The mechanical (HVAC) drawing list`,
  lift: msg`The lift drawing list`,
  gas: msg`The gas drawing list`,
}

export const OTHER_LIST_TITLE = msg`The drawing list`

/** "Disciplines not yet received" (6.3): Fire is expected only from 7 storeys (bd-defaults). */
export const NOT_RECEIVED_NAMES: Readonly<Record<string, MessageDescriptor>> = {
  ...DISCIPLINE_NAMES,
  fire: msg`Fire (a building of 7 storeys or more)`,
}

export const OTHER_DISCIPLINE = msg`Another Discipline`
export const NO_DISCIPLINE = msg`No Discipline`

/** The picker's and the tooltip's words (m0-screens §5's table), keys 1–7. */
export const REASON_NAMES: Readonly<Record<Reason, MessageDescriptor>> = {
  superseded: msg`Superseded`,
  duplicate: msg`Duplicate or another Discipline’s copy`,
  cover_index: msg`Cover or index (its drawing list kept)`,
  for_information: msg`Presentation, 3D or for information`,
  by_others: msg`By others (not in this Estimate)`,
  blank: msg`Blank: base plan only`,
  other: msg`Other`,
}

/** The short forms the State column, the chips and the toasts use. */
export const REASON_SHORT: Readonly<Record<string, MessageDescriptor>> = {
  superseded: msg`superseded`,
  duplicate: msg`duplicate`,
  cover_index: msg`cover or index`,
  for_information: msg`for information`,
  by_others: msg`by others`,
  blank: msg`blank`,
  other: msg`other`,
}

export const UNKNOWN_REASON = msg`a reason Vextrus has no words for yet`

/** The Question's kind in the card's header (6.7). */
export const QUESTION_KINDS: Readonly<Record<string, MessageDescriptor>> = {
  file_misread: msg`This file may be misread`,
  conflict: msg`Two sheets, one number`,
  missing: msg`No number`,
  low_confidence: msg`Sheet kind unclear`,
  check: msg`On the drawing list, in no file`,
}

export const OTHER_QUESTION = msg`A Question about the sheets`

/** The options' words (section 5's templates), by the key 19a stores. */
export const OPTION_NAMES: Readonly<Record<string, MessageDescriptor>> = {
  read_anyway: msg`Read it anyway: its sheets join the list, marked held`,
  await_resaved: msg`Set this file aside: I’ll re-save it from AutoCAD (open it, run AUDIT, save) and add it again`,
  sent_to_vextrus: msg`Set this file aside and mark it for Vextrus to look at`,
  keep_b: msg`Keep the later revision; exclude the earlier one as superseded`,
  keep_a: msg`Keep the earlier revision; exclude the later one`,
  keep_both: msg`They are different sheets: keep both`,
  no_number: msg`Leave it without a number`,
  type_number: msg`Type a number`,
  not_sent_yet: msg`Not sent yet: keep it in the count as missing and ask the consultant`,
  not_in_set: msg`Not part of this set: take it off the list`,
  file_not_added: msg`It is in a file I haven’t added yet`,
  floor_plan: msg`Floor plan`,
  plan: msg`Plan`,
  elevation: msg`Elevation`,
  section: msg`Section`,
  schedule: msg`Schedule`,
  detail: msg`Details`,
  notes: msg`General notes`,
  legend: msg`Legend`,
  site_plan: msg`Site plan`,
  keep_open: msg`Keep open, ask the consultant`,
}

export const OTHER_OPTION = msg`An answer Vextrus has no words for yet`
