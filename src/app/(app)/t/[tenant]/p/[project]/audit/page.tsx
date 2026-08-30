// S-Audit (R-SPINE-081): the project's act log explorer, over the model-ledger and job-history
// panels. The screen is a reader — it asks the module one question and renders the answer.
//
// The two address segments are passed on as they arrive: the module answers the same surfaces shape
// for a segment that names no project, so a mistyped address is an honest absence and never a fault.
import "./audit.css";

import { getAuditSurfaces } from "../../../../../../../modules/spine/audit";
import { ActLogExplorer } from "./act-log-explorer";
import { AuditPanels } from "./audit-panels";
import { auditStrings } from "./strings";

export const metadata = { title: auditStrings.audit_heading };

export default async function ProjectAudit({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant, project } = await params;
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
