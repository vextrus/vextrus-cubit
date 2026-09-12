// R-UI-050's loading leg for the coverage grid: bones that keep the page's shape inside the frame,
// which never skeletons — the reading it shows is resolved before the first paint. The bones are the
// Decision § 2's own, in the order a reader meets them: the key line, the matrix that takes the rest
// of main, and the certificate beneath. Never a spinner (R-UI-004).
import { Skeleton } from "@/ui/primitives/core";

import "./coverage.css";

/** The bones the Decision § 2 fixes. The matrix takes what is left, exactly as it does when read. */
const KEY_BONE = { height: "var(--row-h)", width: "100%" };
const GRID_BONE = { height: "100%", width: "100%" };
const TALLY_BONE = { height: "var(--row-h)", width: "100%" };
const PREVIEW_BONE = { height: "var(--cx-coverage-doc-h)", width: "100%" };

export default function LoadingCoverage() {
  return (
    <div className="cx-coverage" data-state="loading">
      <div className="cx-coverage-work">
        <Skeleton style={KEY_BONE} />
        <Skeleton style={GRID_BONE} />
        <Skeleton style={TALLY_BONE} />
      </div>
      <Skeleton style={PREVIEW_BONE} />
    </div>
  );
}
