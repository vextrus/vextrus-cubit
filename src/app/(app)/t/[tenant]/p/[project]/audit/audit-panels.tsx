/**
 * The model-call ledger and job-history panels (R-SPINE-081), each wearing the posture its own live
 * probe answered.
 *
 * A disarmed panel is a state, not a failure: this installation holds no such table yet, and the
 * panel says so in plain words rather than showing an error, a refusal or an empty table pretending
 * the ledger exists. An armed panel shows how many rows it holds and nothing else — the ledger's
 * columns and job detail are the surfaces of the increments that ship those tables.
 */
import { formatUserFigure } from "../../../../../../../core/format";
import type { AuditPanel } from "../../../../../../../modules/spine/audit";
import { auditStrings } from "./strings";

interface PanelBodyProps {
  readonly heading: string;
  readonly headingId: string;
  readonly disarmed: string;
  readonly countCaption: string;
  readonly panel: AuditPanel;
}

/** What stands inside either card. The two cards differ in their copy and in nothing else. */
function PanelBody({ countCaption, disarmed, heading, headingId, panel }: PanelBodyProps) {
  return (
    <>
      <h2 className="cx-audit-section-heading" id={headingId}>
        {heading}
      </h2>
      {panel.armed ? (
        <>
          <p className="cx-audit-panel-count">{formatUserFigure(String(panel.rowCount))}</p>
          <p className="cx-audit-panel-caption">{countCaption}</p>
        </>
      ) : (
        <p className="cx-audit-panel-body">{disarmed}</p>
      )}
    </>
  );
}

/** The posture as the markup carries it, so a journey reads one attribute rather than two states. */
function armed(panel: AuditPanel): "true" | "false" {
  return panel.armed ? "true" : "false";
}

export function AuditPanels({ jobs, modelLedger }: { modelLedger: AuditPanel; jobs: AuditPanel }) {
  return (
    <div className="cx-audit-panels">
      <section aria-labelledby="audit-panel-model-ledger-heading" className="cx-audit-panel" data-armed={armed(modelLedger)} data-testid="audit-panel-model-ledger">
        <PanelBody
          countCaption={auditStrings.audit_ledger_count_caption}
          disarmed={auditStrings.audit_ledger_disarmed}
          heading={auditStrings.audit_ledger_heading}
          headingId="audit-panel-model-ledger-heading"
          panel={modelLedger}
        />
      </section>
      <section aria-labelledby="audit-panel-jobs-heading" className="cx-audit-panel" data-armed={armed(jobs)} data-testid="audit-panel-jobs">
        <PanelBody
          countCaption={auditStrings.audit_jobs_count_caption}
          disarmed={auditStrings.audit_jobs_disarmed}
          heading={auditStrings.audit_jobs_heading}
          headingId="audit-panel-jobs-heading"
          panel={jobs}
        />
      </section>
    </div>
  );
}
