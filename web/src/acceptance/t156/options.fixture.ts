/*
 * Ticket 156's table of every Question code 21c's read job and Step 1 raise, with every option key each
 * can carry (PR #152: vextrus/takeoff/services/read_propose/proposals.py's `*_OPTIONS`, step1.py's
 * drawing-list Question, the Market's Disciplines in vextrus/drawings/library.py and the sheet kinds in
 * engine/recognise/conventions/sheet-default.json). options.node.test.ts proves this table is exactly
 * what the backend raises; answer-words.test.tsx proves the screen words every key in it.
 */

/** Every Discipline key the Bangladesh Market has (vextrus/drawings/library.py). */
export const DISCIPLINES = ['structural', 'architectural', 'electrical', 'plumbing', 'fire', 'mechanical', 'lift', 'gas', 'general'] as const

/** Every sheet kind Jev may rank for a sheet (sheet-default.json's `sheet_kinds`, then `common_sheet_kinds`). */
export const SHEET_KINDS = [
    'site_plan', 'grid_layout', 'pile_layout', 'pile_details', 'pile_cap_layout', 'pile_cap_details',
    'foundation_layout', 'foundation_details', 'column_layout', 'column_schedule', 'shear_wall_details',
    'beam_layout', 'beam_details', 'slab_layout', 'slab_details', 'stair_details', 'retaining_wall_details', 'tank_details',
    'roof_structure_details', 'details', 'working_plan', 'presentation_plan', 'roof_plan', 'elevation',
    'section', 'door_window_layout', 'door_window_schedule', 'door_window_details', 'floor_finish_layout',
    'finish_schedule', 'ceiling_layout', 'lintel_layout', 'slab_outline_layout', 'toilet_details',
    'kitchen_details', 'roof_details', 'boundary_wall_gate_details', 'perspective', 'legend',
    'lighting_layout', 'point_wiring_layout', 'power_wiring_layout', 'elv_layout', 'ac_pipe_layout',
    'solar_layout', 'single_line_diagram', 'riser_diagram', 'distribution_board_details',
    'substation_generator_layout', 'earthing_details', 'lightning_protection', 'plumbing_layout',
    'site_drainage_layout', 'sanitary_fixture_details', 'pit_chamber_details', 'septic_tank_details',
    'water_tank_details', 'pump_details', 'rainwater_details', 'fire_alarm_layout', 'sprinkler_layout',
    'fire_hydrant_layout', 'extinguisher_signage_layout', 'fire_pump_details', 'hvac_layout',
    'ventilation_layout', 'equipment_schedule', 'lift_layout', 'lift_section', 'lift_pit_details',
    'machine_room_details', 'gas_line_layout', 'cover_index', 'general_notes', 'other',
] as const

export interface QuestionShape {
  kind: string
  code: string
  options: readonly string[]
}

const KEEP_OPEN = 'keep_open'
const HELD = ['read_anyway', 'await_resaved', 'sent_to_vextrus', KEEP_OPEN]
const CHECK = ['not_sent_yet', 'not_in_set', 'file_not_added', KEEP_OPEN]

export const QUESTION_SHAPES: readonly QuestionShape[] = [
  { kind: 'file_misread', code: 'engine.decoders_agree.disagree', options: HELD },
  { kind: 'conflict', code: 'engine.conflicts.same_number', options: ['keep_latest', 'keep_all', KEEP_OPEN] },
  { kind: 'conflict', code: 'engine.conflicts.same_title', options: ['keep_all', KEEP_OPEN] },
  { kind: 'conflict', code: 'engine.conflicts.same_storey', options: ['keep_all', KEEP_OPEN] },
  { kind: 'conflict', code: 'takeoff.proposals.lists_disagree', options: ['use_read', 'use_given', KEEP_OPEN] },
  { kind: 'missing', code: 'takeoff.step1.no_number', options: ['no_number', 'type_number', KEEP_OPEN] },
  { kind: 'missing_discipline', code: 'takeoff.proposals.which_discipline', options: [...DISCIPLINES, KEEP_OPEN] },
  { kind: 'low_confidence', code: 'takeoff.proposals.which_kind', options: [...SHEET_KINDS, KEEP_OPEN] },
  { kind: 'convention', code: 'takeoff.proposals.boundary_storey', options: ['includes_storey', 'excludes_storey', KEEP_OPEN] },
  { kind: 'check', code: 'engine.register_check.not_found', options: CHECK },
  { kind: 'check', code: 'engine.register_check.not_listed', options: CHECK },
  { kind: 'check', code: 'engine.register_check.gap', options: CHECK },
]
