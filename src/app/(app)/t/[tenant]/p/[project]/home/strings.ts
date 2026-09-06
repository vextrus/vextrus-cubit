// S-Project's copy, and all of it — the screen carries no string literal of its own beyond test ids
// and fixed attribute values. The keys read `project_home_…`, under the same discipline as the
// tables in `src/ui/strings/*` (Design Decision I-24).
//
// The project's own stored text, act types, role names, zone and book names and every model figure
// are data: they render verbatim as data and are never woven into a sentence here (I-25).
export const projectHomeStrings = {
  project_home_client_label: "Client",
  project_home_district_label: "District",
  project_home_zones_label: "Zones",
  project_home_gfa_label: "Target GFA",
  project_home_unstated: "Not stated",
  project_home_zones_none: "No book is pinned to this project yet, so no zone is derived from its district.",
  project_home_zone_label: "Zone {zone} under {book}",
  project_home_unit_m2: "m²",
  project_home_unit_sft: "sft",

  project_home_tabs_label: "Project areas",
  project_home_tab_drawings: "Drawings",
  project_home_tab_takeoff: "Takeoff",
  project_home_tab_assure: "Assure",
  project_home_tab_estimate: "Estimate",
  project_home_tab_bid: "Bid",
  project_home_tab_activity: "Activity",
  project_home_tab_settings: "Settings",
  project_home_tab_unavailable: "Not available yet",

  project_home_actions_heading: "Quick actions",
  project_home_action_upload: "Add drawings",
  project_home_action_sets: "Browse drawing sets",
  project_home_action_participants: "Manage participants",

  project_home_ai_heading: "AI cost so far",
  project_home_ai_cost_unit: "USD",
  project_home_ai_cost_caption: "attributed to this project",
  project_home_ai_calls_caption: "model calls",
  project_home_ai_outcomes: "{proposed} proposals, {refused} refused",
  project_home_ai_none: "No model has been called on this project yet, so nothing has been spent.",
  project_home_ai_ledger: "Open the model ledger",

  project_home_activity_heading: "Recent activity",
  project_home_activity_hint: "The five newest acts on this project, newest first.",
  project_home_activity_empty:
    "No acts have been recorded on this project yet. Add drawings above; every act appears here the moment it is committed.",
  project_home_activity_all: "All activity",

  project_home_participants_heading: "Participants",
  project_home_participants_hint: "Who holds which role on this project.",
  project_home_evidence_participants: "Open the project's participants",
} as const;

/**
 * A key of this screen's own table. `src/ui/strings`' `StringKey` names the shared table's keys, and
 * ARCH-01 keeps this route's copy out of that layer (I-24), so the roster in `areas.ts` labels its
 * entries by a key of the table standing beside it.
 */
export type ProjectHomeStringKey = keyof typeof projectHomeStrings;
