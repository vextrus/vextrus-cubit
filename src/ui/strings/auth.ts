// R-SPINE-060: S-Auth's copy, and all of it — the six routes carry no string literal of their own.
// "Workspace" rather than "tenant" throughout (Decision I-11): tenant is model vocabulary, and the
// registry's copy rules keep build words out of what a person reads. The refusal messages are not
// here: those are the closed taxonomy's, rendered by the one RefusalState from its registered entry.
import { spine } from "./spine";

export const auth = {
  auth_email_label: "Email",
  auth_password_label: "Password",
  auth_new_password_label: "New password",
  auth_workspace_label: "Workspace name",
  auth_workspace_hint: "Your company or team — you can rename it later in settings.",

  auth_sign_up_title: "Create your account",
  auth_sign_up_submit: "Create account",
  // The heading a finished door leaves behind: what the screen is showing now, not what the person
  // came to do. The notice under it says only what the heading has not already said, and names the
  // address the mail went to — two lines apart, "Check your email" twice is dead weight, and a
  // person who mistyped their address can only catch it if the screen shows them what they typed
  // (Decision § 2). `{email}` is filled by the string seam's `fill` from the submitted field.
  auth_sign_up_sent_title: "Check your email",
  auth_sign_up_sent: "We sent a verification link to {email}.",
  auth_sign_up_footer_prose: "Already have an account?",
  auth_sign_up_footer_link: "Sign in",

  auth_sign_in_title: "Sign in to Vextrus",
  auth_sign_in_submit: "Sign in",
  auth_sign_in_magic_link: "Email me a sign-in link",
  auth_sign_in_forgot: "Forgot your password",
  auth_sign_in_footer_prose: "New to Vextrus?",
  auth_sign_in_footer_link: "Create account",

  auth_verify_title: "Verify your email",
  auth_verify_done_title: "Your email is verified",
  auth_verify_done: "Your email is verified — sign in to continue.",
  auth_verify_no_token: "This page needs the verification link from your email — open the link to continue.",

  auth_magic_link_title: "Sign in with a magic link",
  auth_magic_link_submit: "Email me a link",
  auth_magic_link_sent_title: "Check your email",
  auth_magic_link_sent: "Your sign-in link is on its way.",
  auth_magic_link_footer_link: "Use a password instead",

  auth_reset_title: "Reset your password",
  auth_reset_request_submit: "Email me a reset link",
  auth_reset_sent_title: "Check your email",
  auth_reset_sent: "A reset link is on its way.",
  auth_reset_submit: "Set new password",
  auth_reset_done_title: "Your password is set",
  auth_reset_done: "Your password is set and your other devices were signed out.",
  auth_reset_continue: "Continue",
  auth_back_to_sign_in: "Back to sign-in",

  auth_sessions_title: "Sessions",
  auth_sessions_caption: "Everywhere you are signed in.",
  // The date is the row's `createdAt` through the core format seam (L-FMT-01), put in this line.
  auth_sessions_signed_in: "Signed in {date}",
  auth_sessions_current: "This device",
  auth_sessions_revoke: "Revoke",
  // Every row's button reads "Revoke", which is right on the screen — the row it sits in says which
  // session it ends. A reader moving by control hears the names alone, so the accessible name says
  // the device as well; a destructive control that cannot be told from the one beside it is a trap.
  auth_sessions_revoke_device: "Revoke {device}",
  auth_sessions_sign_out: "Sign out",

  // Where a refusal is resolved (R-UI-020): a place, named verb-first in the button voice.
  auth_evidence_reset_password: "Reset your password",
  auth_evidence_go_to_sign_in: "Go to sign-in",
  auth_evidence_request_new_link: "Request a new link",
  auth_evidence_try_again: "Try again",

  // The fault surface — the other of R-SPINE-007's two answers. The Decision rules it "the root
  // boundary's voice, kept", and kept is literal: the title IS the root boundary's sentence, read
  // from the spine table that owns it rather than spelled a second time here. One sentence, one
  // home (B-17) — re-voicing the boundary re-voices this card, which is what "kept" means. The body
  // is its own sentence: the boundary's says the work is safe and offers support, which is true of a
  // page that fell over and false of a form that is still standing with its values in it.
  auth_fault_title: spine.error_title,
  auth_fault_body: "The fault has been recorded for the operators — try again.",
  auth_fault_unreachable_body: "We could not reach the server — check your connection and try again.",
  auth_fault_id_label: "Fault id",
} as const;
