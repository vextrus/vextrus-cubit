"use client";
/**
 * The model ledger's own reading of itself (I-37; L-AI-01, L-AI-02, R-AI-005): the newest calls as a
 * 28 px grid — each with the question it put, the model and transport, its outcome as the ledger and
 * then a person spelled it, the provider's confidence, the tokens and the cost — and beneath it one
 * calibration line per question, read over the same rows the grid shows.
 *
 * Ids render through IdChip and enums through EnumLabel (R-UI-060 as the craft rubric reads it):
 * nothing here writes a raw identifier as body text. Copy is the screen's own (`strings.ts`, I-24);
 * the question name and the model id are model data and render verbatim in mono (I-25).
 */
import type { ColumnDef } from "@tanstack/react-table";
import { formatUserFigure } from "@/core/format";
import type { CalibrationLine } from "@/core/model-calibration";
import { EnumLabel, IdChip } from "@/ui/primitives/core";
import { DataTable } from "@/ui/primitives/data";
import { fill } from "@/ui/strings";
import { TESTIDS } from "@/ui/testids";
import { auditStrings } from "./strings";

/** One call as the grid takes it — every field a string or a number, so the row crosses the server boundary whole. */
export interface AuditLedgerRow {
  readonly callId: string;
  readonly modelId: string;
  readonly question: string | null;
  readonly transport: string;
  readonly outcome: string;
  readonly refusalCode: string | null;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly attributedCost: string;
  readonly confidence: string | null;
  readonly judged: string | null;
  /** The day the call was made, already rendered by the format seam (I-34). */
  readonly calledOn: string;
}

const LEDGER_TABLE_ID = "audit-ledger";

/** How the ledger spells a call the transport or the seam refused. */
const REFUSED = "refused";

/**
 * The outcome cell: a person's judgment where one stands, the refusal where the call was refused,
 * and the awaiting copy where a proposal still waits — each a different kind of fact, and only the
 * first two enums.
 */
function OutcomeCell({ row }: { row: AuditLedgerRow }) {
  if (row.judged !== null) return <EnumLabel value={row.judged} />;
  if (row.outcome === REFUSED && row.refusalCode !== null) return <EnumLabel value={row.refusalCode} />;
  return <span className="cx-audit-ledger-awaiting">{auditStrings.audit_ledger_outcome_awaiting}</span>;
}

const COLUMNS: ColumnDef<AuditLedgerRow, unknown>[] = [
  { id: "call", header: auditStrings.audit_ledger_col_call, size: 120, cell: ({ row }) => <IdChip value={row.original.callId} /> },
  {
    id: "question",
    header: auditStrings.audit_ledger_col_question,
    size: 150,
    cell: ({ row }) => <span className="cx-audit-ledger-mono">{row.original.question ?? ""}</span>,
  },
  { id: "model", header: auditStrings.audit_ledger_col_model, size: 150, cell: ({ row }) => <span className="cx-audit-ledger-mono">{row.original.modelId}</span> },
  { id: "transport", header: auditStrings.audit_ledger_col_transport, size: 100, cell: ({ row }) => <EnumLabel value={row.original.transport} /> },
  { id: "outcome", header: auditStrings.audit_ledger_col_outcome, size: 180, cell: ({ row }) => <OutcomeCell row={row.original} /> },
  {
    id: "confidence",
    header: auditStrings.audit_ledger_col_confidence,
    size: 110,
    meta: { align: "right" },
    cell: ({ row }) => <span className="cx-audit-ledger-mono">{row.original.confidence ?? auditStrings.audit_ledger_no_confidence}</span>,
  },
  {
    id: "tokens",
    header: auditStrings.audit_ledger_col_tokens,
    size: 140,
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="cx-audit-ledger-mono">
        {formatUserFigure(String(row.original.inputTokens))} / {formatUserFigure(String(row.original.outputTokens))}
      </span>
    ),
  },
  { id: "cost", header: auditStrings.audit_ledger_col_cost, size: 110, meta: { align: "right" }, cell: ({ row }) => <span className="cx-audit-ledger-mono">{formatUserFigure(row.original.attributedCost)}</span> },
  { id: "called", header: auditStrings.audit_ledger_col_called, size: 120, cell: ({ row }) => <span className="cx-audit-ledger-mono">{row.original.calledOn}</span> },
];

/** The confidence clause of one line: both means, one of them, or none — never a figure over nothing. */
function confidenceClause(line: CalibrationLine): string {
  if (line.meanConfidenceWhenRight !== null && line.meanConfidenceWhenWrong !== null) {
    return fill(auditStrings.audit_ledger_calibration_confidence, { right: line.meanConfidenceWhenRight, wrong: line.meanConfidenceWhenWrong });
  }
  const stated = line.meanConfidenceWhenRight ?? line.meanConfidenceWhenWrong;
  if (stated !== null) return fill(auditStrings.audit_ledger_calibration_confidence_partial, { stated });
  return auditStrings.audit_ledger_calibration_no_confidence;
}

export function AuditLedger({ calls, calibration, headingId }: { calls: readonly AuditLedgerRow[]; calibration: readonly CalibrationLine[]; headingId: string }) {
  return (
    <div className="cx-audit-ledger">
      <div className="cx-audit-ledger-grid" data-testid={TESTIDS.audit.ledgerGrid} data-rows={calls.length}>
        <DataTable
          tableId={LEDGER_TABLE_ID}
          aria-labelledby={headingId}
          columns={COLUMNS}
          data={[...calls]}
          getRowId={(row) => row.callId}
          rowTestId={TESTIDS.audit.ledgerRow}
          rowDataOf={(row) => ({ "data-call": row.callId, "data-question": row.question ?? "", "data-judged": row.judged ?? "" })}
        />
      </div>
      <dl className="cx-audit-calibration" data-testid={TESTIDS.audit.ledgerCalibration}>
        <dt className="cx-audit-calibration-heading">{auditStrings.audit_ledger_calibration_heading}</dt>
        {calibration.map((line) => (
          <dd className="cx-audit-calibration-line" data-question={line.question} data-testid={TESTIDS.audit.ledgerCalibrationLine} key={line.question}>
            <span className="cx-audit-calibration-question">{line.question}</span>
            <span className="cx-audit-calibration-counts">
              {fill(auditStrings.audit_ledger_calibration_counts, {
                proposed: formatUserFigure(String(line.proposed)),
                confirmed: formatUserFigure(String(line.confirmed)),
                overruled: formatUserFigure(String(line.overruled)),
                repudiated: formatUserFigure(String(line.repudiated)),
                affirmed: formatUserFigure(String(line.affirmed)),
                awaiting: formatUserFigure(String(line.awaiting)),
                refused: formatUserFigure(String(line.refused)),
              })}
            </span>
            <span className="cx-audit-calibration-confidence">{confidenceClause(line)}</span>
          </dd>
        ))}
      </dl>
    </div>
  );
}
