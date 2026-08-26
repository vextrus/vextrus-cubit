// C-SPINE-PLATFORM, R-SPINE-060: every user-facing string lives in a typed table keyed by id, so a
// missing key is a compile error and no screen spells its own copy. This is the spine module's own
// table — the platform shell and the surfaces it owns; each module keeps its keys in its own file
// beside this one, and `index.ts` aggregates them.
export const spine = {
  error_title: "Something went wrong on our side",
  error_body: "Your work is safe. The fault has been recorded for the operators — try again, and if it keeps failing, contact support.",
  error_retry: "Try again",

  // The shell at `/`: the product named, and the way to each screen the tier ships (R-UI-031).
  home_title: "Vextrus",
  home_sign_in: "Sign in",
  home_sign_up: "Create account",
} as const;
