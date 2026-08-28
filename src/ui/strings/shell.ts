// R-SPINE-060: the signed-in shell's copy, and all of it — the frame, the workspace screens and
// the two denial surfaces carry no string literal of their own. "Workspace" rather than "tenant"
// throughout (docs/design/shell.md, s-auth I-11): tenant is model vocabulary.
//
// The refusal sentences are not here: those belong to the closed taxonomy (R-SPINE-062) and are
// rendered by the one RefusalState from its registered entry. What is here for those states is the
// caller's own: the evidence link labels and the two lines that name the permission and its holders.
export const shell = {
  shell_home_workspace_door: "Open your workspace",

  shell_rail_collapse_label: "Sidebar",
  shell_rail_nav_label: "Main navigation",
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

  shell_denied_heading: "You do not have access to this workspace",
  shell_denied_permission: "Seeing it needs membership of the workspace this address names, which your account does not hold.",
  shell_denied_holder: "Its existing members hold that membership.",
  shell_denied_evidence: "Go to your workspace",
  shell_evidence_sign_in: "Go to sign-in",
  shell_evidence_home: "Go to the home page",
} as const;
