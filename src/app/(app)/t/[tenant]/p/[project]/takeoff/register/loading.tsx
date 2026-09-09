// R-UI-050's loading leg for the register workspace: bones that keep the page's shape inside the
// frame, which never skeletons — the workspace it shows is resolved before the first paint. The
// bones are the Decision § 2's own: the heading, the row of five filters, and the three regions of
// the body. Never a spinner, and never one on the table (R-UI-004).
import { Skeleton } from "@/ui/primitives/core";

import "./register.css";

/** The bones the Decision § 2 fixes, in the order a reader meets them. */
const HEADING_BONE = { height: "24px", width: "240px" };
const FILTER_BONE = { height: "32px", width: "160px" };
const FILTER_BONES = 5;
const REGION_BONES = [
  { height: "280px", width: "480px" },
  { height: "min(100%, 1080px)", width: "480px" },
  { height: "340px", width: "480px" },
];

export default function LoadingRegister() {
  return (
    <div className="cx-register cx-register-loading" data-state="loading">
      <Skeleton style={HEADING_BONE} />
      <div className="cx-register-filters">
        {Array.from({ length: FILTER_BONES }, (_, index) => (
          <Skeleton key={`filter-${index}`} style={FILTER_BONE} />
        ))}
      </div>
      <div className="cx-register-body">
        {REGION_BONES.map((bone, index) => (
          <Skeleton key={`region-${index}`} style={bone} />
        ))}
      </div>
    </div>
  );
}
