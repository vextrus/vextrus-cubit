// R-UI-050's loading leg for S-Ask (docs/design/s-ask.md §2): bones that keep the page's shape inside
// the frame — the band as one field bone and one button bone, and the thread as three answer bones.
// Never a spinner (R-UI-004).
import { Skeleton } from "@/ui/primitives/core";

import "./ask.css";

export default function LoadingAsk() {
  return (
    <div className="cx-ask" data-screen-root="" data-state="loading">
      <div className="cx-ask-band">
        <Skeleton className="cx-ask-bone-field" />
        <Skeleton className="cx-ask-bone-button" />
      </div>
      {[0, 1, 2].map((at) => (
        <div key={at} className="cx-ask-bones cx-ask-bones-answer">
          <Skeleton className="cx-ask-bone cx-ask-bone-question" />
          <Skeleton className="cx-ask-bone cx-ask-bone-understood" />
          <Skeleton className="cx-ask-bone" style={{ width: "80%" }} />
          <Skeleton className="cx-ask-bone" style={{ width: "60%" }} />
        </div>
      ))}
    </div>
  );
}
