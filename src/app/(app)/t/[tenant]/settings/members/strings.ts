// R-SPINE-060: this screen's copy, and all of it — the members surface carries no string literal of
// its own beyond test ids and fixed attribute values. The keys read `members_…`, under the same
// discipline as the tables in `src/ui/strings/*` (s-settings I-24, the `auditStrings` precedent).
//
// Workspace roles, directions, project ids and dates are model data: they render verbatim as data
// and are never woven into a sentence here (I-55).
export const membersStrings = {
  members_heading: "Members",
  members_caption: "Who belongs to this workspace, the role each member holds, and every role movement on its projects.",

  members_link_label: "Members",
  members_link_hint: "Who belongs to this workspace and what each member may do.",
  members_link_action: "Manage members",

  members_roster_heading: "Roster",
  members_roster_hint: "Every member, in the store's own order. Each role history lists movements on the projects you may read.",

  // Every row carries the same two controls, so each one's accessible name names the member it acts
  // on: a roster read aloud is N distinct controls, not N identical ones. The visible words are the
  // first words of the spoken name, so the two never disagree.
  members_role_label: "Role for {member}",
  members_role_submit: "Change role",
  members_role_submit_label: "Change role for {member}",
  members_remove_submit: "Remove",
  members_remove_submit_label: "Remove {member}",

  members_history_label: "Role history",
  members_history_by: "by {actor} on {date}",
  members_history_none: "No role movements on this workspace's projects yet.",

  members_member_unnamed: "Unnamed member",

  members_status_pending: "Carrying the change out…",
  members_status_done: "Done. The roster shows the result.",

  members_evidence_roster: "See the members list",

  // The two sentences the R-UI-050 matrix says about this screen. `src/ui` may never import a route
  // table (ARCH-01), so the matrix says them from its own mirror in `src/ui/strings/screen-states.ts`
  // — and the screen's own committed original lives here, where C-13 puts a screen's copy. The two
  // spellings are pinned equal by the acceptance, so re-wording one without the other is a red.
  members_empty_reader: "Seeing the roster needs membership of the workspace, so the list always holds at least the person reading it.",
  members_partial_scope: "The role histories answer only the projects the reader may read, and the roster's hint says so; every answered row renders.",
} as const;
