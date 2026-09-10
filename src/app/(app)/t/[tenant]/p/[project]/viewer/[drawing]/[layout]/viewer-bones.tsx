/**
 * The bones a sheet stands in while it is arriving (R-UI-050's loading leg, R-UI-004): the panel's
 * heading over its layer rows, one bone where the sheet itself is drawn, and the cells the inspector
 * will stand in. Never a spinner, and the bones are hidden from the accessibility tree by the
 * primitive itself.
 *
 * Two surfaces show them — the route's own leg before the client mounts, and the client's own while
 * the head is in flight — and they are the same bones, spelled once (B-17).
 */
import type { ReactNode } from "react";
import { REFUSALS } from "@/core/errors";
import type { ViewerHead } from "@/modules/takeoff/viewer";
import { Skeleton } from "@/ui/primitives/core";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { shellHref } from "@/ui/shell";
import { strings } from "@/ui/strings";
import { projectHomeRoute } from "@/app/(app)/t/[tenant]/p/[project]/home/areas";
import { FidelityFacts } from "./fidelity-facts";
import { feedRefusalCode } from "./partition-region";

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

/**
 * What the work area holds when there is no drawn sheet to hold — the three answers that are not a
 * drawing, kept apart from one another as ARCH-03 asks: a door that refused this reader, a reading
 * the sheet could not be drawn from, and a drawing nobody has read yet, which is an absence that
 * teaches rather than an error. The bones above are the fourth: not an answer, but a wait.
 *
 * It lives beside the bones rather than in the screen because it is markup, and the screen is
 * composition (its own shape law): a region's body belongs with its siblings, not in the file whose
 * whole job is to wire hooks together.
 */
export function SheetAbsence({ head, denied, tenantId, projectId }: { head: ViewerHead | null; denied: number | null; tenantId: string; projectId: string }): ReactNode {
  // "Go to the project" lands on the project home the label names, spelled by that screen's own
  // address rather than respelled here (Decision § 2, B-17): the reader already stands inside a
  // project, so the workspace list is not the address this evidence promises (R-UI-020).
  const projectEvidence = { href: projectHomeRoute(tenantId, projectId), label: strings.viewer_evidence_project };
  // The evidence a denied reader can act on is their own workspace, not the signed-out home the
  // label does not promise — a refusal's link lands on the address it names (R-UI-020).
  if (denied !== null) {
    const evidence = denied === 401 ? { href: "/sign-in", label: strings.shell_evidence_sign_in } : { href: shellHref(tenantId, "projects"), label: strings.shell_denied_evidence };
    return (
      <div className="cx-viewer-refusal">
        <RefusalState refusal={REFUSALS[feedRefusalCode(denied)]} evidence={evidence} />
      </div>
    );
  }
  if (head === null) {
    return (
      <div className="cx-viewer-loading" data-testid="viewer-loading">
        <span className="cx-viewer-hidden">{strings.viewer_loading_label}</span>
        <SheetBones />
      </div>
    );
  }
  if (head.kind === "refusal") {
    return (
      <div className="cx-viewer-refusal">
        <RefusalState refusal={head.refusal} evidence={projectEvidence} />
        <FidelityFacts facts={head.facts} />
      </div>
    );
  }
  /* Three truths in the sheet's place, not two, and each states only what is so: a drawing this
     project holds and has not read yet, a drawing id it holds no drawing for at all, and a sheet
     name the reading does not carry. Telling the first two apart is what keeps the screen from
     promising a reading that nothing has started (R-UI-050's empty against its not-found). */
  const reason = head.kind === "absent" ? head.reason : "layout-unknown";
  const empty =
    reason === "not-ingested"
      ? { heading: strings.viewer_empty_unread_heading, body: strings.viewer_empty_unread_body }
      : reason === "drawing-unknown"
        ? { heading: strings.trace_drawing_unknown_heading, body: strings.trace_drawing_unknown_body }
        : { heading: strings.viewer_empty_sheet_heading, body: strings.viewer_empty_sheet_body };
  return (
    <div className="cx-viewer-empty" data-testid="viewer-empty" data-reason={reason}>
      <h2 className="cx-viewer-empty-heading">{empty.heading}</h2>
      <p className="cx-viewer-empty-body">{empty.body}</p>
      <a className="cx-btn cx-reticle cx-viewer-empty-action" data-variant="secondary" href={projectEvidence.href}>
        <span className="cx-btn-label">{projectEvidence.label}</span>
      </a>
    </div>
  );
}
