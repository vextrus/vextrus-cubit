/**
 * The bones a sheet stands in while it is arriving (R-UI-050's loading leg, R-UI-004): the panel's
 * heading over its layer rows, one bone where the sheet itself is drawn, and the cells the inspector
 * will stand in. Never a spinner, and the bones are hidden from the accessibility tree by the
 * primitive itself.
 *
 * Two surfaces show them — the route's own leg before the client mounts, and the client's own while
 * the head is in flight — and they are the same bones, spelled once (B-17).
 */
import { Skeleton } from "@/ui/primitives/core";

/** The rows the panel's bones stand for, before the roster says how many there really are. */
const PANEL_ROWS = 6;

/** The cells the inspector's bones stand for, before anything is under the pointer or held. */
const INSPECTOR_CELLS = 2;

export function SheetBones() {
  return (
    <>
      <div className="cx-viewer-bones-panel">
        <Skeleton style={{ height: "16px", width: "96px" }} />
        {Array.from({ length: PANEL_ROWS }, (_, row) => (
          <Skeleton key={row} style={{ height: "var(--row-comfortable)", width: "100%" }} />
        ))}
      </div>
      <Skeleton style={{ height: "100%", width: "100%" }} />
      {/* Bones where the inspector will stand: telling a reader to hover an entity before any
          exists is a lie about readiness (Decision § 2). */}
      <div className="cx-viewer-bones-panel">
        <Skeleton style={{ height: "16px", width: "96px" }} />
        {Array.from({ length: INSPECTOR_CELLS }, (_, cell) => (
          <Skeleton key={cell} style={{ height: "12px", width: "140px" }} />
        ))}
      </div>
    </>
  );
}
