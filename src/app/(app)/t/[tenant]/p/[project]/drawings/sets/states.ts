// R-UI-050's matrix for the sets index, in the one enumerable place a suite reflects over (B-19). A
// cell says one of three things and is never silent: the state is rendered here, it is handed to a
// module outside this screen, or it cannot arise on this screen and says why.
import type { ShellStateCell, ShellStateName } from "../../../../../../../../ui/shell/states";

/** This screen's own home, spelled once: every cell that names a file of it starts here. */
const ROUTE = "src/app/(app)/t/[tenant]/p/[project]/drawings/sets";

export const SETS_INDEX_STATES: Readonly<Record<ShellStateName, ShellStateCell>> = {
  // Bones that keep the page's shape, hidden from the accessibility tree by the primitive itself.
  loading: { declared: "rendered", by: `${ROUTE}/loading.tsx`, testId: null },
  // A project holding no set says so and teaches the one next action — naming its first one.
  empty: { declared: "rendered", by: `${ROUTE}/sets-index.tsx`, testId: "sets-empty" },
  error: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "the root error boundary is the tree's one error state, and its own Decision rules retry and the report id; this screen holds no queue and no stream that could fail on its own",
  },
  refusal: {
    declared: "rendered",
    by: `${ROUTE}/sets-index.tsx`,
    // The create region's answer slot, through the one renderer (R-UI-020, B-17).
    testId: "refusal-state",
  },
  partial: {
    declared: "impossible",
    why: "this screen's answer arrives in one read and every row of it renders; a set with no pinned revision is shown as unpinned in prose, which is an absence stated rather than a row withheld (I-99)",
  },
  offline: {
    declared: "delegated",
    to: "src/app/error.tsx",
    // I-102: no transfer queue and no event stream here, so s-drawings I-89's condition is absent.
    why: "this screen is drawn on the server and carries no live queue, so an action that cannot reach it is a fault of reachability rather than a state a person is in",
  },
  permissionDenied: {
    declared: "rendered",
    by: `${ROUTE}/sets-index.tsx`,
    // I-101: the workspace membership holds, so the frame stays and the denial is in-frame — every
    // set and every digest still render, because knowledge is not permission.
    testId: "refusal-state",
  },
};
