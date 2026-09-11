// The shape a refusal is registered in, and nothing else. It stands in its own file because every
// area file of this directory declares its group against it, and the barrel `src/core/errors.ts` —
// which folds those groups into the one register — declares its own `RefusalEntry` from the same
// two closed sets. A shape imported from the barrel would be a cycle; a shape each area re-spelled
// would be the drift B-17 exists to prevent.
//
// Nothing here knows which codes exist. The codes are the areas' (AM-11), and `RefusalCode` is what
// the barrel gets by enumerating them.

/**
 * How urgently a refusal reads. Presentation only: the meaning of a refusal travels in its text,
 * never in its colour (R-UI-060). `error` — refused and needing correction; `warning` — refused
 * but expected and recoverable in stride; `info` — nothing was refused of the user, the system is
 * explaining an absence.
 */
export type RefusalSeverity = "error" | "warning" | "info";

/** Where the one renderer places the answer (R-UI-020). */
export type RefusalSurface = "inline" | "banner" | "dialog";

/**
 * One area's registered refusals, keyed by the code itself. Each entry's `code` keeps the type of
 * its own key, so a seam that answers with a narrow set of codes can read the value out of the
 * register instead of re-spelling it as a literal beside it (Q-07).
 */
export type RefusalGroup<C extends string> = Readonly<{
  [K in C]: {
    readonly code: K;
    readonly message: string;
    readonly remedy: string;
    readonly severity: RefusalSeverity;
    readonly surface: RefusalSurface;
  };
}>;
