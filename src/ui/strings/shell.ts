// R-SPINE-060: the signed-in shell's copy, and all of it — the frame, the workspace screens and
// the two denial surfaces carry no string literal of their own. "Workspace" rather than "tenant"
// throughout (docs/design/shell.md, s-auth I-11): tenant is model vocabulary.
//
// The refusal sentences are not here: those belong to the closed taxonomy (R-SPINE-062) and are
// rendered by the one RefusalState from its registered entry. What is here for those states is the
// caller's own: the evidence link labels and the two lines that name the permission and its holders.
export const shell = {
  shell_home_workspace_door: "Open your workspace",

  // The rail is a landmark of its own, so the controls that live in it are inside a region a reader
  // can tour to; this is its name, and it is not the inspector's.
  shell_rail_label: "Workspace sidebar",
  // A control is named by what it does. The state is `aria-expanded`'s to carry, so the name stays
  // the same in both states — and a speech-input user has a verb to say, which a bare noun denied.
  shell_rail_collapse_label: "Toggle sidebar",
  shell_rail_nav_label: "Main navigation",
  // The rail stands at 48 px showing icons only (Direction §1); the labels the icons stand for are
  // in tooltips, and this control holds the rail open so they stay read rather than hovered for. One
  // name in both states — `aria-pressed` carries whether it is held, so a speech-input user says the
  // same words either way (WCAG 2.5.3).
  shell_rail_pin_label: "Pin sidebar open",
  shell_tenant_switcher_label: "Switch workspace",
  shell_nav_projects: "Projects",
  shell_nav_books: "Books",
  shell_nav_settings: "Settings",

  shell_breadcrumb_label: "Breadcrumb",
  // What the user menu is named when the account's address is not a value that can be shown.
  shell_user_account: "Your account",
  shell_user_sessions: "Sessions",
  shell_user_signout: "Sign out",

  shell_inspector_label: "Details",
  // The handle between the main field and the inspector. A separator a pointer can drag is a control
  // a keyboard must reach too (R-UI-012), so it is named as what it does, not as what it looks like.
  shell_inspector_resize_label: "Resize the details panel",

  // The 24 px readout (Direction §3.1): one line of mono cells, each named for a reader, because a
  // number with no name is a number nobody can check. The values are the screen's; these are the
  // names the cells wear.
  shell_status_label: "Status readout",
  shell_status_sheet: "Sheet",
  shell_status_scale: "Scale",
  shell_status_coords: "Coordinates",
  shell_status_snap: "Snap",
  shell_status_selection: "Selection",
  shell_status_layers: "Layers",
  shell_status_jobs: "Jobs",
  // What a cell says when the screen has no value for it — an em dash, never a blank cell that reads
  // as a broken line (Direction §3.1: "cells show —").
  shell_status_absent: "—",

  // The 32 px toolbar (Direction §1): one row of 28 px icon buttons in groups. The row is a toolbar
  // for a reader too, so it carries a name of its own.
  shell_toolbar_label: "Tools",
  shell_inspector_empty: "Details of what you select appear here.",

  shell_projects_heading: "Projects",
  shell_projects_empty_heading: "No projects yet",
  shell_projects_empty_body:
    "A project holds your drawings and everything measured from them. The SAMPLE project is a small, clearly marked example to look around in.",
  // R-UI-033: the offer is one click target, and its label carries the word the fixture set is
  // labelled with, so nobody mistakes the example for their own work.
  shell_sample_offer: "Add the SAMPLE project",
  shell_sample_unavailable: "The SAMPLE project is not available yet — nothing was added to your workspace.",

  shell_books_heading: "Books",
  shell_books_empty_heading: "Nothing in Books yet",
  shell_books_empty_body: "Financial records appear here once your projects produce them.",
  shell_books_empty_action: "Go to Projects",

  shell_settings_heading: "Settings",
  shell_settings_name_label: "Workspace name",
  shell_settings_name_hint: "The name appears in the sidebar and on every screen of this workspace.",
  shell_rename_submit: "Save name",
  shell_rename_saved: "The workspace name is saved.",
  // R-UI-033 asks for an entered name: a name with nothing visible in it names nothing, and the
  // screen says so where the answer is read rather than saving it (this is the door's own copy —
  // not a refusal of the closed taxonomy, R-SPINE-062).
  shell_rename_refusal: "A workspace name needs at least one visible character — nothing was saved.",
  // What a workspace is called on screen when its stored name has nothing visible in it. Without
  // it the breadcrumb link would carry no discernible name at all (Q-11).
  shell_workspace_unnamed: "Unnamed workspace",
  // The same reading for a project: a crumb with no glyph in it names nothing (I-22, Q-11).
  shell_project_unnamed: "Unnamed project",

  // R-UI-005's control. The hint says what the setting does and where it holds, not how it is
  // stored; the option labels are the plain mode names, never the seam's raw values.
  shell_density_label: "Table density",
  shell_density_hint: "Sets the row height of every table. Saved to your account, so it applies wherever you sign in.",
  shell_density_comfortable: "Comfortable",
  shell_density_compact: "Compact",

  // The theme control, beside density because it is the same kind of thing: a preference about how
  // this person's product is drawn. The hint says where it holds and what "System" defers to; it
  // never says "cookie", which is storage talking rather than the product.
  shell_theme_label: "Theme",
  shell_theme_hint: "Sets the ground the product is drawn on. Held in this browser; System follows your device.",
  shell_theme_system: "System",
  shell_theme_dark: "Dark",
  shell_theme_light: "Light",

  shell_denied_heading: "You do not have access to this workspace",
  shell_denied_permission: "Seeing it needs membership of the workspace this address names, which your account does not hold.",
  shell_denied_holder: "Its existing members hold that membership.",
  shell_denied_evidence: "Go to your workspace",
  shell_evidence_sign_in: "Go to sign-in",
  shell_evidence_home: "Go to the home page",
} as const;
