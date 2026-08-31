// R-SPINE-060: the invitations panel's copy, and all of it — the panel carries no string literal of
// its own beyond test ids and fixed attribute values. The keys read `invitations_…`, under the same
// discipline as the roster's `members_…` table beside it (s-settings §3).
//
// Workspace roles and addresses are model data: they render verbatim as data and are never woven
// into a sentence here (I-55, I-58).
export const invitationsStrings = {
  invitations_heading: "Invitations",
  invitations_hint:
    "Offers of membership this workspace has made that nobody has accepted yet. An invitation is one live link at a time: resending replaces the last one, and withdrawing ends it.",

  invitations_email_label: "Email address",
  invitations_email_hint: "The address the invitation is mailed to. It becomes a membership when the person signs in and accepts it.",
  invitations_submit: "Send invitation",

  invitations_pending_heading: "Pending",

  // Every pending row carries the same two controls, so each one's accessible name names the
  // invitation it acts on: a list read aloud is N distinct controls, not N identical ones. The
  // visible words are the first words of the spoken name, so the two never disagree.
  invitations_resend: "Resend",
  invitations_resend_label: "Resend the invitation to {invitee}",
  invitations_revoke: "Withdraw",
  invitations_revoke_label: "Withdraw the invitation to {invitee}",

  invitations_none: "No invitation is waiting to be accepted.",
  invitations_invitee_unnamed: "Unnamed address",

  invitations_status_pending: "Carrying the invitation out…",
  invitations_status_done: "Done. The list shows the result.",
} as const;
