// The Trace, both ways (R-UI-022, R-TO-011, X-2): from a published quantity line to the entities it
// was read at, and from a held selection back to the lines that cite it.
//
// One reading, two doors (ARCH-02): the tRPC lane and the viewer route's server actions both come
// through here, and neither re-derives what a line cites or how the two addresses are spelled. The
// spelling lives here rather than in either screen because the register composes the viewer's
// address and the viewer composes the register's — a rule each of them would otherwise hold a copy
// of (B-17).
//
// Nothing here judges. A lineId this project does not hold is a fact and answers `null`; a key
// nobody cites answers the empty list. No refusal code is invented for either (I-88's idiom).
//
// The two addresses and the reading of what a line cites live in `./address.ts` and are re-published
// here, so this barrel stays the one home the test contract names while a browser component may
// reach the spelling without carrying the store into its bundle (ARCH-01's spirit, B-17).
import { and, asc, eq, forTenant, isUuid, quantityLines, sheetDisciplines } from "@/core/db";
import { citedKeysOf, type LineBinding, type LineEvidence } from "./address";
import { repudiatedObjectsOf } from "@/modules/takeoff/register";

export { LINE_PARAM, citedKeysOf, originAddress, traceAddress } from "./address";
export type { AddressableLine, LineBinding, LineEvidence } from "./address";

/**
 * The layout a sheet is addressed at where the ingest recorded no single one for it. No store ties a
 * partition view to a layout today, so the resolution is: the one layout a confirmation recorded for
 * this drawing, else model space (recorded as an IOU in docs/design/s-viewer-inspector.md § 8).
 */
const MODEL_SPACE = "Model";

/** Which project's lines are being traced, in which workspace — the register's own scope. */
export type TraceScope = {
  readonly tenantId: string;
  readonly projectId: string;
};

/** What the other direction is asked: which sheet, and which of its keys are held. */
export type CitingAsk = {
  readonly drawingId: string;
  readonly sourceKeys: readonly string[];
};

/* --------------------------------------------------------------------------------- the doors */

/**
 * The layout a drawing's evidence is addressed at. One confirmation recorded for the drawing names
 * its sheet; anything else — none recorded, or several — is model space, which is where a reading
 * with no paper layout was in fact taken.
 */
export async function sheetOfView(scope: TraceScope, drawingId: string): Promise<string> {
  if (!isUuid(drawingId)) return MODEL_SPACE;
  const rows = await forTenant({ tenantId: scope.tenantId }).transaction((tx) =>
    tx
      .select({ layoutName: sheetDisciplines.layoutName })
      .from(sheetDisciplines)
      .where(and(eq(sheetDisciplines.tenantId, scope.tenantId), eq(sheetDisciplines.projectId, scope.projectId), eq(sheetDisciplines.drawingId, drawingId))),
  );
  const recorded = [...new Set(rows.map((row) => row.layoutName))];
  return recorded.length === 1 ? (recorded[0] as string) : MODEL_SPACE;
}

/**
 * One line's whole evidence, or nothing. A lineId nobody published, one of another project, one of
 * another tenant and a value that is no id at all all answer `null` — the Trace's missing cell is a
 * fact about the address, never a fault and never a registered refusal (I-88's idiom).
 */
export async function lineEvidence(scope: TraceScope, lineId: string): Promise<LineEvidence | null> {
  if (!isUuid(lineId) || !isUuid(scope.projectId) || !isUuid(scope.tenantId)) return null;
  const rows = await forTenant({ tenantId: scope.tenantId }).transaction((tx) =>
    tx
      .select()
      .from(quantityLines)
      .where(and(eq(quantityLines.tenantId, scope.tenantId), eq(quantityLines.projectId, scope.projectId), eq(quantityLines.lineId, lineId)))
      .limit(1),
  );
  const row = rows[0];
  if (row === undefined) return null;
  return evidenceOf(row, await sheetOfView(scope, row.drawingId));
}

/**
 * The other direction of X-2: every published line of that sheet whose cited keys meet the held
 * selection, each line once however many of its keys match, in the order the store published them.
 *
 * A line measured off an object a person has struck is not answered: it is withheld from the
 * register's own table too, and a way back to a row nobody can see is no way back (I-173).
 */
export async function linesCiting(scope: TraceScope, ask: CitingAsk): Promise<LineEvidence[]> {
  if (ask.sourceKeys.length === 0 || !isUuid(ask.drawingId) || !isUuid(scope.projectId) || !isUuid(scope.tenantId)) return [];
  const rows = await forTenant({ tenantId: scope.tenantId }).transaction((tx) =>
    tx
      .select()
      .from(quantityLines)
      .where(and(eq(quantityLines.tenantId, scope.tenantId), eq(quantityLines.projectId, scope.projectId), eq(quantityLines.drawingId, ask.drawingId)))
      .orderBy(asc(quantityLines.publishedAt), asc(quantityLines.lineId)),
  );
  if (rows.length === 0) return [];

  const asked = new Set(ask.sourceKeys);
  const layoutName = await sheetOfView(scope, ask.drawingId);
  const held = rows.map((row) => evidenceOf(row, layoutName)).filter((line) => line.sourceKeys.some((key) => asked.has(key)));
  if (held.length === 0) return [];

  const struck = await struckObjects(scope, [...new Set(rows.map((row) => row.setRevisionId))]);
  return held.filter((line) => !struck.has(line.objectKey));
}

/* ---------------------------------------------------------------------------------- composing */

/**
 * The variables a published line carries, as a screen states them — the one home of that reading,
 * shared by the register's table and the Trace's block (B-17). `bindings` is stored as the rail
 * wrote it, so what is not a reading of a value and a unit is not shown as one.
 */
export function variablesOf(bindings: Record<string, unknown>): Record<string, LineBinding> {
  const held: Record<string, LineBinding> = {};
  for (const [name, raw] of Object.entries(bindings)) {
    if (typeof raw !== "object" || raw === null) continue;
    const binding = raw as { value?: unknown; unit?: unknown; basis?: unknown; source?: unknown; canonical?: { value?: unknown; unit?: unknown } };
    if (typeof binding.value !== "string" || typeof binding.unit !== "string") continue;
    held[name] = {
      value: binding.value,
      unit: binding.unit,
      basis: typeof binding.basis === "string" ? binding.basis : "",
      source: typeof binding.source === "string" ? binding.source : "",
      canonical: {
        value: typeof binding.canonical?.value === "string" ? binding.canonical.value : binding.value,
        unit: typeof binding.canonical?.unit === "string" ? binding.canonical.unit : binding.unit,
      },
    };
  }
  return held;
}

/** One stored line as the Trace answers it — the register's own reading of it, plus its sheet. */
function evidenceOf(row: typeof quantityLines.$inferSelect, layoutName: string): LineEvidence {
  const variables = variablesOf(row.bindings);
  return {
    lineId: row.lineId,
    objectKey: row.objectKey,
    kind: row.kind,
    value: row.value,
    unit: row.unit,
    drawingId: row.drawingId,
    layoutName,
    sourceKeys: citedKeysOf({ sourceKey: row.viewKey, variables }),
    formula: row.formula,
    variables,
    quantityBasis: row.quantityBasis,
    selectionBasis: row.selectionBasis,
  };
}

/** Every object of these pinned revisions a person has struck, in one lookup per revision. */
async function struckObjects(scope: TraceScope, setRevisionIds: readonly string[]): Promise<Set<string>> {
  const struck = new Set<string>();
  for (const setRevisionId of setRevisionIds) {
    const rows = await repudiatedObjectsOf({ tenantId: scope.tenantId, projectId: scope.projectId, setRevisionId });
    for (const row of rows) struck.add(row.objectKey);
  }
  return struck;
}
