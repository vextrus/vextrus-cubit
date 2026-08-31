// R-SPINE-060: the copy R-UI-050's matrix needs and no screen's own table already owns — the wait a
// skeleton cannot announce, and the sentence a screen says where one of the seven states cannot
// arise on it. Every other word the matrix renders is read from the table of the screen it belongs
// to, by key, never respelled here.
//
// A "cannot arise" sentence is a claim with a reason attached, in the voice the Design Decisions
// ruled it in: what is true of the screen, never how the product is built.
export const screenStates = {
  state_loading: "Loading…",
  state_loading_nothing_awaited: "Nothing here is waited for — this screen is served whole from what the app already carries.",

  state_empty_compiled_in: "Everything on this screen is part of the app itself, so it is never empty.",
  state_empty_gallery_complete: "Every component the product publishes has an entry here; a gallery missing one fails its own completeness check before it can ship.",
  state_empty_workspace_named: "A workspace always has a name, so this screen has nothing to be empty of.",
  state_empty_project_principal: "A project holds at least one principal at every moment, so this list always has a row.",
  state_empty_session_present: "Seeing this list needs a session of your own, so it always holds at least this device.",
  state_empty_form_asks: "This screen starts empty on purpose — it teaches by asking, and the one next action is below.",
  // The two screens whose empty state its Decision fixes verbatim and whose table lives beside the
  // route (`src/app/**/strings.ts`), which `src/ui` may never import (ARCH-01). The sentence is
  // therefore mirrored here word for word, and `tests/screen-states/copy-fidelity.test.ts` pins each
  // key to the route table it mirrors — so the two spellings cannot drift apart (C-13, B-17).
  state_empty_audit_heading: "No acts recorded yet",
  state_empty_audit_body: "Acts are recorded here the moment they are committed anywhere in this project — there is nothing to set up.",
  state_empty_ruleset_heading: "No rule set to show",
  state_empty_ruleset_body:
    "This address does not name a project in this workspace. A project pins its rule set when it is created, so a project that exists always has one.",
  state_empty_members_reader: "Seeing the roster needs membership of the workspace, so the list always holds at least the person reading it.",
  state_empty_accept_heading: "This page needs an invitation link",
  state_empty_accept_body: "Open the link from the invitation email itself — it carries the token that says which workspace you were asked to join.",

  state_refusal_ended_session: "This screen registers no refusal of its own. The one any request from it can meet is the ended session, so that is the refusal it answers with.",
  state_refusal_read_fault:
    "This screen performs no procedure and registers no code of its own: a value it cannot read is a fault, which the error state shows. The refusal it answers is the ended session, which any request can meet.",

  state_partial_one_read: "This screen's answer arrives in one read and is shown whole, so no row of it can be refused on its own.",
  state_partial_no_rows: "This screen shows no rows, so there is no part of it that could be withheld.",
  state_partial_one_answer: "One action, one answer — there is no part of it that can be refused by itself.",
  state_partial_members_scope: "The role histories answer only the projects the reader may read, and the roster's hint says so; every answered row renders.",

  state_offline_nothing_ages: "Once this screen has loaded it shows no data that can age, so losing the connection changes nothing on it.",
  state_offline_unreachable: "This screen is drawn on the server, so being unable to reach it is a fault rather than a stale page — nothing here is shown out of date.",
  state_offline_transport_fault:
    "This screen reaches the server the moment it is used, so a connection that fails is a fault of reachability — it is shown as the fault below, never as silence and never as a refusal it did not receive.",

  state_denied_public_entry: "This is the public entry to the product. No permission gates it, so none can be withheld.",
  state_denied_anonymous_door: "This door exists to be used by someone with no session, so it holds no permission to withhold.",
  state_denied_gallery_session: "Anyone holding a session sees all of this screen; a request carrying none is sent to sign-in before it is reached.",
  state_denied_project_heading: "You do not have access to this part of the project",
  state_denied_session_permission: "Seeing where you are signed in needs a live session of your own, which this request does not carry.",
  state_denied_session_holder: "Only the signed-in account holds it — signing in again is what grants it.",

  // The evidence a refusal on the members surface points at. The screen's own committed spelling
  // lives beside its route, which `src/ui` may never import (ARCH-01), so this is that mirror.
  state_members_evidence_roster: "See the members list",
} as const;

// R-SPINE-060's per-module convention is that a table file's DESIGNATED export is the one named for
// its basename, and this file's basename is not an identifier. The table is therefore published
// under both names: the identifier `index.ts` aggregates it by, and the basename the convention
// designates. One table, two names for it — never two tables.
export { screenStates as "screen-states" };
