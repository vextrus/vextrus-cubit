/**
 * The registered refusals the declared states render, authored as data (the gallery's I-18
 * precedent): `src/ui` holds no value import of `src/core` (ARCH-01), so `RefusalEntry` arrives as
 * a type and the entry is written out here. Every code is one the taxonomy registers, with the
 * register's own message, remedy, severity and surface verbatim — this module spells no sentence and
 * no code the register does not own (Q-07, R-SPINE-062, B-17).
 */
import type { RefusalCode, RefusalEntry } from "../../core/errors";

/** The codes the shipped screens' Design Decisions name as reachable on them. */
type DeclaredCode = Extract<
  RefusalCode,
  | "SIGNED_OUT"
  | "PERMISSION_NOT_HELD"
  | "PROJECT_WOULD_HAVE_NO_PRINCIPAL"
  | "CREDENTIALS_NOT_VALID"
  | "ACCOUNT_ALREADY_EXISTS"
  | "TOKEN_NOT_VALID"
  | "RATE_LIMITED"
  | "LINK_NOT_SENDABLE"
  | "WORKSPACE_PERMISSION_NOT_HELD"
  | "SELF_REMOVAL_NOT_ALLOWED"
  | "WORKSPACE_WOULD_HAVE_NO_OWNER"
  | "MEMBER_HAS_ACTS"
  | "INVITATION_NOT_CLAIMABLE"
  | "MANIFEST_NOT_RENDERABLE"
  | "GROUP_NOT_OFFERED"
  | "SET_NOT_PINNABLE"
  | "SET_NAME_NOT_USABLE"
  | "SET_MEMBER_NOT_IN_PROJECT"
>;

/**
 * Each entry keeps the type of its own key, so a screen reads its refusal out of this record rather
 * than re-spelling a code beside it (Q-07's wiring rule, as `REFUSALS` itself is shaped).
 */
export const REFUSAL_ENTRIES: Readonly<{ [C in DeclaredCode]: RefusalEntry & { code: C } }> = Object.freeze({
  SIGNED_OUT: Object.freeze({
    code: "SIGNED_OUT",
    message: "Your session has ended, so this request was not carried out.",
    remedy: "Sign in again to continue.",
    severity: "warning",
    surface: "banner",
  }),
  PERMISSION_NOT_HELD: Object.freeze({
    code: "PERMISSION_NOT_HELD",
    message: "Your roles on this project do not carry the permission this action needs.",
    remedy: "Ask a principal of the project to give you a role that carries it.",
    severity: "error",
    surface: "banner",
  }),
  PROJECT_WOULD_HAVE_NO_PRINCIPAL: Object.freeze({
    code: "PROJECT_WOULD_HAVE_NO_PRINCIPAL",
    message: "This withdrawal would leave the project with no principal, so it was not carried out.",
    remedy: "Make another member a principal first, then withdraw this one.",
    severity: "error",
    surface: "inline",
  }),
  CREDENTIALS_NOT_VALID: Object.freeze({
    code: "CREDENTIALS_NOT_VALID",
    message: "The email and password do not match an account.",
    remedy: "Check both and try again, or reset your password.",
    severity: "error",
    surface: "inline",
  }),
  ACCOUNT_ALREADY_EXISTS: Object.freeze({
    code: "ACCOUNT_ALREADY_EXISTS",
    message: "An account with this email already exists.",
    remedy: "Sign in instead, or reset the password if you have lost it.",
    severity: "error",
    surface: "inline",
  }),
  TOKEN_NOT_VALID: Object.freeze({
    code: "TOKEN_NOT_VALID",
    message: "This link is no longer valid — it may have expired or already been used.",
    remedy: "Request a fresh link and use the newest email.",
    severity: "error",
    surface: "inline",
  }),
  RATE_LIMITED: Object.freeze({
    code: "RATE_LIMITED",
    message: "Too many attempts in a short time, so this one was not tried.",
    remedy: "Wait a minute, then try again.",
    severity: "warning",
    surface: "inline",
  }),
  LINK_NOT_SENDABLE: Object.freeze({
    code: "LINK_NOT_SENDABLE",
    message: "No link was sent, because this installation has not been given the web address its links point back to.",
    remedy: "Ask an operator to set the address this installation answers at, then ask for the link again.",
    severity: "error",
    surface: "inline",
  }),
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
  MEMBER_HAS_ACTS: Object.freeze({
    code: "MEMBER_HAS_ACTS",
    message: "This member holds recorded acts on open campaigns, so their membership was not removed.",
    remedy: "Remove them once those campaigns close — the record keeps its author until then.",
    severity: "error",
    surface: "inline",
  }),
  INVITATION_NOT_CLAIMABLE: Object.freeze({
    code: "INVITATION_NOT_CLAIMABLE",
    message: "This invitation cannot be accepted — it was never issued, has already been accepted, or was withdrawn.",
    remedy: "Ask an owner of that workspace to send a fresh invitation to the address you are signed in with.",
    severity: "error",
    surface: "inline",
  }),
  MANIFEST_NOT_RENDERABLE: Object.freeze({
    code: "MANIFEST_NOT_RENDERABLE",
    message: "The reading of this drawing is damaged, so the sheet cannot be drawn.",
    remedy: "Upload the drawing again to have it read afresh.",
    severity: "error",
    surface: "banner",
  }),
  GROUP_NOT_OFFERED: Object.freeze({
    code: "GROUP_NOT_OFFERED",
    message: "This group is not one the project offers now, so nothing was confirmed.",
    remedy: "Reload the sheet index and confirm from a group it offers.",
    severity: "error",
    surface: "inline",
  }),
  SET_NOT_PINNABLE: Object.freeze({
    code: "SET_NOT_PINNABLE",
    message: "This set names no members of this project, so no revision was pinned.",
    remedy: "Add at least one drawing to the set, then pin it.",
    severity: "error",
    surface: "inline",
  }),
  SET_NAME_NOT_USABLE: Object.freeze({
    code: "SET_NAME_NOT_USABLE",
    message: "The set name is blank or already names a set of this project, so no set was created.",
    remedy: "Give the set a name no other set of this project carries.",
    severity: "error",
    surface: "inline",
  }),
  SET_MEMBER_NOT_IN_PROJECT: Object.freeze({
    code: "SET_MEMBER_NOT_IN_PROJECT",
    message: "That drawing is not one of this project's, so the set was not changed.",
    remedy: "Reload the set and toggle a drawing the project holds.",
    severity: "error",
    surface: "inline",
  }),
} satisfies Record<DeclaredCode, RefusalEntry>);
