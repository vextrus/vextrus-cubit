// The workspace's own refusals (R-SPINE-003): administration of members and of the invitations that
// make them, including the coupling to the act log that keeps an author in place.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type InvitationsRefusalCode =
  | "WORKSPACE_PERMISSION_NOT_HELD"
  | "SELF_REMOVAL_NOT_ALLOWED"
  | "WORKSPACE_WOULD_HAVE_NO_OWNER"
  | "MEMBER_HAS_ACTS"
  | "INVITATION_NOT_CLAIMABLE";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const INVITATIONS_REFUSALS: RefusalGroup<InvitationsRefusalCode> = Object.freeze({
  WORKSPACE_PERMISSION_NOT_HELD: Object.freeze({
    code: "WORKSPACE_PERMISSION_NOT_HELD",
    message: "Your role in this workspace does not carry the permission this action needs.",
    remedy: "Ask an owner of the workspace to carry it out, or to give you a role that carries it.",
    severity: "error",
    surface: "banner",
  }),
  SELF_REMOVAL_NOT_ALLOWED: Object.freeze({
    code: "SELF_REMOVAL_NOT_ALLOWED",
    message: "You cannot remove yourself from a workspace.",
    remedy: "Ask another owner to remove you, so somebody is left who can undo it.",
    severity: "error",
    surface: "inline",
  }),
  WORKSPACE_WOULD_HAVE_NO_OWNER: Object.freeze({
    code: "WORKSPACE_WOULD_HAVE_NO_OWNER",
    message: "This would leave the workspace with no owner, so it was not carried out.",
    remedy: "Make another member an owner first, then try again.",
    severity: "error",
    surface: "inline",
  }),
  // SEAM-ACT's coupling: tenant administration sits outside the act log's writ, so a membership the
  // log names as an author is not taken away underneath the record it made (R-SPINE-003).
  MEMBER_HAS_ACTS: Object.freeze({
    code: "MEMBER_HAS_ACTS",
    message: "This member holds recorded acts on open campaigns, so their membership was not removed.",
    remedy: "Remove them once those campaigns close — the record keeps its author until then.",
    severity: "error",
    surface: "inline",
  }),
  // R-SPINE-003's ACCEPT flow: the four ways a mailed invitation stops being spendable answer as
  // one code, because an answer that told them apart would tell the holder of a token which of them
  // it is — and a stranger's probe would learn whether an address was ever invited.
  INVITATION_NOT_CLAIMABLE: Object.freeze({
    code: "INVITATION_NOT_CLAIMABLE",
    message: "This invitation cannot be accepted — it was never issued, has already been accepted, or was withdrawn.",
    remedy: "Ask an owner of that workspace to send a fresh invitation to the address you are signed in with.",
    severity: "error",
    surface: "inline",
  }),
});
