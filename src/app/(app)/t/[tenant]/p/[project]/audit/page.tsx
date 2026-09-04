// S-Audit (R-SPINE-081): the project's act log explorer, over the model-ledger and job-history
// panels. The screen is a reader — it asks the module one question and renders the answer.
//
// The tenant segment is passed on as it arrives. The project segment is not: the module answers the
// same surfaces shape for a segment that names no project, so rendering it unchecked would give a
// complete, confident screen reporting that a project which does not exist has no acts — a screen
// telling a falsehood politely. An address naming no project of this workspace is a not-found.
import "./audit.css";

import { notFound } from "next/navigation";
import { getAuditSurfaces } from "../../../../../../../modules/spine/audit";
import { projectsForHome } from "../../../../../../../modules/spine/projects";
import { ActLogExplorer } from "./act-log-explorer";
import { AuditPanels } from "./audit-panels";
import { auditStrings } from "./strings";

export const metadata = { title: auditStrings.audit_heading };

/** The account the roster read below is made for: none — see `holdsProject`. */
const NO_ACTOR = "";

/**
 * Whether this address names a project of this workspace. The roster is the module's own answer,
 * never re-derived here (B-19), and it includes archived projects — archiving hides a project, it
 * does not erase its history, so an archived project still has an audit page.
 *
 * The read is the workspace's, not an account's: `projectsForHome` scopes by tenant and the store's
 * row security carries that scope on every statement. Whether the reader holds this workspace at
 * all is the frame layout's guard, already spent before this screen renders (I-77), so no account
 * is acting here and the context's actor field names none.
 */
async function holdsProject(tenantId: string, projectId: string): Promise<boolean> {
  const held = await projectsForHome({ tenantId, userId: NO_ACTOR });
  return held.some((project) => project.projectId === projectId);
}

export default async function ProjectAudit({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant, project } = await params;
  if (!(await holdsProject(tenant, project))) notFound();

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
