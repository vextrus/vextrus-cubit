// S-Audit (R-SPINE-081): the project's act log explorer, over the model-ledger and job-history
// panels. The screen is a reader — it asks the module one question and renders the answer.
//
// The module answers the same surfaces shape for a segment that names no project, so a mistyped
// address is an honest absence and never a fault. An absence is not an empty log, though: a full,
// confident act log over a project nobody has says "nothing has happened here yet" about an address
// that does not exist. So the segment is measured against the workspace's own roster first, and an
// address naming no project of it is answered as the absent address it is (R-UI-020, R-UI-050).
import "./audit.css";

import { notFound } from "next/navigation";
import { getAuditSurfaces } from "../../../../../../../modules/spine/audit";
import { projectsForHome } from "../../../../../../../modules/spine/projects";
import { ActLogExplorer } from "./act-log-explorer";
import { AuditPanels } from "./audit-panels";
import { auditStrings } from "./strings";

export const metadata = { title: auditStrings.audit_heading };

export default async function ProjectAudit({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant, project } = await params;
  // Both reads are tenant-scoped and independent, so they travel together: the roster decides
  // whether this address exists at all, and the surfaces are what it shows once it does.
  const [roster, surfaces] = await Promise.all([rosterOf(tenant), getAuditSurfaces({ tenantId: tenant }, project)]);
  if (!roster.some((held) => held.projectId === project)) notFound();

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

/**
 * The workspace's projects, as the roster this address is measured against. It is a tenant-scoped
 * read — SEAM-TENANT bounds it by `forTenant({ tenantId })` alone — and the frame above this screen
 * has already admitted the session to this workspace, so the question here is about the address and
 * not about the reader. The projects module's door shape carries the account its writes need; this
 * read is asked with none, and reads none.
 */
async function rosterOf(tenantId: string): Promise<readonly { projectId: string }[]> {
  return projectsForHome({ tenantId, userId: "" });
}
