// R-UI-050's matrix for S-Viewer, in the one enumerable place a suite reflects over (B-19). A cell
// says one of three things and is never silent: the state is rendered here, it is handed to a module
// outside this screen, or it cannot arise and says why. docs/design/s-viewer.md § 2 rules each cell.
import type { ShellStateCell, ShellStateName } from "../../../../../../../../../ui/shell/states";

/** This screen's own home, spelled once: every cell that names a file of it starts here. */
const ROUTE = "src/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]";

export const VIEWER_STATES: Readonly<Record<ShellStateName, ShellStateCell>> = {
  // Two surfaces of bones: the route's own before the client mounts, and the client's own while the
  // head is in flight — both keep the sheet's shape, and neither spins.
  loading: { declared: "rendered", by: `${ROUTE}/loading.tsx`, testId: "viewer-loading" },
  // Two truths in the sheet's place, chosen by cause: a drawing nobody has read yet, and an address
  // naming a sheet the reading does not carry. Each teaches the next action and neither is an error.
  empty: { declared: "rendered", by: `${ROUTE}/viewer-screen.tsx`, testId: "viewer-empty" },
  error: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "the root error boundary is the tree's one error state, and its own Decision rules retry and the report id; only a head that cannot be read at all reaches it, because a layer that fails to arrive is the partial cell (I-81)",
  },
  // The registered refusal, in the sheet's place, with the facts the reading did record beside it.
  refusal: { declared: "rendered", by: `${ROUTE}/viewer-screen.tsx`, testId: "refusal-state" },
  // I-81: a layer whose geometry did not arrive keeps its row, says so, and offers to fetch itself
  // again; the sheet that did arrive is not withdrawn because part of it is missing.
  partial: { declared: "rendered", by: `${ROUTE}/layers-panel.tsx`, testId: "viewer-layer-row" },
  offline: {
    declared: "impossible",
    why: "the viewer writes nothing, so there is no read-only degradation to announce (shell I-20). Losing the network mid-load is the partial cell, losing it before the head is the error cell, and geometry already in the GPU buffers keeps painting",
  },
  permissionDenied: {
    declared: "delegated",
    to: "src/app/(app)/t/[tenant]/layout.tsx",
    why: "the workspace guard renders the frameless denial before this route mounts, and redirects an ended session to /sign-in; the layer feed answers the same two registered codes mid-session, rendered by the one RefusalState in the sheet's place",
  },
};
