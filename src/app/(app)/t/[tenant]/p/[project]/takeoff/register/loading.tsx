// R-UI-050's loading leg for the register workspace: bones that keep the page's shape inside the
// frame, which never skeletons — the workspace it shows is resolved before the first paint. The
// bones are the Design Direction §3.2 regions this screen in fact has: the 36 px bar of five filter
// chips, then the index rail beside the field the grid takes. Never a spinner, and never one on the
// table (R-UI-004), and never a bone for a region that is absent at rest — the tabs row is the
// frame's own track and the inspector is absent until something is selected (R-UI-080).
import { Skeleton } from "@/ui/primitives/core";

import "./register.css";

/** The bones, in the order a reader meets them. */
const FILTER_BONE = { height: "28px", width: "128px" };
const FILTER_BONES = 5;
const COUNT_BONE = { height: "28px", width: "96px", marginLeft: "auto" };
const RAIL_BONE = { height: "100%", width: "240px" };
const GRID_BONE = { height: "100%", width: "100%" };

export default function LoadingRegister() {
  return (
    <div className="cx-register cx-register-loading" data-state="loading">
      <div className="cx-register-filters">
        {Array.from({ length: FILTER_BONES }, (_, index) => (
          <Skeleton key={`filter-${index}`} style={FILTER_BONE} />
        ))}
        <Skeleton style={COUNT_BONE} />
      </div>
      <div className="cx-register-body">
        <Skeleton style={RAIL_BONE} />
        <Skeleton style={GRID_BONE} />
      </div>
    </div>
  );
}
