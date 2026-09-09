// R-UI-050's matrix for S-Viewer, in the one enumerable place a suite reflects over (B-19). A cell
// says one of three things and is never silent: the state is rendered here, it is handed to a module
// outside this screen, or it cannot arise and says why. docs/design/s-viewer.md § 2 rules each cell.
import type { ShellStateCell, ShellStateName } from "@/ui/shell/states";

/** This screen's own home, spelled once: every cell that names a file of it starts here. */
const ROUTE = "src/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]";

export const VIEWER_STATES: Readonly<Record<ShellStateName, ShellStateCell>> = {
  // Two surfaces of bones: the route's own before the client mounts, and the client's own while the
  // head is in flight — both keep the sheet's shape, and neither spins. The snapping region adds no
  // third: its toolbar is local state, so it mounts with the stage and is operable at once, while its
  // two readout cells stand honestly at nothing-in-reach and no-picks (I-148).
  // The scale panel adds a third surface of the same kind and no fourth state: while its door is in
  // flight the tab holds three row-shaped groups of bones under `data-state="loading"`, and the sheet
  // beside it is untouched (s-scale § 2).
  loading: { declared: "rendered", by: `${ROUTE}/loading.tsx`, testId: "viewer-loading" },
  // Two truths in the sheet's place, chosen by cause: a drawing nobody has read yet, and an address
  // naming a sheet the reading does not carry. Each teaches the next action and neither is an error.
  // Neither mounts a stage, so the snap toolbar, its overlay and its cells do not render either.
  // The scale panel is never blank either: a sheet with no stored partition is the door's registered
  // PARTITION_NOT_AVAILABLE, said in the answer slot in the body's place with the drawings screen as
  // its evidence — the list says why it is empty (R-UI-020, s-scale § 2).
  empty: { declared: "rendered", by: `${ROUTE}/viewer-screen.tsx`, testId: "viewer-empty" },
  error: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "the root error boundary is the tree's one error state, and its own Decision rules retry and the report id; only a head that cannot be read at all reaches it, because a layer that fails to arrive is the partial cell (I-81), as is a scale of record that could not be read (I-150) — that costs the reader metres, never the sheet. The scale door is the same bargain kept in one more place: a read that faults leaves the panel at `data-state=\"failed\"`, where `viewer-scale-retry` re-reads it in place beside the report id the fault travelled with, and the drawing is not torn down for it (s-scale § 2)",
  },
  // The registered refusal, in the sheet's place, with the facts the reading did record beside it.
  // The calibration door refuses the sheet's own session, so its two codes render here too (I-150).
  // The scale panel's own three doors refuse into its answer slot through the same one renderer —
  // a refusal of a scale is a refusal of that panel, never of the sheet (R-UI-020, I-156).
  refusal: { declared: "rendered", by: `${ROUTE}/viewer-screen.tsx`, testId: "refusal-state" },
  // Two partials, both rendered, neither withdrawing the sheet that did arrive. I-81: a layer whose
  // geometry did not arrive keeps its row, says so, and offers to fetch itself again. I-150: a scale
  // of record the feed could not answer leaves the drawing-unit figure standing in
  // `status-line.tsx`'s distance cell and names the move, because that cell holds no control.
  // I-155: an observation the drawing's own evidence does not corroborate within the edition's
  // tolerance keeps its row in `scale-region.tsx` and says it is unverified — the span and the factor
  // are facts — and a view no act names keeps its row, its absence sentence and its checkbox there
  // too: shown, never hidden, and the rows beside it are unaffected.
  partial: { declared: "rendered", by: `${ROUTE}/layers-panel.tsx`, testId: "viewer-layer-row" },
  // The sheet still writes nothing, and reading, picking and judging an observation are wholly local
  // (shell I-20): geometry already in the GPU buffers keeps painting, and no banner is raised over a
  // reader who has lost nothing. What this screen now HAS is one act, so the one thing that cannot be
  // done offline says so where it was pressed: Affirm opens no dialog and the answer slot holds
  // `viewer_scale_offline` as an alert (s-scale § 2).
  offline: { declared: "rendered", by: `${ROUTE}/scale-region.tsx`, testId: "viewer-scale-answer" },
  permissionDenied: {
    declared: "delegated",
    to: "src/app/(app)/t/[tenant]/layout.tsx",
    why: "the workspace guard renders the frameless denial before this route mounts, and redirects an ended session to /sign-in; the layer feed answers the same two registered codes mid-session, rendered by the one RefusalState in the sheet's place. Affirming a scale needs MEASURE on top of membership, and a member without it is not turned away: the scale panel stands at `data-state=\"denied\"` with every row, proposal and readout kept and only the checkboxes, the two-point tool and the affirm footer gone, over the registered PERMISSION_NOT_HELD in its answer slot (s-drawings I-90, s-scale § 2)",
  },
};
