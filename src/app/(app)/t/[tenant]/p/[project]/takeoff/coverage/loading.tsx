// R-UI-050's loading leg for the coverage grid: bones that keep the page's shape inside the frame,
// which never skeletons — the reading it shows is resolved before the first paint. The bones are the
// Decision § 2's own: the heading, the grid, the inspector beside it, and the certificate preview
// beneath. Never a spinner (R-UI-004).
import { Skeleton } from "@/ui/primitives/core";

import "./coverage.css";

/** The bones the Decision § 2 fixes, in the order a reader meets them. */
const HEADING_BONE = { height: "24px", width: "240px" };
const GRID_BONE = { height: "min(100%, 720px)", width: "480px" };
const INSPECTOR_BONE = { height: "280px", width: "340px" };
const PREVIEW_BONE = { height: "200px", width: "480px" };

export default function LoadingCoverage() {
  return (
    <div className="cx-coverage cx-coverage-loading" data-state="loading">
      <Skeleton style={HEADING_BONE} />
      <div className="cx-coverage-body">
        <Skeleton style={GRID_BONE} />
        <Skeleton style={INSPECTOR_BONE} />
      </div>
      <Skeleton style={PREVIEW_BONE} />
    </div>
  );
}
