// S-Audit (R-SPINE-081): the project's act log explorer, over the model-ledger and job-history
// panels. The screen is a reader — it asks the module one question and renders the answer.
//
// The module answers the same surfaces shape for a segment that names no project, so a mistyped
// address is an honest absence and never a fault. An absence is not an empty log, though: a full,
// confident act log over a project nobody has says "nothing has happened here yet" about an address
// that does not exist. So the workspace is asked first whether it holds the project at all, through
// the projects module's one door for that question, and an address naming no project of it is
// answered as the absent address it is (R-UI-020, R-UI-050, B-17).
import "./audit.css";

import { notFound } from "next/navigation";
import { getAuditSurfaces } from "../../../../../../../modules/spine/audit";
import { projectHeld } from "../../../../../../../modules/spine/projects";
import { ActLogExplorer } from "./act-log-explorer";
import { AuditPanels } from "./audit-panels";
import { auditStrings } from "./strings";

export const metadata = { title: auditStrings.audit_heading };

export default async function ProjectAudit({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant, project } = await params;
  // Existence decides whether this address is an address at all, so it is asked first and alone: an
  // address naming no project of this workspace is answered as absent without the panels of a
  // project nobody has ever being queried for it.
  if (!(await projectHeld({ tenantId: tenant }, project))) notFound();

  const surfaces = await getAuditSurfaces({ tenantId: tenant }, project);

  return (
    <div className="cx-audit">
      <header className="cx-audit-header">
        <h1 className="cx-audit-heading">{auditStrings.audit_heading}</h1>
        <p className="cx-audit-caption">{auditStrings.audit_caption}</p>
      </header>

      <ActLogExplorer acts={surfaces.acts} />
      <AuditPanels jobs={surfaces.jobs} modelLedger={surfaces.modelLedger} />
    </div>
  );
}
