// R-UI-050's matrix for the project rule-set settings screen, in the one enumerable place a suite
// reflects over (B-19). A cell says one of three things and is never silent: the state is rendered
// here, it is handed to a module outside this screen, or it cannot arise on this screen and says
// why. "Impossible" is a claim with a reason attached, which is what makes it reviewable.
import type { ShellStateCell, ShellStateName } from "../../../../../../../../ui/shell/states";

/** This screen's own home, spelled once: every cell that names a file of it starts here. */
const ROUTE = "src/app/(app)/t/[tenant]/p/[project]/settings/ruleset";

export const RULESET_SETTINGS_STATES: Readonly<Record<ShellStateName, ShellStateCell>> = {
  // Bones that keep the page's shape, hidden from the accessibility tree by the primitive itself.
  loading: { declared: "rendered", by: `${ROUTE}/loading.tsx`, testId: null },
  // The no-pin answer: an honest absence with the way onward, never an empty edition panel (I-28).
  empty: { declared: "rendered", by: `${ROUTE}/ruleset-settings-section.tsx`, testId: "ruleset-unpinned" },
  error: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "the root error boundary is the tree's one error state, and its own Decision rules retry and the report id",
  },
  refusal: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "the screen is read-only and registers no code of its own (I-28), but it is not refusal-free: every parameter renders through formatUserFigure, which refuses PRECISION_NOT_APPLIED for a stored value that is not a well-formed decimal. That is an inconsistency of the store, not an answer to the reader, so it surfaces on the root error boundary like any other read fault — no RefusalState renders here",
  },
  partial: {
    declared: "impossible",
    why: "one view, answered whole or as the no-pin shape — there are no rows that can be refused one by one",
  },
  offline: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "I-20: the page is server-rendered and holds no data that can age, so unreachability surfaces as the error state — never an invented banner",
  },
  permissionDenied: {
    declared: "delegated",
    to: "src/app/(app)/t/[tenant]/layout.tsx",
    why: "the workspace guard renders the frameless denial surface before this route mounts, and redirects an ended session to /sign-in (R-UI-030)",
  },
};
