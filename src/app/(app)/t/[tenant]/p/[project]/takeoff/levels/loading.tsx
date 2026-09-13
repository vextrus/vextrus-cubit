// R-UI-050's loading leg for the level stack: bones that keep the page's shape inside the frame,
// which never skeletons — the workspace it shows is resolved before the first paint. The bones are
// the Design Decision §2 regions this screen in fact has: the 240 px index rail beside the field the
// grid takes. Never a spinner, and never one on a table (R-UI-004), and never a bone for a region
// that is absent at rest — the tabs row is the frame's own track and the inspector is absent until a
// level is selected (R-UI-080).
import { Skeleton } from "@/ui/primitives/core";

import "./levels.css";

/** The bones, in the order a reader meets them. */
const RAIL_BONE = { height: "100%", width: "240px" };
const GRID_BONE = { height: "100%", width: "100%" };

export default function LoadingLevels() {
  return (
    <div className="cx-levels cx-levels-loading" data-state="loading">
      <div className="cx-levels-body">
        <Skeleton style={RAIL_BONE} />
        <Skeleton style={GRID_BONE} />
      </div>
    </div>
  );
}
