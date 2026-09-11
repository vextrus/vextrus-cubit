// The identity door's refusals (R-SPINE-003, ARCH-03, B-21): a session that has stopped counting,
// credentials that do not match, a token that cannot be spent, a door held shut against a flood, an
// address already taken, a link that cannot be sent, and a request from a page this box never served.
// Their copy is fixed by docs/design/s-auth.md § 3.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type IdentityRefusalCode =
  | "SIGNED_OUT"
  | "CREDENTIALS_NOT_VALID"
  | "TOKEN_NOT_VALID"
  | "RATE_LIMITED"
  | "ACCOUNT_ALREADY_EXISTS"
  | "LINK_NOT_SENDABLE"
  | "ORIGIN_NOT_VERIFIED";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const IDENTITY_REFUSALS: RefusalGroup<IdentityRefusalCode> = Object.freeze({
  SIGNED_OUT: Object.freeze({
    code: "SIGNED_OUT",
    message: "Your session has ended, so this request was not carried out.",
    remedy: "Sign in again to continue.",
    severity: "warning",
    surface: "banner",
  }),
  CREDENTIALS_NOT_VALID: Object.freeze({
    code: "CREDENTIALS_NOT_VALID",
    message: "The email and password do not match an account.",
    remedy: "Check both and try again, or reset your password.",
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
  ACCOUNT_ALREADY_EXISTS: Object.freeze({
    code: "ACCOUNT_ALREADY_EXISTS",
    message: "An account with this email already exists.",
    remedy: "Sign in instead, or reset the password if you have lost it.",
    severity: "error",
    surface: "inline",
  }),
  LINK_NOT_SENDABLE: Object.freeze({
    code: "LINK_NOT_SENDABLE",
    message: "No link was sent, because this installation has not been given the web address its links point back to.",
    remedy: "Ask an operator to set the address this installation answers at, then ask for the link again.",
    severity: "error",
    surface: "inline",
  }),
  ORIGIN_NOT_VERIFIED: Object.freeze({
    code: "ORIGIN_NOT_VERIFIED",
    message: "This request came from a page this deployment does not serve, so it was not carried out.",
    remedy: "Return to the workspace in your browser and try the action again from there.",
    severity: "error",
    surface: "banner",
  }),
});
