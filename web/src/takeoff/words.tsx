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

/** The Question's kind in the card's header (6.7), by its message code, else by its kind. */
export const QUESTION_KIND_BY_CODE: Readonly<Record<string, MessageDescriptor>> = {
  'engine.decoders_agree.disagree': msg`This file may be misread`,
  'engine.agree.disagree': msg`This file may be misread`,
  'engine.conflicts.same_number': msg`Two sheets, one number`,
  'engine.conflicts.same_storey': msg`Two plans draw one thing`,
  'engine.conflicts.same_title': msg`Two plans draw one thing`,
  'engine.register_check.not_found': msg`On the drawing list, in no file`,
  'engine.register_check.not_listed': msg`In a file, not on the drawing list`,
  'takeoff.step1.no_number': msg`No number`,
  'takeoff.step1.which_kind': msg`Sheet kind unclear`,
}

export const QUESTION_KINDS: Readonly<Record<string, MessageDescriptor>> = {
  file_misread: msg`This file may be misread`,
  conflict: msg`Two sheets, one number`,
  missing: msg`No number`,
  low_confidence: msg`Sheet kind unclear`,
  check: msg`A Check against the drawing list`,
}

export const OTHER_QUESTION = msg`A Question about the sheets`

/** The options' words (section 5's templates), by the key 19a stores; a conflict's are worded in the card. */
export const OPTION_NAMES: Readonly<Record<string, MessageDescriptor>> = {
  read_anyway: msg`Read it anyway: its sheets join the list, marked held`,
  await_resaved: msg`Set this file aside: I’ll re-save it from AutoCAD (open it, run AUDIT, save) and add it again`,
  sent_to_vextrus: msg`Set this file aside and mark it for Vextrus to look at`,
  keep_both: msg`They are different sheets: keep both`,
  no_number: msg`Leave it without a number`,
  type_number: msg`Type a number`,
  not_sent_yet: msg`Not sent yet: keep it in the count as missing and ask the consultant`,
  not_in_set: msg`Not part of this set: take it off the list`,
  file_not_added: msg`It is in a file I haven’t added yet`,
  keep_open: msg`Keep open, ask the consultant`,
}

/** The kinds of sheet (engine/recognise/conventions/sheet-default.json's `sheet_kinds` and `common_sheet_kinds`). */
export const SHEET_KIND_NAMES: Readonly<Record<string, MessageDescriptor>> = {
  site_plan: msg`Site plan`,
  grid_layout: msg`Grid layout`,
  pile_layout: msg`Pile layout`,
  pile_details: msg`Pile details`,
  pile_cap_layout: msg`Pile cap layout`,
  pile_cap_details: msg`Pile cap details`,
  foundation_layout: msg`Foundation layout`,
  foundation_details: msg`Foundation details`,
  column_layout: msg`Column layout`,
  column_schedule: msg`Column schedule`,
  shear_wall_details: msg`Shear wall details`,
  beam_layout: msg`Beam layout`,
  beam_details: msg`Beam details`,
  slab_layout: msg`Slab layout`,
  stair_details: msg`Stair details`,
  retaining_wall_details: msg`Retaining wall details`,
  tank_details: msg`Tank details`,
  roof_structure_details: msg`Roof structure details`,
  details: msg`Details`,
  working_plan: msg`Working plan`,
  presentation_plan: msg`Presentation plan`,
  floor_plan: msg`Floor plan`,
  roof_plan: msg`Roof plan`,
  elevation: msg`Elevation`,
  section: msg`Section`,
  door_window_layout: msg`Door and window layout`,
  door_window_schedule: msg`Door and window schedule`,
  door_window_details: msg`Door and window details`,
  floor_finish_layout: msg`Floor finish layout`,
  finish_schedule: msg`Finish schedule`,
  ceiling_layout: msg`Ceiling layout`,
  lintel_layout: msg`Lintel layout`,
  slab_outline_layout: msg`Slab outline layout`,
  toilet_details: msg`Toilet details`,
  kitchen_details: msg`Kitchen details`,
  roof_details: msg`Roof details`,
  boundary_wall_gate_details: msg`Boundary wall and gate details`,
  perspective: msg`Perspective`,
  legend: msg`Legend`,
  lighting_layout: msg`Lighting layout`,
  point_wiring_layout: msg`Point wiring layout`,
  power_wiring_layout: msg`Power wiring layout`,
  elv_layout: msg`ELV layout`,
  ac_pipe_layout: msg`AC pipe layout`,
  solar_layout: msg`Solar layout`,
  single_line_diagram: msg`Single line diagram`,
  riser_diagram: msg`Riser diagram`,
  distribution_board_details: msg`Distribution board details`,
  substation_generator_layout: msg`Substation and generator layout`,
  earthing_details: msg`Earthing details`,
  lightning_protection: msg`Lightning protection`,
  plumbing_layout: msg`Plumbing layout`,
  site_drainage_layout: msg`Site drainage layout`,
  sanitary_fixture_details: msg`Sanitary fixture details`,
  pit_chamber_details: msg`Pit and chamber details`,
  septic_tank_details: msg`Septic tank details`,
  water_tank_details: msg`Water tank details`,
  pump_details: msg`Pump details`,
  rainwater_details: msg`Rainwater details`,
  fire_alarm_layout: msg`Fire alarm layout`,
  sprinkler_layout: msg`Sprinkler layout`,
  fire_hydrant_layout: msg`Fire hydrant layout`,
  extinguisher_signage_layout: msg`Extinguisher and signage layout`,
  fire_pump_details: msg`Fire pump details`,
  hvac_layout: msg`HVAC layout`,
  ventilation_layout: msg`Ventilation layout`,
  equipment_schedule: msg`Equipment schedule`,
  lift_layout: msg`Lift layout`,
  lift_section: msg`Lift section`,
  lift_pit_details: msg`Lift pit details`,
  machine_room_details: msg`Machine room details`,
  gas_line_layout: msg`Gas line layout`,
  cover_index: msg`Cover or index`,
  general_notes: msg`General notes`,
  other: msg`Another kind of sheet`,
}

export const OTHER_OPTION = msg`An answer Vextrus has no words for yet`

/** Where a value was read (m0-screens 6.6's Proposal block, "where each was read"). */
export const SOURCE_NAMES: Readonly<Record<string, MessageDescriptor>> = {
  title_block_attribute: msg`title-block attribute`,
  title_block_text: msg`text in the title block`,
  file_name: msg`from the file name`,
  file: msg`from the file`,
}

/** A view's kind (6.6's Views: "Plan", "Detail"). */
export const VIEW_KIND_NAMES: Readonly<Record<string, MessageDescriptor>> = {
  plan: msg`Plan`,
  section: msg`Section`,
  elevation: msg`Elevation`,
  schedule: msg`Schedule`,
  detail: msg`Detail`,
  notes: msg`Notes`,
  legend: msg`Legend`,
  title_block: msg`Title block`,
  key_plan: msg`Key plan`,
  perspective: msg`3D or perspective`,
}
export const OTHER_VIEW_KIND = msg`View`

/** What a plan's storey list means (6.8). */
export const STOREYS_MEANING: Readonly<Record<string, MessageDescriptor>> = {
  at_floor_level: msg`at floor level`,
  floor_to_floor: msg`floor to floor`,
  mixed: msg`mixed`,
}
