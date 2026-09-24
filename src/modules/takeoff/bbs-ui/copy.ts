import { REFUSALS } from "@/core/errors";
// S-BBS's sentences, as the module that renders them may read them (R-SPINE-060, ARCH-01).
//
// `src/ui/strings/bbs.ts` is the product's one string table for this screen and a module may not
// import `src/ui`, so the words stand here too — word for word, in the same keys, mirrored by hand
// exactly as `boq/copy.ts`, `coverage/copy.ts` and `schedules-ui/copy.ts` already mirror theirs. The
// Decision's §3 is the authority for both files; a sentence that differs between them is a defect of
// this file.
export const BBS_COPY = {
  takeoff_nav_bbs: "Bar schedule",
  bbs_revision_label: "Pinned revision",
  bbs_stock_label: "Stock bar",
  bbs_stock_rounding_label: "rounded",
  bbs_unit_mm: "mm",
  bbs_grid_label: "Bars by member and mark",
  bbs_col_mark: "Bar mark",
  bbs_col_role: "Role",
  bbs_col_shape: "Shape",
  bbs_col_diameter: "Diameter (mm)",
  bbs_col_dims: "Dimensions",
  bbs_col_cutting_raw: "Cutting length (mm)",
  bbs_col_cutting_rounded: "Rounded (mm)",
  // The column prints IS 2502's whole cutting length, so it is named for that (I-568).
  bbs_col_cutting_is: "IS 2502 (mm)",
  bbs_col_bars: "Bars",
  bbs_col_kg: "Mass (kg)",
  // A mark is stated once per floor with its number of members (I-534): the group row says the count,
  // and the Bars cell of a line counted over several members says what one member takes.
  bbs_members_one: "1 member",
  bbs_members_many: "{count} members",
  bbs_bars_each: "{each} in each of {count} members",
  // The components of a rebar line, in words (I-354): the rail's own `net`, `lap` and `ties`.
  bbs_component_net: "Bars",
  bbs_component_lap: "Laps",
  bbs_component_ties: "Ties",
  bbs_lap_label: "Lap",
  bbs_lap_tooltip: "A lap is scheduled as its own row beside the net bar, never as a percentage of it.",
  bbs_summary_heading: "Cutting stock by diameter",
  bbs_stock_note_label: "About cutting stock",
  bbs_stock_note:
    "Stock bars, pieces and offcut describe what a site cuts from a stock bar. They are informational and are never billed.",
  bbs_summary_col_diameter: "Diameter (mm)",
  bbs_summary_col_kg: "Mass (kg)",
  bbs_summary_col_stock_bars: "Stock bars",
  bbs_summary_col_pieces: "Pieces",
  bbs_summary_col_offcut: "Offcut (m)",
  bbs_summary_total: "Total mass",
  // What the total covers, said where the schedule is not the whole of the steel (I-567/c), from what
  // the schedule holds: a component some entries left out is said with its members and why (I-671).
  bbs_total_covers: "{scope} only — {missing}",
  bbs_total_covers_whole: "{scope} only",
  bbs_total_not_counted: "{components} not counted",
  bbs_total_some_not_counted: "{component} of {members} not counted: {reasons}",
  bbs_total_reason: "{why} ({where})",
  bbs_total_marks_at: "{marks} at {levels}",
  bbs_total_levels_many: "{count} levels",
  bbs_total_reason_separator: " · ",
  bbs_total_clause_separator: "; ",
  bbs_why_joint_unread: "joint depth unread",
  bbs_why_shape_not_held: "shape not held",
  bbs_why_tie_zone_unstated: "tie zones unstated",
  bbs_why_note_contested: "note contested",
  bbs_scope_main_bars: "main bars",
  bbs_scope_bars_and_ties: "bars and ties",
  bbs_scope_and: "and",
  // Everything the schedule leaves out folds behind one line that opens the list (I-672).
  bbs_disclosure_one: "1 item not in this schedule",
  bbs_disclosure_many: "{count} items not in this schedule",
  // An entry whose members' lines left part of its steel out says so on its own row (s-bbs I-655).
  bbs_member_left_out: "{components} left out",
  bbs_member_partly: "Partly declared",
  bbs_member_partial_tooltip: "The lines of this entry's members leave part of its steel out: what, and why, is said above the schedule.",
  // A member whose laps are not stated holds storey-height runs, not lengths to cut (I-567).
  bbs_run_label: "Storey-height runs, not for cutting",
  bbs_run_tooltip: "The laps of these bars are not stated, so each stands at its storey height: a quantity to weigh, not a length to cut.",
  bbs_stock_withheld: "Not computed — laps not stated",
  bbs_stock_withheld_note:
    "Cutting stock is not computed for {diameters} mm: those bars are storey-height runs whose laps are not stated, and nobody can cut from them.",
  // The steel no line was published for, in the draft BOQ's own closing words (I-569).
  bbs_not_in_schedule: "Not in this schedule:",
  bbs_partial: "Some rebar lines are partly declared, so their bars stand here as they read.",
  bbs_partial_omitted: "Left out of this schedule:",
  bbs_complete: "Every bar of the pinned campaign is scheduled, with laps as their own rows.",
  bbs_empty_heading: "No bars scheduled yet",
  bbs_empty_body:
    "A bar schedule lists every bar of the pinned campaign by member and mark, with its shape, its cutting lengths and its mass. Measure the campaign from the takeoff register and the schedule appears here.",
  bbs_empty_action: "Go to the takeoff register",
  bbs_error_heading: "The bar schedule could not be read",
  bbs_error_body: "Nothing was changed. Try again, and quote the report id if it keeps happening.",
  bbs_retry: "Try again",
  bbs_offline: "You are offline. The schedule reads as it stood when this page loaded.",
  bbs_denied_body: "Reading the bar schedule needs the MEASURE permission on this project.",
  bbs_denied_holder: "Open the participants screen",

  // The export door, and what stands beside it while a render is watched (Decision §1, I-270's
  // precedent): the one primary, the job strip's heading, and the link a finished render offers.
  bbs_export: "Export the schedule",
  bbs_jobs_heading: "Rendering the schedule",
  bbs_document_link: "Open the issued schedule",
} as const;

/** One slot of a sentence filled: `{count} members` with `{ count: "8" }` is `8 members`. */
export function fillCopy(key: keyof typeof BBS_COPY, values: Readonly<Record<string, string>>): string {
  return BBS_COPY[key].replace(/\{(\w+)\}/gu, (slot, name: string) => values[name] ?? slot);
}

/**
 * The components of a rebar line in words, by the rail's own variable name (I-354) — read by the
 * screen's omitted list and by the issued schedule's, so the two faces say one word for one component
 * (B-17). `net` is the bars themselves, lap excluded (AM-03(a)).
 */
export const BBS_COMPONENT_SAID: Readonly<Record<string, string>> = Object.freeze({
  net: BBS_COPY.bbs_component_net,
  lap: BBS_COPY.bbs_component_lap,
  ties: BBS_COPY.bbs_component_ties,
});

/**
 * Why a component was left out, in the few words the total says it in (I-671), by the
 * registered code its line states. The register's own sentence stays the full reason, in the list
 * above the schedule; a code not held here is said by its marks alone.
 */
export const BBS_WHY_SAID: Readonly<Record<string, string>> = Object.freeze({
  [REFUSALS.REBAR_TIE_JOINT_UNREAD.code]: BBS_COPY.bbs_why_joint_unread,
  [REFUSALS.BAR_SHAPE_NOT_HELD.code]: BBS_COPY.bbs_why_shape_not_held,
  [REFUSALS.REBAR_TIE_ZONE_UNSTATED.code]: BBS_COPY.bbs_why_tie_zone_unstated,
  [REFUSALS.NOTE_READING_CONTESTED.code]: BBS_COPY.bbs_why_note_contested,
});

/**
 * How many members a line counts, in words: `1 member`, `8 members` (I-534). The figure arrives
 * already written by the format seam, because a count a reader reads is a number like any other.
 */
export function membersSaid(count: number, figure: string): string {
  return count === 1 ? BBS_COPY.bbs_members_one : fillCopy("bbs_members_many", { count: figure });
}
