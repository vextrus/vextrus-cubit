// R-UI-050's matrix for S-Audit, in the one enumerable place a suite reflects over (B-19). A cell
// says one of three things and is never silent: the state is rendered here, it is handed to a module
// outside this screen, or it cannot arise on this screen and says why. "Impossible" is a claim with
// a reason attached, which is what makes it reviewable.
import type { ShellStateCell, ShellStateName } from "../../../../../../../ui/shell/states";

/** This screen's own home, spelled once: every cell that names a file of it starts here. */
const ROUTE = "src/app/(app)/t/[tenant]/p/[project]/audit";

export const AUDIT_STATES: Readonly<Record<ShellStateName, ShellStateCell>> = {
  // Bones that keep the page's shape, hidden from the accessibility tree by the primitive itself.
  loading: { declared: "rendered", by: `${ROUTE}/loading.tsx`, testId: null },
  // Two truths in the list's place, chosen by cause: no acts recorded yet, or none matching the
  // filters — and only the second carries an action, because no action on a reader commits an act.
  empty: { declared: "rendered", by: `${ROUTE}/act-log-explorer.tsx`, testId: "audit-acts-empty" },
  error: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "the root error boundary is the tree's one error state, and its own Decision rules retry and the report id",
  },
  refusal: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "the screen performs no procedure and registers no code of its own, but it is not refusal-free: every figure renders through formatUserFigure, which refuses PRECISION_NOT_APPLIED for a stored value that is not a well-formed decimal. That is an inconsistency of the store rather than an answer to the reader, so it surfaces on the root error boundary like any other read fault",
  },
  partial: {
    declared: "impossible",
    why: "one read, answered whole: the acts and both panel postures come back together, and there are no rows that can be refused one by one. A disarmed panel is not a partial answer — it is the whole truthful answer about an installation that holds no such table (I-35)",
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
