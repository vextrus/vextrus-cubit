// R-UI-050's matrix for the palette's two surfaces, in the one enumerable place a suite reflects
// over (B-19): the clause is checkable rather than aspirational, so a state a surface never declares
// is a failing test and never a review note. docs/design/command-palette.md § 2 and
// docs/design/shortcut-sheet.md § 2 rule each cell; this is those rulings in a form a test can walk.
//
// A cell says one of three things and is never silent: the state is rendered here, it is handed to a
// module outside this surface, or it cannot arise and says why. "Impossible" is a claim with a reason
// attached, which is what makes it reviewable. The cell shape is the job pattern's, in the register
// the clause itself uses — its own kebab names, from their one home.
import type { ScreenStateName } from "../../screen-states/contract";

/** What a surface declares about one state. */
export type PaletteStateCell =
  | {
      readonly declared: "rendered";
      /** The module that paints it, repo-relative. */
      readonly by: string;
      /** The hook a journey reads it at, or null for a state with no id of its own. */
      readonly testId: string | null;
    }
  | {
      readonly declared: "delegated";
      /** The module that owns the state instead, repo-relative. */
      readonly to: string;
      readonly why: string;
    }
  | { readonly declared: "impossible"; readonly why: string };

/** One surface's seven, total over the clause's roster by type — a missing cell cannot compile. */
export type PaletteStateRow = Readonly<Record<ScreenStateName, PaletteStateCell>>;

const PALETTE_MODULE = "src/ui/patterns/command-palette/command-palette.tsx";
const BOUNDARY_MODULE = "src/app/error.tsx";
const REFUSAL_RENDERER = "src/ui/patterns/refusal-state/refusal-state.tsx";

/** R-UI-020's one renderer answers every refusal on this surface; it keeps no block of its own. */
const REFUSAL_DELEGATED = {
  declared: "delegated",
  to: REFUSAL_RENDERER,
  why: "a refusal is answered by the one RefusalState inside `command-palette-refusal`, carrying the registered code, message, remedy and the evidence that resolves it (R-UI-020, B-17, I-142)",
} as const;

/** The denial is the same card, from the same register, naming the permission in its own words. */
const PERMISSION_DELEGATED = {
  declared: "delegated",
  to: REFUSAL_RENDERER,
  why: "WORKSPACE_PERMISSION_NOT_HELD is a registered refusal, and the register's sentence names the permission and its holders; the palette paraphrases none of it (shell I-18, I-142)",
} as const;

export const COMMAND_PALETTE_STATES: Readonly<Record<string, PaletteStateRow>> = {
  "command-palette": {
    loading: { declared: "rendered", by: PALETTE_MODULE, testId: "command-palette-loading" },
    empty: { declared: "rendered", by: PALETTE_MODULE, testId: "command-palette-empty" },
    // The fault is a prop of its own rather than a fifth `status` arm (I-143), so the retry and the
    // report id R-UI-050 owes stand on a card found by its role rather than by an id of its own.
    error: { declared: "rendered", by: PALETTE_MODULE, testId: null },
    refusal: REFUSAL_DELEGATED,
    // A refusal arriving beside rows that were answered: the rows stand and the card sits under them
    // rather than in their place (R-UI-050 — shown, not hidden).
    partial: { declared: "rendered", by: PALETTE_MODULE, testId: "command-palette-refusal" },
    offline: { declared: "rendered", by: PALETTE_MODULE, testId: null },
    "permission-denied": PERMISSION_DELEGATED,
  },
  "shortcut-sheet": {
    loading: {
      declared: "impossible",
      why: "the sheet renders a roster frozen in the bundle; nothing is awaited, so a skeleton would be theatre (R-UI-004)",
    },
    empty: {
      declared: "impossible",
      why: "SHORTCUTS is non-empty by construction, and the suite asserts a row for every entry in both directions before an empty sheet could ship (AC-3, B-19)",
    },
    error: {
      declared: "delegated",
      to: BOUNDARY_MODULE,
      why: "the sheet makes no request that can fail; a render fault mounts the root error boundary, and this surface adds nothing to it",
    },
    refusal: {
      declared: "impossible",
      why: "the sheet asks the server for nothing; a key that cannot act here is not refused but scoped, and the scope heading says so in words (I-148)",
    },
    partial: {
      declared: "impossible",
      why: "every roster entry renders and none can be withheld, so there is no half of this surface to show",
    },
    offline: {
      declared: "impossible",
      why: "the roster is local, so the sheet reads identically offline and no banner is invented (shell I-20)",
    },
    "permission-denied": {
      declared: "impossible",
      why: "knowing which keys the product binds needs no permission; a key whose destination a session cannot reach is answered by that destination's own screen",
    },
  },
};
