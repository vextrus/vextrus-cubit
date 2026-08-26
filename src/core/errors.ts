// R-SPINE-062: the closed refusal taxonomy, and its one home (ARCH-02, B-17). Every code carries
// an English message, a remedy hint, a severity and a surface hint; every transport and every
// screen reads a refusal from here rather than writing one of its own.
//
// The taxonomy is closed in the strong sense B-06 asks for: a code is registered here or it does
// not exist. `refusalOf` throws on a code the registry lacks rather than inventing an entry, so a
// mistyped code fails loudly at its call site instead of reaching a user as an empty answer.
//
// The copy is fixed by docs/design/refusal-state.md § 3, whose rules bind every entry here: the
// message is one present-tense sentence saying what was refused and why, the remedy one sentence
// beginning with the verb that resolves it. Operator detail — the internal "why" a seam carries
// alongside the code — never appears here; it travels with the thrown marker instead.

/**
 * How urgently a refusal reads. Presentation only: the meaning of a refusal travels in its text,
 * never in its colour (R-UI-060). `error` — refused and needing correction; `warning` — refused
 * but expected and recoverable in stride; `info` — nothing was refused of the user, the system is
 * explaining an absence.
 */
export type RefusalSeverity = "error" | "warning" | "info";

/** Where the one renderer places the answer (R-UI-020). */
export type RefusalSurface = "inline" | "banner" | "dialog";

/** Every code the taxonomy holds. The union is the registry's key set — the two cannot drift. */
export type RefusalCode =
  | "PRECISION_NOT_APPLIED"
  | "CHARACTER_NOT_COVERED"
  | "SIGNED_OUT"
  | "CONSEQUENCES_NOT_CARRIED"
  | "PERMISSION_NOT_HELD"
  | "ACTOR_NOT_HUMAN";

/** One registered refusal, whole: what it is, what happened, what resolves it, how it renders. */
export type RefusalEntry = {
  code: RefusalCode;
  message: string;
  remedy: string;
  severity: RefusalSeverity;
  surface: RefusalSurface;
};

/**
 * The registry, keyed by the code itself and frozen entry by entry — a refusal read at a transport
 * or a screen is the registered answer, never a mutated one.
 */
export const REFUSALS: Readonly<Record<RefusalCode, RefusalEntry>> = Object.freeze({
  PRECISION_NOT_APPLIED: Object.freeze({
    code: "PRECISION_NOT_APPLIED",
    message: "The value is not at the exact precision this document requires.",
    remedy: "Enter the value at the stated precision — nothing is rounded or padded on your behalf.",
    severity: "error",
    surface: "inline",
  }),
  CHARACTER_NOT_COVERED: Object.freeze({
    code: "CHARACTER_NOT_COVERED",
    message: "The text contains a character the document font cannot print.",
    remedy: "Replace or remove the unsupported character — a document never prints a blank box in its place.",
    severity: "error",
    surface: "inline",
  }),
  SIGNED_OUT: Object.freeze({
    code: "SIGNED_OUT",
    message: "Your session has ended, so this request was not carried out.",
    remedy: "Sign in again to continue.",
    severity: "warning",
    surface: "banner",
  }),
  CONSEQUENCES_NOT_CARRIED: Object.freeze({
    code: "CONSEQUENCES_NOT_CARRIED",
    message: "This change was reviewed against an earlier state of the project, which has moved since.",
    remedy: "Review the change again — what it would do now is not what was shown.",
    severity: "warning",
    surface: "dialog",
  }),
  PERMISSION_NOT_HELD: Object.freeze({
    code: "PERMISSION_NOT_HELD",
    message: "Your roles on this project do not carry the permission this action needs.",
    remedy: "Ask a principal of the project to give you a role that carries it.",
    severity: "error",
    surface: "banner",
  }),
  ACTOR_NOT_HUMAN: Object.freeze({
    code: "ACTOR_NOT_HUMAN",
    message: "This action is recorded as a human act, so only a person may perform it.",
    remedy: "Perform the action as a signed-in person.",
    severity: "error",
    surface: "banner",
  }),
} satisfies Record<RefusalCode, RefusalEntry>);

/**
 * The registered entry for a code. An unregistered code is a mistake in the caller, not a refusal
 * the product can answer with, so it throws rather than guessing one (B-06, R-SPINE-062).
 */
export function refusalOf(code: RefusalCode): RefusalEntry {
  if (!Object.hasOwn(REFUSALS, code)) {
    throw new Error(`"${code}" is not a registered refusal — the taxonomy is closed (R-SPINE-062, B-06)`);
  }
  return REFUSALS[code];
}
