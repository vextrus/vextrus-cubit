// R-SPINE-060: S-Auth's copy, and all of it — the six routes carry no string literal of their own.
// "Workspace" rather than "tenant" throughout (Decision I-11): tenant is model vocabulary, and the
// registry's copy rules keep build words out of what a person reads. The refusal messages are not
// here: those are the closed taxonomy's, rendered by the one RefusalState from its registered entry.
export const auth = {
  auth_email_label: "Email",
  auth_password_label: "Password",
  auth_new_password_label: "New password",
  auth_workspace_label: "Workspace name",
  auth_workspace_placeholder: "e.g. Meridian Builders",
  auth_workspace_hint: "Your company or team — you can rename it later in settings.",

  auth_sign_up_title: "Create your account",
  auth_sign_up_submit: "Create account",
  auth_sign_up_sent: "Check your email — we sent you a verification link.",
  auth_sign_up_footer_prose: "Already have an account?",
  auth_sign_up_footer_link: "Sign in",

  auth_sign_in_title: "Sign in to Vextrus",
  auth_sign_in_submit: "Sign in",
  auth_sign_in_magic_link: "Email me a sign-in link",
  auth_sign_in_forgot: "Forgot your password",
  auth_sign_in_footer_prose: "New to Vextrus?",
  auth_sign_in_footer_link: "Create account",

  auth_verify_title: "Verify your email",
  auth_verify_done: "Your email is verified — sign in to continue.",
  auth_verify_no_token: "This page needs the verification link from your email — open the link to continue.",

  auth_magic_link_title: "Sign in with a magic link",
  auth_magic_link_submit: "Email me a link",
  auth_magic_link_sent: "Check your email — your sign-in link is on its way.",
  auth_magic_link_footer_link: "Use a password instead",

  auth_reset_title: "Reset your password",
  auth_reset_request_submit: "Email me a reset link",
  auth_reset_sent: "Check your email — a reset link is on its way.",
  auth_reset_submit: "Set new password",
  auth_reset_done: "Your password is set and your other devices were signed out.",
  auth_reset_continue: "Continue",
  auth_back_to_sign_in: "Back to sign-in",

  auth_sessions_title: "Sessions",
  auth_sessions_caption: "Everywhere you are signed in.",
  // The date is the row's `createdAt` through the core format seam (L-FMT-01), put in this line.
  auth_sessions_signed_in: "Signed in {date}",
  auth_sessions_current: "This device",
  auth_sessions_revoke: "Revoke",
  auth_sessions_sign_out: "Sign out",

  // Where a refusal is resolved (R-UI-020): a place, named verb-first in the button voice.
  auth_evidence_reset_password: "Reset your password",
  auth_evidence_go_to_sign_in: "Go to sign-in",
  auth_evidence_request_new_link: "Request a new link",
  auth_evidence_try_again: "Try again",

  // The fault surface — the other of R-SPINE-007's two answers. The root boundary's voice, kept.
  auth_fault_title: "Something went wrong on our side",
  auth_fault_body: "The fault has been recorded for the operators — try again.",
  auth_fault_unreachable_body: "We could not reach the server — check your connection and try again.",
  auth_fault_id_label: "Fault id",
} as const;
