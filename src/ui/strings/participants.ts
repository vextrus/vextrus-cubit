// R-SPINE-060: the participants screen's own table. Copy fixed verbatim by
// docs/design/s-settings-participants.md § 3; shell and home keys are reused by key, never respelled.
export const participants = {
  spine_participants_heading: "Participants",
  spine_participants_caption: "Who holds which role on this project. Roles change only by act — previewed first, then committed — and every change stays on the record below.",
  spine_participants_current_heading: "Current roles",
  spine_participants_assign_heading: "Assign a role",
  spine_participants_assign_hint: "Granting or withdrawing opens a preview of exactly what will change. Nothing is committed until you confirm it there.",
  spine_participants_field_member: "Member",
  spine_participants_field_role: "Role",
  spine_participants_field_direction: "Direction",
  spine_participants_assign_submit: "Preview this change",
  spine_participants_assign_refusal: "Choose a member and a role — nothing was previewed.",
  spine_participants_history_heading: "Role history",
  spine_participants_history_hint: "Every grant and withdrawal on this project, oldest first. Withdrawn roles stay on the record — nothing here is edited or deleted.",
  spine_participants_history_by: "by {actor} on {date}",
  spine_participants_member_unnamed: "Unnamed member",
  spine_participants_denied_permission: "Seeing who holds which role needs participation on this project or ownership of the workspace; the permission your account is missing is ADMINISTER_PROJECT.",
  spine_participants_denied_holder: "The project's participants and the workspace's owners and admins can see it.",
  spine_participants_evidence_assign: "Grant another member PRINCIPAL first",
} as const;
