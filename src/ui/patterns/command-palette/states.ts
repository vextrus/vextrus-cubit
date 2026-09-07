// R-UI-050's matrix for the two surfaces this pattern ships, in the one enumerable place a suite
// reflects over (B-19). docs/design/command-palette.md §2 and docs/design/shortcut-sheet.md §2 rule
// each cell; this is that ruling in a form a test can walk.
//
// A cell says one of three things and is never silent: the state is rendered here, it is handed to a
// module outside this surface, or it cannot arise and says why. "Impossible" is a claim with a
// reason attached, which is what makes it reviewable.
import { STATE_NAMES, type ScreenStateName } from "../../screen-states/contract";
import type { ShellStateCell } from "../../shell/states";

/** This pattern's own home, spelled once: every cell that names a file of it starts here. */
const PATTERN = "src/ui/patterns/command-palette";

/** The one renderer R-UI-020 gives every surface, inside a dialog as much as inside a form (I-142). */
const REFUSAL_RENDERER = "src/ui/patterns/refusal-state/refusal-state.tsx";

/** What one surface declares, total over R-UI-050's seven by type — a missing state cannot compile. */
export type CommandPaletteStateRow = Readonly<Record<ScreenStateName, ShellStateCell>>;

const PALETTE: CommandPaletteStateRow = {
  loading: { declared: "rendered", by: `${PATTERN}/command-palette.tsx`, testId: "command-palette-loading" },
  empty: { declared: "rendered", by: `${PATTERN}/command-palette.tsx`, testId: "command-palette-empty" },
  // I-143: `status` names no fault arm, so the error cell arrives as the `fault` prop and outranks
  // it — R-UI-050's retry and report id, in the list's place.
  error: { declared: "rendered", by: `${PATTERN}/command-palette.tsx`, testId: null },
  refusal: {
    declared: "delegated",
    to: REFUSAL_RENDERER,
    why: "R-UI-020: one renderer serves every surface including inside dialogs, and a screen-local refusal block is a defect (B-17)",
  },
  // The same card in the same wrapper, rendered UNDER the groups instead of in their place: the hits
  // that were answered stand (I-142, R-UI-050 — shown, not hidden).
  partial: { declared: "rendered", by: `${PATTERN}/command-palette.tsx`, testId: "command-palette-refusal" },
  offline: { declared: "rendered", by: `${PATTERN}/provider.tsx`, testId: null },
  "permission-denied": {
    declared: "delegated",
    to: REFUSAL_RENDERER,
    why: "the registered WORKSPACE_PERMISSION_NOT_HELD entry names the permission and its holders in the register's own words; this surface paraphrases no registered sentence (shell I-18)",
  },
};

const SHEET: CommandPaletteStateRow = {
  loading: { declared: "impossible", why: "the sheet renders a roster held in the bundle; nothing is awaited, so a skeleton would be theatre (R-UI-004)" },
  empty: { declared: "impossible", why: "SHORTCUTS is non-empty by construction, and the suite asserts a row for every entry in both directions (AC-3)" },
  error: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "the surface has no request that can fail; a render fault mounts the root error boundary, which rules retry and the report id",
  },
  refusal: {
    declared: "delegated",
    to: REFUSAL_RENDERER,
    why: "the sheet asks the server for nothing, so no refusal reaches it; were one to, it would render through the one renderer and never a block of its own (R-UI-020, B-17)",
  },
  partial: { declared: "impossible", why: "every roster entry renders and none can be withheld, so no half of this surface exists" },
  offline: { declared: "impossible", why: "the roster is local, so the sheet reads identically offline and no banner is invented (shell I-20)" },
  "permission-denied": {
    declared: "delegated",
    to: REFUSAL_RENDERER,
    why: "knowing which keys the product binds needs no permission; a key whose destination a session cannot reach is answered by that destination's own screen through the one renderer",
  },
};

/** Both surfaces' declarations, keyed by the name their Design Decisions give them. */
export const COMMAND_PALETTE_STATES: Readonly<Record<string, CommandPaletteStateRow>> = Object.freeze({
  "command-palette": PALETTE,
  "shortcut-sheet": SHEET,
});

/** R-UI-050's roster, re-published so a reader of this matrix walks the clause's own list (B-19). */
export const COMMAND_PALETTE_STATE_NAMES: readonly ScreenStateName[] = STATE_NAMES;
