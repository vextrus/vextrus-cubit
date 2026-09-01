// R-SPINE-060: the accept screen's copy, and all of it — the screen carries no string literal of its
// own beyond test ids and fixed attribute values. The keys read `accept_…`, under the same discipline
// as every other route table in this tree (docs/design/s-accept-invitation.md §3).
//
// The workspace's name and the role it offers are model data: they render verbatim as data and are
// never woven into a sentence here (I-55).
export const acceptInvitationStrings = {
  accept_heading: "Join a workspace",
  accept_caption: "Somebody has invited the address you are signed in with to work in their workspace. Accepting adds it to the workspaces you can switch between; the one you already have is untouched.",

  accept_workspace_label: "Workspace",
  accept_role_label: "Role you would hold",
  accept_submit: "Accept the invitation",

  accept_no_token_heading: "This page needs an invitation link",
  accept_no_token_body: "Open the link from the invitation email itself — it carries the token that says which workspace you were asked to join.",

  accept_status_pending: "Joining the workspace…",
  accept_status_done: "Done. You now hold a membership of that workspace.",

  accept_evidence_workspaces: "See the workspaces you hold",
} as const;
