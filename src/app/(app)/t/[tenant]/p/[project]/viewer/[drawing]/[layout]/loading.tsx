// R-UI-050's loading leg for S-Viewer: bones in the shape the sheet will take — the panel's heading
// over six layer rows, and one bone where the sheet itself is drawn. Never a spinner (R-UI-004), and
// the bones are hidden from the accessibility tree by the primitive itself.
import { Skeleton } from "../../../../../../../../../ui/primitives/core";

/** The rows the panel's bones stand for, before the roster says how many there really are. */
const PANEL_ROWS = 6;

export default function ViewerSheetLoading() {
  return (
    <div className="cx-viewer cx-viewer-bones">
      <div className="cx-viewer-bones-panel">
        <Skeleton style={{ height: "16px", width: "96px" }} />
        {Array.from({ length: PANEL_ROWS }, (_, row) => (
          <Skeleton key={row} style={{ height: "var(--row-comfortable)", width: "100%" }} />
        ))}
      </div>
      <Skeleton style={{ height: "100%", width: "100%" }} />
    </div>
  );
}
