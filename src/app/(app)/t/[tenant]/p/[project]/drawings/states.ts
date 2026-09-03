// R-UI-050's matrix for the sheet index, in the one enumerable place a suite reflects over (B-19). A
// cell says one of three things and is never silent: the state is rendered here, it is handed to a
// module outside this screen, or it cannot arise on this screen and says why. "Impossible" is a
// claim with a reason attached, which is what makes it reviewable.
import type { ShellStateCell, ShellStateName } from "../../../../../../../ui/shell/states";

/** This screen's own home, spelled once: every cell that names a file of it starts here. */
const ROUTE = "src/app/(app)/t/[tenant]/p/[project]/drawings";

export const DRAWINGS_STATES: Readonly<Record<ShellStateName, ShellStateCell>> = {
  // Bones that keep the page's shape, hidden from the accessibility tree by the primitive itself.
  loading: { declared: "rendered", by: `${ROUTE}/loading.tsx`, testId: null },
  // I-91: three causes, one element — a project with no drawings, drawings not read through yet,
  // and a search that matches none. Silence never happens (R-UI-020).
  empty: { declared: "rendered", by: `${ROUTE}/sheet-index.tsx`, testId: "sheets-empty" },
  error: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "the root error boundary is the tree's one error state, and its own Decision rules retry and the report id; a failed job is not an error state of this screen but a failed timeline step carrying its own named refusal",
  },
  refusal: {
    declared: "rendered",
    by: `${ROUTE}/sheet-index.tsx`,
    // The one renderer serves both answer slots and the dialog's own (R-UI-020, B-17).
    testId: "refusal-state",
  },
  partial: {
    declared: "rendered",
    by: `${ROUTE}/sheet-card.tsx`,
    // I-85, I-87: a record that dropped layouts still yields cards for the ones it carried and says
    // so as a fact; a card whose raster has not landed shows the pending thumbnail rather than none.
    testId: "sheet-card-thumbnail",
  },
  offline: {
    declared: "rendered",
    by: `${ROUTE}/sheet-index.tsx`,
    // I-89: the first screen with a live transfer queue and a live job stream, so unreachability is
    // a state a person is in rather than a fault — the banner stands and the act doors say so.
    testId: null,
  },
  permissionDenied: {
    declared: "rendered",
    by: `${ROUTE}/sheet-index.tsx`,
    // I-90: the workspace membership holds, so the frame stays and the denial is in-frame — the
    // whole index and every group still render, because knowledge is not permission.
    testId: "refusal-state",
  },
};
