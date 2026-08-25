// C-SPINE-PLATFORM: every user-facing string lives in one typed table keyed by id, so a missing
// key is a compile error and no screen spells its own copy. This table holds what the product has
// words for today; each screen's increment adds its own keys here.
export const strings = {
  error_title: "Something went wrong on our side",
  error_body: "Your work is safe. The fault has been recorded for the operators — try again, and if it keeps failing, contact support.",
  error_retry: "Try again",
} as const;

export type StringKey = keyof typeof strings;
