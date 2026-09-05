// R-UI-050's matrix for the set browser, in the one enumerable place a suite reflects over (B-19).
// A cell says one of three things and is never silent: the state is rendered here, it is handed to
// a module outside this screen, or it cannot arise on this screen and says why.
import type { ShellStateCell, ShellStateName } from "../../../../../../../../../ui/shell/states";

/** This screen's own home, spelled once: every cell that names a file of it starts here. */
const ROUTE = "src/app/(app)/t/[tenant]/p/[project]/drawings/sets/[set]";

export const SET_BROWSER_STATES: Readonly<Record<ShellStateName, ShellStateCell>> = {
  loading: { declared: "rendered", by: `${ROUTE}/loading.tsx`, testId: null },
  // I-97: three causes, one element, in a fixed precedence — no drawings to name, nothing pinned
  // yet, or a set that names nothing now.
  empty: { declared: "rendered", by: `${ROUTE}/set-browser.tsx`, testId: "set-empty" },
  error: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "the root error boundary is the tree's one error state, and its own Decision rules retry and the report id; a refusal this screen can answer is not an error of it",
  },
  refusal: {
    declared: "rendered",
    by: `${ROUTE}/set-browser.tsx`,
    // The one renderer serves both answer slots — the members region's and the pin region's — and
    // the dialog's own once it holds focus (R-UI-020, B-17, I-103).
    testId: "refusal-state",
  },
  partial: {
    declared: "rendered",
    by: `${ROUTE}/set-browser.tsx`,
    // I-98: a pinned revision cites every member it held, including a drawing the set no longer
    // names and a revision since superseded — shown exactly as pinned, never recomputed.
    testId: "set-revision-member",
  },
  offline: {
    declared: "delegated",
    to: "src/app/error.tsx",
    // I-102: no transfer queue and no event stream here, so s-drawings I-89's condition is absent.
    why: "this screen is drawn on the server and carries no live queue, so an action that cannot reach it is a fault of reachability rather than a state a person is in",
  },
  permissionDenied: {
    declared: "rendered",
    by: `${ROUTE}/set-browser.tsx`,
    // I-101: the browser stands whole for a reader without PIN_SET — every member, every pinned
    // revision and every digest — while the doors that could only refuse do not render.
    testId: "refusal-state",
  },
};
