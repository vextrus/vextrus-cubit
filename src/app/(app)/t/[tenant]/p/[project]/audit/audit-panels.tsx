/**
 * The model-call ledger and job-history panels (R-SPINE-081), each wearing the posture its own live
 * probe answered.
 *
 * A disarmed panel is a state, not a failure: this installation holds no such table yet, and the
 * panel says so in plain words rather than showing an error, a refusal or an empty table pretending
 * the ledger exists. An armed panel shows how many rows it holds; the model ledger's, where it holds
 * any, then lists the newest calls with their outcomes and one calibration line per question (I-37;
 * L-AI-01, L-AI-02) — the ledger's columns are the ledger's own surface now. Job detail stays with
 * the node that owns those tables (C-SPINE-JOBS).
 */
import { dhakaDateParts, formatDate, formatUserFigure } from "@/core/format";
import type { AuditLedger as AuditLedgerRead, AuditPanel } from "@/modules/spine/audit";
import { AuditLedger, type AuditLedgerRow } from "./audit-ledger";
import { auditStrings } from "./strings";
import { TESTIDS } from "@/ui/testids";

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

/** One ledger call as the client grid takes it: the day rendered here, on the server, by the format seam (I-34). */
function ledgerRowOf(call: AuditLedgerRead["calls"][number]): AuditLedgerRow {
  return {
    callId: call.callId,
    modelId: call.modelId,
    question: call.question,
    transport: call.transport,
    outcome: call.outcome,
    refusalCode: call.refusalCode,
    inputTokens: call.inputTokens,
    outputTokens: call.outputTokens,
    attributedCost: call.attributedCost,
    confidence: call.confidence,
    judged: call.judged,
    calledOn: formatDate(dhakaDateParts(call.calledAt)),
  };
}

const LEDGER_HEADING_ID = "audit-panel-model-ledger-heading";

export function AuditPanels({ jobs, ledger, modelLedger }: { modelLedger: AuditPanel; jobs: AuditPanel; ledger: AuditLedgerRead }) {
  const lists = modelLedger.armed && ledger.calls.length > 0;
  return (
    <div className="cx-audit-panels">
      <section
        aria-labelledby={LEDGER_HEADING_ID}
        className={lists ? "cx-audit-panel cx-audit-panel-ledger" : "cx-audit-panel"}
        data-armed={armed(modelLedger)}
        data-rows={ledger.calls.length}
        data-testid={TESTIDS.audit.panelModelLedger}
      >
        <PanelBody
          countCaption={auditStrings.audit_ledger_count_caption}
          disarmed={auditStrings.audit_ledger_disarmed}
          heading={auditStrings.audit_ledger_heading}
          headingId={LEDGER_HEADING_ID}
          panel={modelLedger}
        />
        {lists ? <AuditLedger calibration={ledger.calibration} calls={ledger.calls.map(ledgerRowOf)} headingId={LEDGER_HEADING_ID} /> : null}
      </section>
      <section aria-labelledby="audit-panel-jobs-heading" className="cx-audit-panel" data-armed={armed(jobs)} data-testid={TESTIDS.audit.panelJobs}>
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
